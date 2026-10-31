import { HARD_CAPS, addDays, endDate, localDateInZone, localHour } from '@sparksquad/shared';
import { and, eq, inArray, isNotNull, isNull, like, lt, sql } from 'drizzle-orm';
import { createDb, type Db } from '../db/client';
import {
  challenges,
  checkins,
  comments,
  notifications,
  nudges,
  session,
  squadMembers,
  squads,
  usageCounters,
  user,
  verification,
} from '../db/schema';
import type { Bindings } from '../env';
import { addNotification, sendPush } from '../services/notify';
import { recomputeChallengeStreak, recomputeGlobalStreak } from '../services/streaks';
import { finishChallenge } from './rollup';

export const STREAK_HOUR = 1;
export const MORNING_DIGEST_HOUR = 9;
export const EVENING_DIGEST_HOUR = 18;

const DIGEST_KINDS = [
  'join_request',
  'request_approved',
  'announcement',
  'milestone',
  'challenge_ended',
  'badge',
  'role_changed',
];

async function usersInTimezones(db: Db, zones: string[]) {
  if (zones.length === 0) return [];
  return db
    .select({ id: user.id, timezone: user.timezone })
    .from(user)
    .where(and(inArray(user.timezone, zones), isNull(user.deletedAt), isNull(user.suspendedAt)))
    .all();
}

async function activeChallengesFor(db: Db, userId: string) {
  return db
    .select({ ch: challenges })
    .from(squadMembers)
    .innerJoin(challenges, eq(challenges.squadId, squadMembers.squadId))
    .where(
      and(
        eq(squadMembers.userId, userId),
        eq(squadMembers.status, 'active'),
        eq(challenges.status, 'active'),
      ),
    )
    .all();
}

/** Local hour 1: settle yesterday (freezes / resets) and tell people when a freeze saved them. */
async function settleStreaks(db: Db, zones: string[], now: Date): Promise<void> {
  for (const u of await usersInTimezones(db, zones)) {
    const today = localDateInZone(now, u.timezone);
    const yesterday = addDays(today, -1);
    for (const { ch } of await activeChallengesFor(db, u.id)) {
      if (ch.startDate > today) continue;
      const r = await recomputeChallengeStreak(db, ch, u.id, today);
      if (r.events.some((e) => e.kind === 'freeze_used' && e.date === yesterday)) {
        await addNotification(db, u.id, 'freeze_used', {
          challengeId: ch.id,
          squadId: ch.squadId,
          title: ch.title,
          streak: r.state.current,
        });
      }
    }
    await recomputeGlobalStreak(db, u.id, today);
  }
}

async function morningDigest(env: Bindings, db: Db, zones: string[], now: Date): Promise<void> {
  const since = new Date(now.getTime() - 24 * 3600_000).toISOString();
  for (const u of await usersInTimezones(db, zones)) {
    const row = await db
      .select({ n: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, u.id),
          isNull(notifications.readAt),
          inArray(notifications.kind, DIGEST_KINDS),
          sql`${notifications.createdAt} > ${since}`,
        ),
      )
      .get();
    const n = row?.n ?? 0;
    if (n === 0) continue;
    await sendPush(
      env,
      db,
      [u.id],
      {
        title: 'SparkSquad',
        body: n === 1 ? 'You have 1 squad update.' : `You have ${n} squad updates.`,
        data: { type: 'inbox' },
      },
      'digest',
    );
  }
}

async function eveningDigest(env: Bindings, db: Db, zones: string[], now: Date): Promise<void> {
  for (const u of await usersInTimezones(db, zones)) {
    const today = localDateInZone(now, u.timezone);
    for (const { ch } of await activeChallengesFor(db, u.id)) {
      if (ch.startDate > today || endDate(ch.startDate, ch.durationDays) < today) continue;
      const mine = await db
        .select({ id: checkins.id })
        .from(checkins)
        .where(
          and(
            eq(checkins.challengeId, ch.id),
            eq(checkins.userId, u.id),
            eq(checkins.localDate, today),
          ),
        )
        .get();
      if (mine) continue;
      const done = await db
        .select({ n: sql<number>`count(*)` })
        .from(checkins)
        .where(and(eq(checkins.challengeId, ch.id), eq(checkins.localDate, today)))
        .get();
      const sq = await db
        .select({ count: squads.memberCount, name: squads.name })
        .from(squads)
        .where(eq(squads.id, ch.squadId))
        .get();
      if (!sq || (done?.n ?? 0) === 0) continue;
      await sendPush(
        env,
        db,
        [u.id],
        {
          title: ch.title,
          body: `${done?.n ?? 0} of ${sq.count} in ${sq.name} checked in. You’re next.`,
          data: { type: 'digest', challengeId: ch.id, squadId: ch.squadId },
        },
        'digest',
      );
      break; // one evening digest per user
    }
  }
}

/** Ends challenges once every timezone's backfill window has closed. */
async function endFinishedChallenges(env: Bindings, db: Db, now: Date): Promise<void> {
  const utcToday = localDateInZone(now, 'UTC');
  const active = await db.select().from(challenges).where(eq(challenges.status, 'active')).all();
  for (const ch of active) {
    if (addDays(endDate(ch.startDate, ch.durationDays), 2) < utcToday)
      await finishChallenge(env, db, ch);
  }
}

async function expireData(db: Db, now: Date): Promise<void> {
  const nowIso = now.toISOString();
  const expired = await db
    .select({ checkinId: comments.checkinId })
    .from(comments)
    .where(lt(comments.expiresAt, nowIso))
    .all();
  if (expired.length > 0) {
    await db.delete(comments).where(lt(comments.expiresAt, nowIso)).run();
    const ids = [...new Set(expired.map((e) => e.checkinId))];
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      await db
        .update(checkins)
        .set({
          commentCount: sql`(select count(*) from ${comments} where ${comments.checkinId} = ${checkins.id})`,
        })
        .where(inArray(checkins.id, chunk))
        .run();
    }
  }
  const days = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();
  await db
    .delete(notifications)
    .where(lt(notifications.createdAt, days(HARD_CAPS.notificationRetentionDays)))
    .run();
  await db
    .delete(usageCounters)
    .where(lt(usageCounters.day, days(3).slice(0, 10)))
    .run();
  await db
    .delete(nudges)
    .where(lt(nudges.createdAt, days(3)))
    .run();
  // Photo objects expire by R2 lifecycle rules; drop the dangling keys.
  await db
    .update(checkins)
    .set({ photoKey: null })
    .where(
      and(
        isNotNull(checkins.photoKey),
        like(checkins.photoKey, 'proof-30d/%'),
        lt(checkins.createdAt, days(30)),
      ),
    )
    .run();
  await db
    .update(checkins)
    .set({ photoKey: null })
    .where(and(isNotNull(checkins.photoKey), lt(checkins.createdAt, days(90))))
    .run();
  // Raw check-ins of free squads go 60 days after the challenge ended (roll-ups stay).
  const old = await db
    .select({ id: challenges.id })
    .from(challenges)
    .innerJoin(squads, eq(squads.id, challenges.squadId))
    .where(
      and(
        eq(challenges.status, 'ended'),
        lt(challenges.endedAt, days(HARD_CAPS.rawCheckinRetentionAfterEndDays)),
        eq(squads.isPro, false),
      ),
    )
    .all();
  if (old.length > 0) {
    await db
      .delete(checkins)
      .where(
        inArray(
          checkins.challengeId,
          old.map((o) => o.id),
        ),
      )
      .run();
  }
  await db.delete(session).where(lt(session.expiresAt, now)).run();
  await db.delete(verification).where(lt(verification.expiresAt, now)).run();
}

export async function runHourly(env: Bindings, now: Date = new Date()): Promise<void> {
  const db = createDb(env.DB);
  const zones = (await db.selectDistinct({ tz: user.timezone }).from(user).all()).map((r) => r.tz);
  const at = (hour: number) => zones.filter((tz) => localHour(now, tz) === hour);

  const steps: [string, () => Promise<void>][] = [
    ['streaks', () => settleStreaks(db, at(STREAK_HOUR), now)],
    ['morning', () => morningDigest(env, db, at(MORNING_DIGEST_HOUR), now)],
    ['evening', () => eveningDigest(env, db, at(EVENING_DIGEST_HOUR), now)],
    ['end', () => endFinishedChallenges(env, db, now)],
    ['expire', () => expireData(db, now)],
  ];
  for (const [name, step] of steps) {
    try {
      await step();
    } catch (e) {
      console.error(`cron step ${name} failed`, e instanceof Error ? e.message : 'unknown');
    }
  }
}
