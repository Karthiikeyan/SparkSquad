import { ulid } from '@sparksquad/shared';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { entitlements, squads, user } from '../db/schema';
import type { AppEnv } from '../env';
import { errors } from '../lib/errors';
import { db, nowIso } from '../lib/http';

/** Entitlement identifiers configured in RevenueCat (see SETUP.md). */
export const RC_ENTITLEMENTS = { plus: 'plus', squadPro: 'squad_pro' } as const;

const eventSchema = z.object({
  event: z.object({
    id: z.string(),
    type: z.string(),
    app_user_id: z.string(),
    original_app_user_id: z.string().optional(),
    aliases: z.array(z.string()).optional(),
    product_id: z.string().optional(),
    entitlement_ids: z.array(z.string()).nullable().optional(),
    expiration_at_ms: z.number().nullable().optional(),
    transferred_to: z.array(z.string()).optional(),
    subscriber_attributes: z.record(z.string(), z.object({ value: z.string() })).optional(),
  }),
});

const ACTIVE_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'PRODUCT_CHANGE',
  'SUBSCRIPTION_EXTENDED',
  'TEMPORARY_ENTITLEMENT_GRANT',
  'CANCELLATION', // still active until expiration
  'BILLING_ISSUE', // grace period: keep until expiration
]);

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const webhookRoutes = new Hono<AppEnv>();

webhookRoutes.post('/revenuecat', async (c) => {
  const secret = c.env.REVENUECAT_WEBHOOK_SECRET;
  const header = c.req.header('authorization') ?? '';
  const provided = header.replace(/^Bearer\s+/i, '');
  if (!secret || !timingSafeEqual(provided, secret)) throw errors.unauthorized();

  const parsed = eventSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw errors.badRequest('Unrecognised webhook payload.');
  const ev = parsed.data.event;
  const d = db(c);

  const seen = await d
    .select({ id: entitlements.id })
    .from(entitlements)
    .where(eq(entitlements.rcEventId, ev.id))
    .get();
  if (seen) return c.json({ ok: true, duplicate: true });

  if (ev.type === 'TEST') {
    await d
      .insert(entitlements)
      .values({
        id: ulid(),
        userId: ev.app_user_id,
        product: 'test',
        status: 'test',
        rcEventId: ev.id,
      })
      .run();
    return c.json({ ok: true });
  }

  // App user ids are our user ids (the app calls Purchases.logIn(userId)).
  const userId =
    ev.type === 'TRANSFER' ? (ev.transferred_to?.[0] ?? ev.app_user_id) : ev.app_user_id;
  const expiresAt = ev.expiration_at_ms ? new Date(ev.expiration_at_ms).toISOString() : null;
  const active = ACTIVE_TYPES.has(ev.type) || ev.type === 'TRANSFER';
  const ids = ev.entitlement_ids ?? [];
  const squadId = ev.subscriber_attributes?.squad_id?.value ?? null;
  const ts = nowIso();

  if (ids.includes(RC_ENTITLEMENTS.plus)) {
    await d
      .update(user)
      .set(
        active
          ? { plan: 'plus', planExpiresAt: expiresAt, updatedAt: new Date() }
          : { plan: 'free', planExpiresAt: null, updatedAt: new Date() },
      )
      .where(eq(user.id, userId))
      .run();
  }
  if (ids.includes(RC_ENTITLEMENTS.squadPro) && squadId) {
    await d
      .update(squads)
      .set(
        active
          ? { isPro: true, proExpiresAt: expiresAt, updatedAt: ts }
          : { isPro: false, proExpiresAt: null, updatedAt: ts },
      )
      .where(and(eq(squads.id, squadId), eq(squads.ownerId, userId)))
      .run();
  }
  await d
    .insert(entitlements)
    .values({
      id: ulid(),
      userId,
      product: ev.product_id ?? ids.join(','),
      squadId,
      status: active ? 'active' : 'expired',
      expiresAt,
      rcEventId: ev.id,
      updatedAt: ts,
    })
    .run();
  return c.json({ ok: true });
});
