import { ulid } from '@sparksquad/shared';
import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Db } from '../db/client';
import { entitlements, squads, user } from '../db/schema';
import type { AppEnv, Bindings } from '../env';
import { chunks } from '../lib/chunk';
import { errors } from '../lib/errors';
import { db, nowIso } from '../lib/http';

/** Entitlement identifiers configured in RevenueCat (see SETUP.md). */
export const RC_ENTITLEMENTS = { plus: 'plus', squadPro: 'squad_pro' } as const;

const eventSchema = z.object({
  event: z.object({
    id: z.string().max(200),
    type: z.string().max(64),
    /** Absent on TRANSFER events; required for every other type. */
    app_user_id: z.string().max(200).optional(),
    original_app_user_id: z.string().max(200).optional(),
    aliases: z.array(z.string().max(200)).max(50).optional(),
    product_id: z.string().max(200).optional(),
    entitlement_ids: z.array(z.string().max(64)).max(20).nullable().optional(),
    expiration_at_ms: z.number().nullable().optional(),
    event_timestamp_ms: z.number().optional(),
    environment: z.string().max(32).optional(),
    original_transaction_id: z.string().max(200).nullable().optional(),
    transferred_from: z.array(z.string().max(200)).max(50).optional(),
    transferred_to: z.array(z.string().max(200)).max(50).optional(),
    subscriber_attributes: z
      .record(z.string(), z.object({ value: z.string().max(200) }))
      .optional(),
  }),
});
type RcEvent = z.infer<typeof eventSchema>['event'];

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

/** Sandbox (store test) purchases never grant production entitlements unless explicitly allowed. */
function acceptsSandbox(env: Bindings): boolean {
  return env.APP_ENV !== 'production' || env.REVENUECAT_ALLOW_SANDBOX === 'true';
}

const hasEntitlement = (id: string) =>
  sql`(',' || ${entitlements.entitlementIds} || ',') like ${`%,${id},%`}`;

type EntRow = typeof entitlements.$inferSelect;

/** Newest row per (app user, subscription), by event time then arrival order. */
function latestPerSubscription(rows: EntRow[]): EntRow[] {
  const best = new Map<string, EntRow>();
  for (const r of rows) {
    const key = `${r.userId}|${r.subscriptionKey ?? r.product}`;
    const cur = best.get(key);
    const at = r.eventAt ?? r.updatedAt;
    const curAt = cur ? (cur.eventAt ?? cur.updatedAt) : '';
    if (!cur || at > curAt || (at === curAt && r.id > cur.id)) best.set(key, r);
  }
  return [...best.values()];
}

/** Active = latest state for that subscription is active and not past its expiry. */
function activeExpiry(rows: EntRow[], now: string): { active: boolean; expiresAt: string | null } {
  const live = latestPerSubscription(rows).filter(
    (r) => r.status === 'active' && (!r.expiresAt || r.expiresAt > now),
  );
  if (live.length === 0) return { active: false, expiresAt: null };
  if (live.some((r) => !r.expiresAt)) return { active: true, expiresAt: null };
  return {
    active: true,
    expiresAt: live
      .map((r) => r.expiresAt!)
      .sort()
      .at(-1)!,
  };
}

/** Recomputes user.plan from every Plus subscription the user holds, not just the latest event. */
async function recomputePlus(d: Db, userId: string, now: string): Promise<void> {
  const rows = await d
    .select()
    .from(entitlements)
    .where(and(eq(entitlements.userId, userId), hasEntitlement(RC_ENTITLEMENTS.plus)))
    .all();
  const { active, expiresAt } = activeExpiry(rows, now);
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

/** Recomputes squads.isPro from every Squad Pro subscription bound to that squad. */
async function recomputeSquadPro(d: Db, squadId: string, now: string): Promise<void> {
  const rows = await d
    .select()
    .from(entitlements)
    .where(and(eq(entitlements.squadId, squadId), hasEntitlement(RC_ENTITLEMENTS.squadPro)))
    .all();
  const { active, expiresAt } = activeExpiry(rows, now);
  await d
    .update(squads)
    .set(
      active
        ? { isPro: true, proExpiresAt: expiresAt, updatedAt: now }
        : { isPro: false, proExpiresAt: null, updatedAt: now },
    )
    .where(eq(squads.id, squadId))
    .run();
}

/**
 * Which squad a Squad Pro event applies to. While a subscription is continuously active it stays
 * on the squad it was bound to (a later `squad_id` attribute change cannot move it); expiry-type
 * events always hit that squad. A fresh purchase, or a resubscription after the binding lapsed
 * (App Store keeps one original_transaction_id per group), reads the attribute again, and only for
 * a squad the buyer owns.
 */
async function boundSquadId(
  d: Db,
  userId: string,
  subscriptionKey: string,
  ev: RcEvent,
  active: boolean,
  now: string,
): Promise<string | null> {
  const latest = await d
    .select({
      squadId: entitlements.squadId,
      status: entitlements.status,
      expiresAt: entitlements.expiresAt,
    })
    .from(entitlements)
    .where(
      and(
        eq(entitlements.userId, userId),
        eq(entitlements.subscriptionKey, subscriptionKey),
        hasEntitlement(RC_ENTITLEMENTS.squadPro),
        isNotNull(entitlements.squadId),
      ),
    )
    .orderBy(desc(entitlements.eventAt), desc(entitlements.id))
    .get();
  if (!active) return latest?.squadId ?? null;
  const stillBound =
    latest?.squadId &&
    latest.status === 'active' &&
    (!latest.expiresAt || latest.expiresAt > now) &&
    ev.type !== 'INITIAL_PURCHASE';
  if (stillBound) return latest.squadId;
  const requested = ev.subscriber_attributes?.squad_id?.value ?? null;
  if (!requested) return latest?.squadId ?? null;
  const owned = await d
    .select({ id: squads.id })
    .from(squads)
    .where(and(eq(squads.id, requested), eq(squads.ownerId, userId)))
    .get();
  return owned ? requested : null;
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

  const now = nowIso();
  const eventAt = ev.event_timestamp_ms ? new Date(ev.event_timestamp_ms).toISOString() : now;
  const ids = ev.entitlement_ids ?? [];
  const record = (values: Partial<typeof entitlements.$inferInsert>) =>
    d
      .insert(entitlements)
      .values({
        id: ulid(),
        userId: ev.app_user_id ?? 'unknown',
        product: ev.product_id ?? (ids.join(',') || 'unknown'),
        status: 'ignored',
        rcEventId: ev.id,
        updatedAt: now,
        eventAt,
        ...values,
      })
      .run();

  if (ev.type === 'TEST') {
    await record({ product: 'test', status: 'test' });
    return c.json({ ok: true });
  }
  if ((ev.environment ?? 'PRODUCTION').toUpperCase() === 'SANDBOX' && !acceptsSandbox(c.env)) {
    await record({ status: 'ignored_sandbox' });
    return c.json({ ok: true, ignored: 'sandbox' });
  }

  const subscriptionKey = ev.original_transaction_id || ev.product_id || ids.join(',') || ev.id;
  const touchedSquads = new Set<string>();

  if (ev.type === 'TRANSFER') {
    // RevenueCat TRANSFER carries only transferred_from/transferred_to: every subscription the old
    // app users hold moves to the new one (same subscription, entitlements, squad and expiry).
    const toUser = ev.transferred_to?.[0];
    const fromUsers = (ev.transferred_from ?? []).filter((u) => u !== toUser);
    await record({ userId: toUser ?? fromUsers[0] ?? 'unknown', status: 'transfer' });
    if (!toUser || fromUsers.length === 0) return c.json({ ok: true });
    const moving: EntRow[] = [];
    for (const part of chunks(fromUsers)) {
      moving.push(
        ...latestPerSubscription(
          await d.select().from(entitlements).where(inArray(entitlements.userId, part)).all(),
        ).filter(
          (r) => r.status === 'active' && r.entitlementIds && (!r.expiresAt || r.expiresAt > now),
        ),
      );
    }
    for (const r of moving) {
      const common = {
        product: r.product,
        squadId: r.squadId,
        updatedAt: now,
        entitlementIds: r.entitlementIds,
        subscriptionKey: r.subscriptionKey,
        eventAt,
      };
      await d
        .insert(entitlements)
        .values({
          ...common,
          id: ulid(),
          userId: r.userId,
          status: 'transferred',
          rcEventId: `${ev.id}:from:${r.id}`,
        })
        .run();
      await d
        .insert(entitlements)
        .values({
          ...common,
          id: ulid(),
          userId: toUser,
          status: 'active',
          expiresAt: r.expiresAt,
          rcEventId: `${ev.id}:to:${r.id}`,
        })
        .run();
      if (r.squadId) touchedSquads.add(r.squadId);
    }
    for (const u of fromUsers) await recomputePlus(d, u, now);
    await recomputePlus(d, toUser, now);
    for (const s of touchedSquads) await recomputeSquadPro(d, s, now);
    return c.json({ ok: true });
  }

  if (!ev.app_user_id) throw errors.badRequest('Unrecognised webhook payload.');
  const userId = ev.app_user_id;
  const active = ACTIVE_TYPES.has(ev.type);
  const expiresAt = ev.expiration_at_ms ? new Date(ev.expiration_at_ms).toISOString() : null;
  // An event without its own subscription identity applies to the user's latest subscription
  // for the same entitlement.
  let eventKey = ev.original_transaction_id || ev.product_id || null;
  if (!eventKey && ids[0]) {
    const latest = await d
      .select({ key: entitlements.subscriptionKey })
      .from(entitlements)
      .where(
        and(
          eq(entitlements.userId, userId),
          hasEntitlement(ids[0]),
          isNotNull(entitlements.subscriptionKey),
        ),
      )
      .orderBy(desc(entitlements.eventAt), desc(entitlements.id))
      .get();
    eventKey = latest?.key ?? null;
  }
  eventKey ??= subscriptionKey;
  const squadId = ids.includes(RC_ENTITLEMENTS.squadPro)
    ? await boundSquadId(d, userId, eventKey, ev, active, now)
    : null;

  await record({
    squadId,
    status: active ? 'active' : 'expired',
    expiresAt,
    entitlementIds: ids.join(','),
    subscriptionKey: eventKey,
  });
  if (ids.includes(RC_ENTITLEMENTS.plus)) await recomputePlus(d, userId, now);
  if (squadId) await recomputeSquadPro(d, squadId, now);
  return c.json({ ok: true });
});

/** Hourly safety net: squads whose Pro lapsed without a webhook drop back to free. */
export async function expireLapsedSquadPro(d: Db, now: string): Promise<void> {
  const lapsed = await d
    .select({ id: squads.id })
    .from(squads)
    .where(
      and(
        eq(squads.isPro, true),
        isNotNull(squads.proExpiresAt),
        sql`${squads.proExpiresAt} <= ${now}`,
      ),
    )
    .limit(500)
    .all();
  for (const s of lapsed) {
    await d
      .update(squads)
      .set({ isPro: false, proExpiresAt: null, updatedAt: now })
      .where(eq(squads.id, s.id))
      .run();
  }
}
