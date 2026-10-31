import {
  discoverQuerySchema,
  integrationProviderSchema,
  integrationSchema,
  localDateInZone,
  nudgeSchema,
  proofUploadSchema,
  pushTokenSchema,
  reportSchema,
  photoRetentionDays,
  ulid,
  type DiscoverResponse,
  type TemplateSummaryDTO,
} from '@sparksquad/shared';
import { and, desc, eq, inArray, isNull, like, lt } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  blocks,
  challenges,
  checkins,
  integrations,
  notifications,
  nudges,
  pushTokens,
  reports,
  squads,
  templates,
  user,
} from '../db/schema';
import type { AppEnv } from '../env';
import { ApiError, errors } from '../lib/errors';
import { body, db, nowIso, query } from '../lib/http';
import { isBlockedEitherWay, requireMember, userPlan } from '../services/access';
import { displayNameOf, isSquadPro, toPublicUser } from '../services/dto';
import { addNotification, sendPush } from '../services/notify';
import { signedUrl } from '../services/r2';
import { buildPreview } from './squads';

/* ---------------- discover & templates ---------------- */

export const discoverRoutes = new Hono<AppEnv>();

function templateSummary(t: typeof templates.$inferSelect): TemplateSummaryDTO {
  return {
    slug: t.slug,
    title: t.title,
    category: t.category,
    durationDays: t.durationDays,
    tasksPerDay: t.tasksPerDay,
  };
}

discoverRoutes.get('/discover', async (c) => {
  const q = query(c, discoverQuerySchema);
  const d = db(c);
  const me = c.get('user');
  const pageSize = 20;
  const conds = [eq(squads.privacy, 'public'), isNull(squads.archivedAt), isNull(squads.hiddenAt)];
  if (q.category) conds.push(eq(squads.category, q.category));
  if (q.q) conds.push(like(squads.name, `%${q.q.replace(/[%_]/g, '')}%`));
  if (q.cursor) conds.push(lt(squads.createdAt, q.cursor));
  const blockedOwners = await d
    .select({ id: blocks.blockedId })
    .from(blocks)
    .where(eq(blocks.blockerId, me.id))
    .all();
  const rows = await d
    .select()
    .from(squads)
    .where(and(...conds))
    .orderBy(desc(squads.createdAt))
    .limit(pageSize + 1)
    .all();
  const blockedSet = new Set(blockedOwners.map((b) => b.id));
  const page = rows.slice(0, pageSize).filter((r) => !blockedSet.has(r.ownerId));
  const tplConds = [eq(templates.published, true)];
  if (q.category) tplConds.push(eq(templates.category, q.category));
  if (q.q) tplConds.push(like(templates.title, `%${q.q.replace(/[%_]/g, '')}%`));
  const tpls = q.cursor
    ? []
    : await d
        .select()
        .from(templates)
        .where(and(...tplConds))
        .all();
  const response: DiscoverResponse = {
    squads: await Promise.all(page.map((s) => buildPreview(d, s, me.id))),
    templates: tpls.map(templateSummary),
    nextCursor: rows.length > pageSize ? (rows[pageSize - 1]?.createdAt ?? null) : null,
  };
  return c.json(response);
});

discoverRoutes.get('/templates', async (c) => {
  const rows = await db(c).select().from(templates).where(eq(templates.published, true)).all();
  return c.json({ templates: rows.map(templateSummary) });
});

discoverRoutes.get('/templates/:slug', async (c) => {
  const t = await db(c)
    .select()
    .from(templates)
    .where(eq(templates.slug, c.req.param('slug')))
    .get();
  if (!t || !t.published) throw errors.notFound('That template');
  const obj = await c.env.BUCKET.get(t.planKey);
  if (!obj) throw errors.notFound('That template');
  c.header('Cache-Control', 'public, max-age=3600');
  return c.json(await obj.json());
});

/* ---------------- nudges ---------------- */

export const nudgeRoutes = new Hono<AppEnv>();

nudgeRoutes.post('/', async (c) => {
  const input = await body(c, nudgeSchema);
  const d = db(c);
  const me = c.get('user');
  if (input.toUserId === me.id) throw errors.badRequest('You can’t nudge yourself.');
  const ch = await d.select().from(challenges).where(eq(challenges.id, input.challengeId)).get();
  if (!ch || ch.status !== 'active') throw errors.notFound('That challenge');
  await requireMember(d, ch.squadId, me.id);
  await requireMember(d, ch.squadId, input.toUserId).catch(() => {
    throw errors.notFound('That member');
  });
  if (await isBlockedEitherWay(d, me.id, input.toUserId)) throw errors.notFound('That member');
  const target = await d.select().from(user).where(eq(user.id, input.toUserId)).get();
  if (!target) throw errors.notFound('That member');
  const localDate = localDateInZone(new Date(), target.timezone);
  const already = await d
    .select({ id: checkins.id })
    .from(checkins)
    .where(
      and(
        eq(checkins.challengeId, ch.id),
        eq(checkins.userId, target.id),
        eq(checkins.localDate, localDate),
      ),
    )
    .get();
  if (already)
    throw errors.conflict('CONFLICT', `${displayNameOf(target)} has already checked in today.`);
  const inserted = await d
    .insert(nudges)
    .values({ challengeId: ch.id, fromUserId: me.id, toUserId: target.id, localDate })
    .onConflictDoNothing()
    .returning({ d: nudges.localDate })
    .get();
  if (!inserted) {
    throw new ApiError(429, 'LIMIT_NUDGE_ALREADY_SENT', 'You’ve already nudged them today.');
  }
  const sender = await d.select().from(user).where(eq(user.id, me.id)).get();
  const senderName = sender ? displayNameOf(sender) : 'A squadmate';
  await addNotification(d, target.id, 'nudge', {
    challengeId: ch.id,
    squadId: ch.squadId,
    fromUserId: me.id,
    fromName: senderName,
    title: ch.title,
  });
  c.executionCtx.waitUntil(
    sendPush(
      c.env,
      d,
      [target.id],
      {
        title: 'SparkSquad',
        body: `${senderName} nudged you: ${ch.title} is waiting`,
        data: { type: 'nudge', challengeId: ch.id, squadId: ch.squadId },
      },
      'nudge',
    ),
  );
  return c.json({ ok: true, localDate }, 201);
});

/* ---------------- uploads & files ---------------- */

export const uploadRoutes = new Hono<AppEnv>();

uploadRoutes.post('/proof', async (c) => {
  const input = await body(c, proofUploadSchema);
  const d = db(c);
  const me = c.get('user');
  const existing = await d.select().from(checkins).where(eq(checkins.id, input.checkinId)).get();
  if (existing && existing.userId !== me.id) throw errors.forbidden('That check-in isn’t yours.');
  let pro = false;
  if (existing) {
    const ch = await d
      .select()
      .from(challenges)
      .where(eq(challenges.id, existing.challengeId))
      .get();
    const sq = ch
      ? await d.select().from(squads).where(eq(squads.id, ch.squadId)).get()
      : undefined;
    pro = sq ? isSquadPro(sq) : false;
  }
  const days = photoRetentionDays(await userPlan(d, me.id), pro);
  if (days === 0) {
    throw new ApiError(
      403,
      'PLUS_REQUIRED',
      'Sharing photo proof with your squad is part of Plus.',
    );
  }
  const ext = input.contentType === 'image/webp' ? 'webp' : 'jpg';
  const key = `proof-${days}d/${me.id}/${input.checkinId}.${ext}`;
  const signed = await signedUrl(c.env, 'PUT', key, 600, input.contentType);
  return c.json({ url: signed.url, key, headers: signed.headers, expiresAt: signed.expiresAt });
});

/* ---------------- push tokens ---------------- */

export const pushRoutes = new Hono<AppEnv>();

pushRoutes.put('/', async (c) => {
  const input = await body(c, pushTokenSchema);
  const ts = nowIso();
  await db(c)
    .insert(pushTokens)
    .values({
      token: input.token,
      userId: c.get('user').id,
      platform: input.platform,
      updatedAt: ts,
    })
    .onConflictDoUpdate({
      target: pushTokens.token,
      set: { userId: c.get('user').id, platform: input.platform, updatedAt: ts },
    })
    .run();
  return c.json({ ok: true });
});

pushRoutes.delete('/:token', async (c) => {
  await db(c)
    .delete(pushTokens)
    .where(
      and(
        eq(pushTokens.token, decodeURIComponent(c.req.param('token'))),
        eq(pushTokens.userId, c.get('user').id),
      ),
    )
    .run();
  return c.json({ ok: true });
});

/* ---------------- reports & blocks ---------------- */

export const safetyRoutes = new Hono<AppEnv>();

safetyRoutes.post('/reports', async (c) => {
  const input = await body(c, reportSchema);
  const d = db(c);
  const me = c.get('user');
  await d
    .insert(reports)
    .values({
      id: ulid(),
      reporterId: me.id,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      details: input.details ?? null,
    })
    .run();
  return c.json({ ok: true }, 201);
});

safetyRoutes.get('/blocks', async (c) => {
  const rows = await db(c)
    .select()
    .from(blocks)
    .innerJoin(user, eq(user.id, blocks.blockedId))
    .where(eq(blocks.blockerId, c.get('user').id))
    .all();
  return c.json({
    blocked: rows.map((r) => ({ user: toPublicUser(r.user), createdAt: r.blocks.createdAt })),
  });
});

safetyRoutes.put('/blocks/:userId', async (c) => {
  const me = c.get('user');
  const target = c.req.param('userId');
  if (target === me.id) throw errors.badRequest('You can’t block yourself.');
  const d = db(c);
  const exists = await d.select({ id: user.id }).from(user).where(eq(user.id, target)).get();
  if (!exists) throw errors.notFound('That person');
  await d
    .insert(blocks)
    .values({ blockerId: me.id, blockedId: target })
    .onConflictDoNothing()
    .run();
  return c.json({ ok: true });
});

safetyRoutes.delete('/blocks/:userId', async (c) => {
  await db(c)
    .delete(blocks)
    .where(and(eq(blocks.blockerId, c.get('user').id), eq(blocks.blockedId, c.req.param('userId'))))
    .run();
  return c.json({ ok: true });
});

/* ---------------- integrations ---------------- */

export const integrationRoutes = new Hono<AppEnv>();

integrationRoutes.get('/', async (c) => {
  const rows = await db(c)
    .select()
    .from(integrations)
    .where(eq(integrations.userId, c.get('user').id))
    .all();
  return c.json({ integrations: rows.map((r) => ({ provider: r.provider, handle: r.handle })) });
});

integrationRoutes.put('/:provider', async (c) => {
  const provider = integrationProviderSchema.parse(c.req.param('provider'));
  const { handle } = await body(c, integrationSchema);
  await db(c)
    .insert(integrations)
    .values({ userId: c.get('user').id, provider, handle })
    .onConflictDoUpdate({ target: [integrations.userId, integrations.provider], set: { handle } })
    .run();
  return c.json({ provider, handle });
});

integrationRoutes.delete('/:provider', async (c) => {
  const provider = integrationProviderSchema.parse(c.req.param('provider'));
  await db(c)
    .delete(integrations)
    .where(and(eq(integrations.userId, c.get('user').id), eq(integrations.provider, provider)))
    .run();
  return c.json({ ok: true });
});

/* ---------------- notifications ---------------- */

export const notificationRoutes = new Hono<AppEnv>();

notificationRoutes.post('/read', async (c) => {
  const { ids } = await body(c, z.object({ ids: z.array(z.string().max(64)).max(200).optional() }));
  const ts = nowIso();
  const me = c.get('user');
  await db(c)
    .update(notifications)
    .set({ readAt: ts, updatedAt: ts })
    .where(
      and(
        eq(notifications.userId, me.id),
        isNull(notifications.readAt),
        ids?.length ? inArray(notifications.id, ids) : undefined,
      ),
    )
    .run();
  return c.json({ ok: true });
});
