import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { localDateInZone, ulid } from '@sparksquad/shared';
import { expect } from 'vitest';
import { devOtpOutbox } from '../src/auth';
import { app } from '../src/index';

export const TZ = 'Asia/Kolkata';
export const today = () => localDateInZone(new Date(), TZ);

export async function raw(path: string, init: RequestInit = {}): Promise<Response> {
  const ctx = createExecutionContext();
  const headers = new Headers(init.headers);
  if (!headers.has('origin')) headers.set('origin', 'http://localhost');
  const res = await app.request(path, { ...init, headers }, env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

export interface Client {
  id: string;
  email: string;
  cookie: string;
  req: <T = unknown>(
    method: string,
    path: string,
    body?: unknown,
  ) => Promise<{ status: number; json: T }>;
}

function cookieFrom(res: Response): string {
  const all = res.headers.getSetCookie();
  return all.map((c) => c.split(';')[0]).join('; ');
}

export async function signIn(
  email: string,
  opts: { consent?: boolean; timezone?: string } = {},
): Promise<Client> {
  const send = await raw('/api/auth/email-otp/send-verification-otp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, type: 'sign-in' }),
  });
  expect(send.status).toBe(200);
  const otp = devOtpOutbox.get(email.toLowerCase());
  expect(otp).toMatch(/^\d{6}$/);
  const res = await raw('/api/auth/sign-in/email-otp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, otp }),
  });
  expect(res.status).toBe(200);
  const cookie = cookieFrom(res);
  const json = (await res.json()) as { user: { id: string } };
  const client: Client = {
    id: json.user.id,
    email,
    cookie,
    async req(method, path, body) {
      const r = await raw(path, {
        method,
        headers: { cookie, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      const text = await r.text();
      return { status: r.status, json: (text ? JSON.parse(text) : null) as never };
    },
  };
  await client.req('PATCH', '/v1/me', {
    timezone: opts.timezone ?? TZ,
    displayName: email.split('@')[0],
  });
  if (opts.consent !== false) {
    const c = await client.req('POST', '/v1/me/consent', {
      ageConfirmed: true,
      termsAccepted: true,
    });
    expect(c.status).toBe(200);
  }
  return client;
}

export function plan(days = 7, overrides: Record<string, unknown> = {}) {
  return {
    sparksquad_plan: 1,
    title: 'Test plan',
    category: 'career',
    duration_days: days,
    days: Array.from({ length: days }, (_, i) => ({
      day: i + 1,
      title: `Day ${i + 1}`,
      tasks: [
        { title: 'Solve problems', type: 'count', target: 2, unit: 'problems' },
        { title: 'Write notes', type: 'check' },
      ],
    })),
    ...overrides,
  };
}

export async function makeSquad(owner: Client, extra: Record<string, unknown> = {}) {
  const res = await owner.req<{ id: string; inviteCode: string }>('POST', '/v1/squads', {
    name: 'Placement Squad 7',
    category: 'career',
    privacy: 'public',
    ...extra,
  });
  expect(res.status).toBe(201);
  return res.json;
}

export async function makeChallenge(owner: Client, squadId: string, startDate = today(), days = 7) {
  const res = await owner.req<{ challenge: { id: string } }>(
    'POST',
    `/v1/squads/${squadId}/challenges`,
    {
      plan: plan(days),
      startDate,
    },
  );
  expect(res.status).toBe(201);
  return res.json.challenge;
}

export function checkinBody(
  challengeId: string,
  localDate = today(),
  values = [
    { t: 0, v: 2 },
    { t: 1, v: true },
  ],
) {
  return { challengeId, localDate, timezone: TZ, values };
}

export const newId = () => ulid();
