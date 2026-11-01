import {
  TEXT_LIMITS,
  commentRetentionDays,
  commentSchema,
  computeCheckinStatus,
  countsAsDone,
  isWithinCheckinWindow,
  localDateInZone,
  photoRetentionDays,
  rawDayNumber,
  upsertCheckinSchema,
  ulid,
  HARD_CAPS,
  type PlanTask,
} from '@sparksquad/shared';
import { and, asc, eq, gt, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Db } from '../db/client';
import { challenges, checkins, comments, reactions, user } from '../db/schema';
import type { AppEnv, Bindings } from '../env';
import { ApiError, errors } from '../lib/errors';
import { body, db, nowIso } from '../lib/http';
import {
  assertClean,
  blockedByMe,
  isBlockedEitherWay,
  requireMember,
  takeUsage,
  userPlan,
} from '../services/access';
import { displayNameOf, isSquadPro, toCheckin, toComment, toStreak } from '../services/dto';
import { addNotification, addNotificationIf, notifyFires } from '../services/notify';
import { effectiveDay } from '../services/plans';
import { signedUrl } from '../services/r2';
import { awardBadges, recomputeChallengeStreak, recomputeGlobalStreak } from '../services/streaks';

export const checkinRoutes = new Hono<AppEnv>();
export const commentRoutes = new Hono<AppEnv>();

type CheckinRow = typeof checkins.$inferSelect;

export async function photoUrlFor(
  env: Bindings,
  row: Pick<CheckinRow, 'photoKey' | 'hiddenAt'>,
): Promise<string | null> {
  if (!row.photoKey || row.hiddenAt) return null;
  return (await signedUrl(env, 'GET', row.photoKey, 3600)).url;
}

async function loadCheckin(d: Db, id: string, viewerId: string) {
  const row = await d.select().from(checkins).where(eq(checkins.id, id)).get();
  if (!row || row.hiddenAt) throw errors.notFound('That check-in');
  const ch = await d.select().from(challenges).where(eq(challenges.id, row.challengeId)).get();
  if (!ch) throw errors.notFound('That check-in');
  const access = await requireMember(d, ch.squadId, viewerId);
  if (row.userId !== viewerId && (await isBlockedEitherWay(d, viewerId, row.userId))) {
    throw errors.notFound('That check-in');
  }
  return { row, ch, ...access };
}

function applyPersonalTargets(
  tasks: PlanTask[],
  targets: { t: number; target: number }[] | undefined,
  allowed: boolean,
): PlanTask[] {
  if (!allowed || !targets?.length) return tasks;
  const byIndex = new Map(targets.map((x) => [x.t, x.target]));
  return tasks.map((t, i) =>
    t.type !== 'check' && byIndex.has(i) ? { ...t, target: byIndex.get(i) } : t,
  );
}

checkinRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  if (!/^[0-9A-Za-z_-]{10,64}$/.test(id)) throw errors.badRequest('Check-in id is not valid.');
  const input = await body(c, upsertCheckinSchema);
  const d = db(c);
  const me = c.get('user');

  const ch = await d.select().from(challenges).where(eq(challenges.id, input.challengeId)).get();
  if (!ch) throw errors.notFound('That challenge');
  const { squad } = await requireMember(d, ch.squadId, me.id);
  if (ch.status !== 'active')
    throw errors.conflict('CHALLENGE_NOT_ACTIVE', 'This challenge has ended.');

  if (!isWithinCheckinWindow(input.localDate, new Date(), input.timezone)) {
    throw errors.conflict(
      'CHECKIN_WINDOW_CLOSED',
      'You can check in for today, or for yesterday until midnight tonight.',
    );
  }
  const dayNumber = rawDayNumber(input.localDate, ch.startDate);
  if (dayNumber < 1 || dayNumber > ch.durationDays) {
    throw errors.conflict('CHECKIN_DAY_OUT_OF_RANGE', 'That date isn’t part of this challenge.');
  }
  assertClean(input.note);

  const byId = await d.select().from(checkins).where(eq(checkins.id, id)).get();
  if (
    byId &&
    (byId.userId !== me.id || byId.challengeId !== ch.id || byId.localDate !== input.localDate)
  ) {
    throw errors.forbidden('That check-in belongs to a different day.');
  }
  const existing =
    byId ??
    (await d
      .select()
      .from(checkins)
      .where(
        and(
          eq(checkins.challengeId, ch.id),
          eq(checkins.userId, me.id),
          eq(checkins.localDate, input.localDate),
        ),
      )
      .get());

  const day = await effectiveDay(c.env, d, ch, dayNumber);
  const tasks = applyPersonalTargets(day.tasks, input.targets, squad.allowPersonalTargets);
  const values = input.values.filter((v) => v.t < tasks.length);
  const { status, completed, fraction } = computeCheckinStatus(
    tasks,
    values,
    input.honestMiss === true,
  );
  const done = countsAsDone(status, fraction, squad.partialCounts);

  let photoKey: string | null = existing?.photoKey ?? null;
  if (input.photoKey !== undefined) {
    if (input.photoKey === null) {
      photoKey = null;
    } else {
      const canShare = photoRetentionDays(await userPlan(d, me.id), isSquadPro(squad)) > 0;
      const expectedPrefix = new RegExp(
        `^proof-(30|90)d/${me.id}/${existing?.id ?? id}\\.(jpg|webp)$`,
      );
      if (!canShare || !expectedPrefix.test(input.photoKey))
        throw errors.forbidden('Photo proof can’t be shared on your plan.');
      photoKey = input.photoKey;
    }
  }
  const verified = (input.verified ?? []).filter((i) => i < tasks.length && tasks[i]?.verify);
  const ts = nowIso();
  const fields = {
    dayNumber,
    status,
    countsDone: done,
    tasksDone: completed,
    values: JSON.stringify(values),
    note: input.note ?? null,
    hasPhoto: input.hasPhoto ?? Boolean(photoKey),
    photoKey,
    verified: JSON.stringify(verified),
    updatedAt: ts,
  };

  if (existing) {
    await d
      .update(checkins)
      .set({ ...fields, edited: true })
      .where(eq(checkins.id, existing.id))
      .run();
  } else {
    await d
      .insert(checkins)
      .values({
        id,
        challengeId: ch.id,
        userId: me.id,
        localDate: input.localDate,
        ...fields,
        createdAt: ts,
      })
      .onConflictDoUpdate({
        target: [checkins.challengeId, checkins.userId, checkins.localDate],
        set: { ...fields, edited: true },
      })
      .run();
  }
  const row = await d
    .select()
    .from(checkins)
    .where(
      and(
        eq(checkins.challengeId, ch.id),
        eq(checkins.userId, me.id),
        eq(checkins.localDate, input.localDate),
      ),
    )
    .get();

  const today = localDateInZone(new Date(), input.timezone);
  const challengeStreak = await recomputeChallengeStreak(d, ch, me.id, today);
  const globalStreak = await recomputeGlobalStreak(d, me.id, today);
  const earned = await awardBadges(d, me.id, { currentStreak: globalStreak.state.current });
  for (const badge of earned) await addNotification(d, me.id, 'badge', { badge });

  const reacted = await d
    .select({ x: reactions.userId })
    .from(reactions)
    .where(and(eq(reactions.checkinId, row!.id), eq(reactions.userId, me.id)))
    .get();
  return c.json({
    checkin: toCheckin(row!, {
      reactedByMe: Boolean(reacted),
      photoUrl: await photoUrlFor(c.env, row!),
    }),
    streak: {
      ...toStreak({ userId: me.id, scope: ch.id, ...challengeStreak.state, updatedAt: ts }),
    },
    globalStreak: toStreak({
      userId: me.id,
      scope: 'global',
      ...globalStreak.state,
      updatedAt: ts,
    }),
    newBadges: earned,
  });
});

checkinRoutes.get('/:id', async (c) => {
  const d = db(c);
  const me = c.get('user');
  const { row } = await loadCheckin(d, c.req.param('id'), me.id);
  const author = await d.select().from(user).where(eq(user.id, row.userId)).get();
  const reacted = await d
    .select({ x: reactions.userId })
    .from(reactions)
    .where(and(eq(reactions.checkinId, row.id), eq(reactions.userId, me.id)))
    .get();
  return c.json({
    checkin: toCheckin(row, {
      reactedByMe: Boolean(reacted),
      photoUrl: await photoUrlFor(c.env, row),
    }),
    author: author
      ? {
          id: author.id,
          username: author.username,
          displayName: author.displayName || author.name,
          avatarColor: author.avatarColor,
        }
      : null,
  });
});

async function setReaction(c: Parameters<typeof db>[0], on: boolean) {
  const d = db(c);
  const me = c.get('user');
  const { row, squad } = await loadCheckin(d, c.req.param('id')!, me.id);
  if (on) {
    await d
      .insert(reactions)
      .values({ checkinId: row.id, userId: me.id, kind: 'fire' })
      .onConflictDoNothing()
      .run();
  } else {
    await d
      .delete(reactions)
      .where(
        and(
          eq(reactions.checkinId, row.id),
          eq(reactions.userId, me.id),
          eq(reactions.kind, 'fire'),
        ),
      )
      .run();
  }
  await d
    .update(checkins)
    .set({
      reactionCount: sql`(select count(*) from ${reactions} where ${reactions.checkinId} = ${row.id})`,
      updatedAt: nowIso(),
    })
    .where(eq(checkins.id, row.id))
    .run();
  const fresh = await d
    .select({ n: checkins.reactionCount })
    .from(checkins)
    .where(eq(checkins.id, row.id))
    .get();
  if (on && row.userId !== me.id && (fresh?.n ?? 0) > 0) {
    const actor = await d.select().from(user).where(eq(user.id, me.id)).get();
    await notifyFires(d, row.userId, {
      checkinId: row.id,
      squadId: squad.id,
      squadName: squad.name,
      name: actor ? displayNameOf(actor) : '',
      count: fresh?.n ?? 0,
    });
  }
  return c.json({ reactionCount: fresh?.n ?? 0, reactedByMe: on });
}

checkinRoutes.put('/:id/reactions/fire', (c) => setReaction(c, true));
checkinRoutes.delete('/:id/reactions/fire', (c) => setReaction(c, false));

checkinRoutes.get('/:id/comments', async (c) => {
  const d = db(c);
  const me = c.get('user');
  const { row } = await loadCheckin(d, c.req.param('id'), me.id);
  const blocked = new Set(await blockedByMe(d, me.id));
  const rows = await d
    .select()
    .from(comments)
    .innerJoin(user, eq(user.id, comments.userId))
    .where(
      and(
        eq(comments.checkinId, row.id),
        isNull(comments.hiddenAt),
        gt(comments.expiresAt, nowIso()),
      ),
    )
    .orderBy(asc(comments.createdAt))
    .all();
  return c.json({
    comments: rows
      .filter((r) => !blocked.has(r.comments.userId))
      .map((r) => toComment(r.comments, r.user)),
  });
});

checkinRoutes.post('/:id/comments', async (c) => {
  const input = await body(c, commentSchema);
  if (input.body.length > TEXT_LIMITS.comment)
    throw errors.badRequest('Comments are 140 characters at most.');
  const d = db(c);
  const me = c.get('user');
  const { row, squad } = await loadCheckin(d, c.req.param('id'), me.id);
  assertClean(input.body);
  const tz =
    (await d.select({ tz: user.timezone }).from(user).where(eq(user.id, me.id)).get())?.tz ?? 'UTC';
  const ok = await takeUsage(
    d,
    me.id,
    localDateInZone(new Date(), tz),
    'comment',
    HARD_CAPS.commentsPerUserPerDay,
  );
  if (!ok) {
    throw new ApiError(
      429,
      'LIMIT_COMMENTS_PER_DAY',
      'You’ve reached 20 comments today. You can comment again tomorrow.',
    );
  }
  const retention = commentRetentionDays(await userPlan(d, me.id), isSquadPro(squad));
  const now = new Date();
  const comment = {
    id: ulid(),
    checkinId: row.id,
    userId: me.id,
    body: input.body,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + retention * 86_400_000).toISOString(),
  };
  await d.batch([
    d.insert(comments).values(comment),
    d
      .update(checkins)
      .set({ commentCount: sql`${checkins.commentCount} + 1`, updatedAt: comment.createdAt })
      .where(eq(checkins.id, row.id)),
  ]);
  const author = await d.select().from(user).where(eq(user.id, me.id)).get();
  if (row.userId !== me.id) {
    await addNotificationIf(d, row.userId, 'notifyComments', 'comment', {
      checkinId: row.id,
      squadId: squad.id,
      squadName: squad.name,
      name: author ? displayNameOf(author) : '',
      body: input.body.slice(0, 80),
    });
  }
  return c.json(toComment({ ...comment, hiddenAt: null }, author!), 201);
});

commentRoutes.delete('/:id', async (c) => {
  const d = db(c);
  const me = c.get('user');
  const cm = await d
    .select()
    .from(comments)
    .where(eq(comments.id, c.req.param('id')))
    .get();
  if (!cm) throw errors.notFound('That comment');
  const { member } = await loadCheckin(d, cm.checkinId, me.id);
  if (cm.userId !== me.id && member.role === 'member')
    throw errors.forbidden('You can only delete your own comments.');
  await d.batch([
    d.delete(comments).where(eq(comments.id, cm.id)),
    d
      .update(checkins)
      .set({ commentCount: sql`max(${checkins.commentCount} - 1, 0)`, updatedAt: nowIso() })
      .where(eq(checkins.id, cm.checkinId)),
  ]);
  return c.json({ ok: true });
});
