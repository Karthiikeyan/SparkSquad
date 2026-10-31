import { HARD_CAPS } from '@sparksquad/shared';
import { z } from 'zod';
import { createAuth } from '../auth';
import { createDb } from '../db/client';
import { takeUsage } from '../services/access';
import type { Ctx } from './http';

/**
 * The only Better Auth endpoints the app uses. Everything else Better Auth ships (redirect OAuth,
 * Expo authorization proxy, OTP check/verify/reset, update-user, change-email, ...) stays unreachable.
 */
const ALLOWED = new Set([
  'POST /sign-in/social',
  'POST /email-otp/send-verification-otp',
  'POST /sign-in/email-otp',
  'GET /get-session',
  'POST /sign-out',
]);

const emailSchema = z.string().trim().toLowerCase().email().max(254);
const socialSchema = z.object({
  provider: z.enum(['google', 'apple']),
  idToken: z.object({ token: z.string().min(1).max(8192) }).passthrough(),
});
const sendSchema = z.object({ email: emailSchema, type: z.literal('sign-in') });
const verifySchema = z.object({ email: emailSchema, otp: z.string().regex(/^\d{6}$/) });

function deny(c: Ctx, status: 400 | 404 | 413 | 429, code: string, message: string): Response {
  return c.json({ error: { code, message } }, status);
}

async function emailKey(email: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email));
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return `email:${hex}`;
}

/** Daily and hourly per-email counters live in usage_counters (hashed key, no raw email stored). */
async function takeEmailUsage(
  c: Ctx,
  email: string,
  kind: string,
  perHour: number,
  perDay?: number,
) {
  const d = createDb(c.env.DB);
  const key = await emailKey(email);
  const now = new Date().toISOString();
  if (!(await takeUsage(d, key, now.slice(0, 13), `${kind}_h`, perHour))) return false;
  if (perDay !== undefined && !(await takeUsage(d, key, now.slice(0, 10), `${kind}_d`, perDay))) {
    return false;
  }
  return true;
}

export async function authGate(c: Ctx): Promise<Response> {
  const sub = c.req.path.replace(/^\/api\/auth/, '') || '/';
  if (!ALLOWED.has(`${c.req.method} ${sub}`)) return deny(c, 404, 'NOT_FOUND', 'Not found.');

  let forward: Request = c.req.raw;
  if (c.req.method === 'POST') {
    const declared = Number(c.req.header('content-length') ?? '0');
    if (declared > HARD_CAPS.authBodyMaxBytes) {
      return deny(c, 413, 'BAD_REQUEST', 'That request is too large.');
    }
    const buf = await c.req.raw.arrayBuffer();
    if (buf.byteLength > HARD_CAPS.authBodyMaxBytes) {
      return deny(c, 413, 'BAD_REQUEST', 'That request is too large.');
    }
    let json: unknown = {};
    if (buf.byteLength > 0) {
      try {
        json = JSON.parse(new TextDecoder().decode(buf));
      } catch {
        return deny(c, 400, 'BAD_REQUEST', 'The request body must be JSON.');
      }
    }

    if (sub === '/sign-in/social' && !socialSchema.safeParse(json).success) {
      return deny(c, 400, 'BAD_REQUEST', 'Sign in with Google or Apple on your phone.');
    }
    if (sub === '/email-otp/send-verification-otp') {
      const p = sendSchema.safeParse(json);
      if (!p.success) return deny(c, 400, 'BAD_REQUEST', 'Enter a valid email address.');
      const ok = await takeEmailUsage(
        c,
        p.data.email,
        'otp_send',
        HARD_CAPS.otpSendsPerEmailPerHour,
        HARD_CAPS.otpSendsPerEmailPerDay,
      );
      if (!ok) return deny(c, 429, 'RATE_LIMITED', 'Too many codes requested. Try again later.');
    }
    if (sub === '/sign-in/email-otp') {
      const p = verifySchema.safeParse(json);
      if (!p.success) return deny(c, 400, 'BAD_REQUEST', 'Enter the 6-digit code.');
      const ok = await takeEmailUsage(
        c,
        p.data.email,
        'otp_verify',
        HARD_CAPS.otpVerifyAttemptsPerEmailPerHour,
      );
      if (!ok) return deny(c, 429, 'RATE_LIMITED', 'Too many attempts. Request a new code later.');
    }

    forward = new Request(c.req.url, {
      method: 'POST',
      headers: c.req.raw.headers,
      body: buf,
    });
  }
  return createAuth(c.env, (p) => c.executionCtx.waitUntil(p)).handler(forward);
}
