import type { Context, MiddlewareHandler } from 'hono';
import type { z } from 'zod';
import { createAuth } from '../auth';
import { createDb, type Db } from '../db/client';
import { user as userTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { AppEnv } from '../env';
import { ApiError, errors } from './errors';

export type Ctx = Context<AppEnv>;

export function db(c: Ctx): Db {
  return createDb(c.env.DB);
}

export async function body<T extends z.ZodType>(c: Ctx, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw errors.badRequest('The request body must be JSON.');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw errors.validation(
      parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return parsed.data;
}

export function query<T extends z.ZodType>(c: Ctx, schema: T): z.infer<T> {
  const parsed = schema.safeParse(c.req.query());
  if (!parsed.success) {
    throw errors.validation(
      parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return parsed.data;
}

/** Cloudflare sets cf-connecting-ip; client-supplied forwarding headers are not trusted. */
function clientIp(c: Ctx): string {
  return c.req.header('cf-connecting-ip') ?? 'unknown';
}

async function limitOrThrow(limiter: RateLimit | undefined, key: string): Promise<void> {
  if (!limiter) return;
  try {
    const { success } = await limiter.limit({ key });
    if (!success) throw errors.rateLimited();
  } catch (e) {
    if (e instanceof ApiError) throw e;
    // Never fail a request because the limiter itself is unavailable.
  }
}

export const ipRateLimit: MiddlewareHandler<AppEnv> = async (c, next) => {
  await limitOrThrow(c.env.IP_LIMITER, `ip:${clientIp(c)}`);
  await next();
};

/** Resolves the Better Auth session, rejects suspended/deleted accounts, applies per-user rate limit. */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const auth = createAuth(c.env);
  const result = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!result) throw errors.unauthorized();
  const row = await db(c)
    .select({ suspendedAt: userTable.suspendedAt, deletedAt: userTable.deletedAt })
    .from(userTable)
    .where(eq(userTable.id, result.user.id))
    .get();
  if (!row || row.deletedAt) throw errors.unauthorized();
  if (row.suspendedAt) {
    throw new ApiError(
      403,
      'ACCOUNT_SUSPENDED',
      'This account is suspended. Contact support if you think this is a mistake.',
    );
  }
  c.set('user', { id: result.user.id, email: result.user.email, name: result.user.name });
  await limitOrThrow(c.env.USER_LIMITER, `user:${result.user.id}`);
  await next();
};

/** Blocks squad/check-in writes until the 18+ and terms consent is recorded. */
export const requireConsent: MiddlewareHandler<AppEnv> = async (c, next) => {
  const row = await db(c)
    .select({ age: userTable.ageConfirmedAt, terms: userTable.termsAcceptedAt })
    .from(userTable)
    .where(eq(userTable.id, c.get('user').id))
    .get();
  if (!row?.age || !row.terms) {
    throw new ApiError(
      403,
      'CONSENT_REQUIRED',
      'Confirm you’re 18 or older and accept the terms first.',
    );
  }
  await next();
};

export function nowIso(): string {
  return new Date().toISOString();
}
