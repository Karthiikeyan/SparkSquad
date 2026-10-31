import {
  TIER_LIMITS,
  addDays,
  applyDayOutcome,
  dateRange,
  diffDays,
  endDate,
  newBadges,
  type BadgeId,
  type DayOutcome,
  type LocalDate,
  type StreakEvent,
  type StreakState,
  EMPTY_STREAK,
} from '@sparksquad/shared';
import { and, eq, gte, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import type { challenges } from '../db/schema';
import { badges, checkins, streaks } from '../db/schema';
import { userPlan } from './access';
import { restDaysOf } from './plans';

type ChallengeRow = typeof challenges.$inferSelect;

export const GLOBAL_SCOPE = 'global';
const GLOBAL_LOOKBACK_DAYS = 400;

function replay(
  dates: LocalDate[],
  outcomeFor: (d: LocalDate) => DayOutcome,
  maxFreezes: number,
): { state: StreakState; events: StreakEvent[] } {
  let state = EMPTY_STREAK;
  const events: StreakEvent[] = [];
  for (const d of dates) {
    const r = applyDayOutcome(state, d, outcomeFor(d), maxFreezes);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
}

async function saveStreak(
  db: Db,
  userId: string,
  scope: string,
  state: StreakState,
): Promise<void> {
  const ts = new Date().toISOString();
  const existing = await db
    .select()
    .from(streaks)
    .where(and(eq(streaks.userId, userId), eq(streaks.scope, scope)))
    .get();
  if (
    existing &&
    existing.current === state.current &&
    existing.best === state.best &&
    existing.freezes === state.freezes &&
    existing.lastDoneDate === state.lastDoneDate
  ) {
    return;
  }
  await db
    .insert(streaks)
    .values({ userId, scope, ...state, updatedAt: ts })
    .onConflictDoUpdate({
      target: [streaks.userId, streaks.scope],
      set: { ...state, updatedAt: ts },
    })
    .run();
}

/**
 * Recomputes a member's streak for one challenge by replaying their check-ins.
 * Today counts as pending until checked in; yesterday can still be backfilled (replay refunds the freeze).
 */
export async function recomputeChallengeStreak(
  db: Db,
  ch: ChallengeRow,
  userId: string,
  today: LocalDate,
): Promise<{ state: StreakState; events: StreakEvent[] }> {
  const plan = await userPlan(db, userId);
  const rows = await db
    .select({
      localDate: checkins.localDate,
      countsDone: checkins.countsDone,
      status: checkins.status,
    })
    .from(checkins)
    .where(and(eq(checkins.challengeId, ch.id), eq(checkins.userId, userId)))
    .all();
  const byDate = new Map(rows.map((r) => [r.localDate, r]));
  const rest = restDaysOf(ch);
  const last = endDate(ch.startDate, ch.durationDays);
  const until = today < last ? today : last;
  const dates = until >= ch.startDate ? dateRange(ch.startDate, until) : [];
  const result = replay(
    dates,
    (d) => {
      const dayNum = diffDays(ch.startDate, d) + 1;
      const row = byDate.get(d);
      if (row?.countsDone) return 'done';
      if (rest.has(dayNum)) return 'rest';
      if (row?.status === 'honest_miss') return d === today ? 'pending' : 'honest_miss';
      return d === today ? 'pending' : 'missed';
    },
    TIER_LIMITS[plan].freezesBanked,
  );
  await saveStreak(db, userId, ch.id, result.state);
  return result;
}

/** Global profile streak: any check-in on a day counts. */
export async function recomputeGlobalStreak(
  db: Db,
  userId: string,
  today: LocalDate,
): Promise<{ state: StreakState; events: StreakEvent[] }> {
  const plan = await userPlan(db, userId);
  const since = addDays(today, -GLOBAL_LOOKBACK_DAYS);
  const rows = await db
    .selectDistinct({ localDate: checkins.localDate })
    .from(checkins)
    .where(and(eq(checkins.userId, userId), gte(checkins.localDate, since)))
    .all();
  const days = new Set(rows.map((r) => r.localDate));
  const first = [...days].sort()[0];
  const dates = first && first <= today ? dateRange(first, today) : [];
  const result = replay(
    dates,
    (d) => (days.has(d) ? 'done' : d === today ? 'pending' : 'missed'),
    TIER_LIMITS[plan].freezesBanked,
  );
  await saveStreak(db, userId, GLOBAL_SCOPE, result.state);
  return result;
}

/** Awards first check-in and streak badges; returns the newly earned ones. */
export async function awardBadges(
  db: Db,
  userId: string,
  facts: { currentStreak: number; challengeCompleted?: boolean },
): Promise<BadgeId[]> {
  const owned = await db
    .select({ badge: badges.badge })
    .from(badges)
    .where(eq(badges.userId, userId))
    .all();
  const total = await db
    .select({ n: sql<number>`count(*)` })
    .from(checkins)
    .where(eq(checkins.userId, userId))
    .get();
  const earned = newBadges(
    {
      totalCheckins: total?.n ?? 0,
      currentStreak: facts.currentStreak,
      challengeCompleted: facts.challengeCompleted ?? false,
    },
    new Set(owned.map((o) => o.badge as BadgeId)),
  );
  if (earned.length > 0) {
    await db
      .insert(badges)
      .values(earned.map((badge) => ({ userId, badge })))
      .onConflictDoNothing()
      .run();
  }
  return earned;
}
