import {
  consentSchema,
  plusInterestSchema,
  ulid,
  updateMeSchema,
  usernameCheckSchema,
} from '@sparksquad/shared';
import { and, asc, eq, ne } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Db } from '../db/client';
import {
  badges,
  challenges,
  checkins,
  comments,
  integrations,
  squadMembers,
  squads,
  streaks,
  user,
} from '../db/schema';
import type { AppEnv, Bindings } from '../env';
import { ApiError } from '../lib/errors';
import { body, db, nowIso, query } from '../lib/http';
import { assertClean, atOwnLimit, getUser } from '../services/access';
import { toMe } from '../services/dto';
import { signedUrl } from '../services/r2';
import { recountMembers } from '../services/squads';

export const meRoutes = new Hono<AppEnv>();

meRoutes.get('/', async (c) => {
  const row = await getUser(db(c), c.get('user').id);
  return c.json(toMe(row, c.env.ADMIN_EMAILS));
});

meRoutes.patch('/', async (c) => {
  const input = await body(c, updateMeSchema);
  const d = db(c);
  const me = c.get('user');
  assertClean(input.displayName, input.username);
  if (input.username) {
    const taken = await d
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.username, input.username), ne(user.id, me.id)))
      .get();
    if (taken)
      throw new ApiError(409, 'USERNAME_TAKEN', 'That username is taken. Try another one.');
  }
  const { interests, ...rest } = input;
  await d
    .update(user)
    .set({
      ...rest,
      ...(interests ? { interests: JSON.stringify(interests) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(user.id, me.id))
    .run();
  return c.json(toMe(await getUser(d, me.id), c.env.ADMIN_EMAILS));
});

meRoutes.get('/username-available', async (c) => {
  const { username } = query(c, usernameCheckSchema);
  const taken = await db(c)
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.username, username), ne(user.id, c.get('user').id)))
    .get();
  return c.json({ username, available: !taken });
});

meRoutes.post('/consent', async (c) => {
  await body(c, consentSchema);
  const ts = nowIso();
  const d = db(c);
  await d
    .update(user)
    .set({ ageConfirmedAt: ts, termsAcceptedAt: ts, updatedAt: new Date() })
    .where(eq(user.id, c.get('user').id))
    .run();
  return c.json(toMe(await getUser(d, c.get('user').id), c.env.ADMIN_EMAILS));
});

meRoutes.post('/plus-interest', async (c) => {
  await body(c, plusInterestSchema);
  await db(c)
    .update(user)
    .set({ plusInterestAt: nowIso() })
    .where(eq(user.id, c.get('user').id))
    .run();
  return c.json({ ok: true });
});

meRoutes.post('/export', async (c) => {
  const d = db(c);
  const me = c.get('user');
  const profile = toMe(await getUser(d, me.id), c.env.ADMIN_EMAILS);
  const data = {
    exportedAt: nowIso(),
    profile,
    memberships: await d.select().from(squadMembers).where(eq(squadMembers.userId, me.id)).all(),
    checkins: await d.select().from(checkins).where(eq(checkins.userId, me.id)).all(),
    comments: await d.select().from(comments).where(eq(comments.userId, me.id)).all(),
    streaks: await d.select().from(streaks).where(eq(streaks.userId, me.id)).all(),
    badges: await d.select().from(badges).where(eq(badges.userId, me.id)).all(),
    integrations: await d.select().from(integrations).where(eq(integrations.userId, me.id)).all(),
  };
  const key = `exports/${me.id}/${ulid()}.json`;
  await c.env.BUCKET.put(key, JSON.stringify(data, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });
  const signed = await signedUrl(c.env, 'GET', key, 24 * 3600);
  return c.json({ url: signed.url, expiresAt: signed.expiresAt });
});

async function deleteR2Prefix(env: Bindings, prefix: string): Promise<void> {
  let cursor: string | undefined;
  do {
    const list = await env.BUCKET.list({ prefix, ...(cursor ? { cursor } : {}) });
    if (list.objects.length > 0) await env.BUCKET.delete(list.objects.map((o) => o.key));
    cursor = list.truncated ? list.cursor : undefined;
  } while (cursor);
}

/**
 * Hands owned squads to the longest-standing admin (else member) who may own another squad and is
 * not suspended. If nobody qualifies the squad is archived under the first candidate (archived
 * squads do not count toward owned limits). Squads with nobody left are deleted.
 */
async function releaseOwnedSquads(env: Bindings, d: Db, userId: string): Promise<void> {
  const owned = await d.select().from(squads).where(eq(squads.ownerId, userId)).all();
  for (const sq of owned) {
    const others = await d
      .select()
      .from(squadMembers)
      .where(
        and(
          eq(squadMembers.squadId, sq.id),
          eq(squadMembers.status, 'active'),
          ne(squadMembers.userId, userId),
        ),
      )
      .orderBy(asc(squadMembers.joinedAt))
      .all();
    const candidates = [
      ...others.filter((m) => m.role === 'admin'),
      ...others.filter((m) => m.role !== 'admin'),
    ];
    let heir: (typeof candidates)[number] | undefined;
    for (const m of candidates) {
      const u = await d
        .select({ suspendedAt: user.suspendedAt, deletedAt: user.deletedAt })
        .from(user)
        .where(eq(user.id, m.userId))
        .get();
      if (!u || u.suspendedAt || u.deletedAt) continue;
      if (sq.archivedAt || !(await atOwnLimit(d, m.userId))) {
        heir = m;
        break;
      }
    }
    const fallback = heir ? undefined : candidates[0];
    const ts = nowIso();
    const next = heir ?? fallback;
    if (next) {
      await d.batch([
        d
          .update(squads)
          .set({
            ownerId: next.userId,
            updatedAt: ts,
            ...(heir ? {} : { archivedAt: sq.archivedAt ?? ts }),
          })
          .where(eq(squads.id, sq.id)),
        d
          .update(squadMembers)
          .set({ role: 'owner', updatedAt: ts })
          .where(and(eq(squadMembers.squadId, sq.id), eq(squadMembers.userId, next.userId))),
        ...(heir
          ? []
          : [
              d
                .update(challenges)
                .set({ status: 'ended', endedAt: ts, updatedAt: ts })
                .where(and(eq(challenges.squadId, sq.id), eq(challenges.status, 'active'))),
            ]),
      ]);
    } else {
      const chs = await d
        .select({ id: challenges.id })
        .from(challenges)
        .where(eq(challenges.squadId, sq.id))
        .all();
      for (const ch of chs) await deleteR2Prefix(env, `plans/${ch.id}/`);
      await d.delete(squads).where(eq(squads.id, sq.id)).run();
    }
  }
}

meRoutes.delete('/', async (c) => {
  const d = db(c);
  const me = c.get('user');
  await releaseOwnedSquads(c.env, d, me.id);
  // Keep member counts right for squads the user is leaving.
  const memberships = await d
    .select({ squadId: squadMembers.squadId })
    .from(squadMembers)
    .where(and(eq(squadMembers.userId, me.id), eq(squadMembers.status, 'active')))
    .all();
  await Promise.all([
    deleteR2Prefix(c.env, `proof-30d/${me.id}/`),
    deleteR2Prefix(c.env, `proof-90d/${me.id}/`),
    deleteR2Prefix(c.env, `exports/${me.id}/`),
  ]);
  await d.delete(user).where(eq(user.id, me.id)).run();
  await recountMembers(
    d,
    memberships.map((m) => m.squadId),
  );
  return c.json({ ok: true });
});
