import { HARD_CAPS } from './limits';
import type { LocalDate } from './date';

/**
 * Outcome of one local day for one member:
 * - done: the day counts as done (status done, or partial meeting the squad rule)
 * - missed: no check-in, or a check-in that doesn't count as done
 * - honest_miss: "I couldn't today" — treated like a miss for the streak (freeze can save it)
 * - rest: rest/review day, never affects the streak
 * - pending: today, not checked in yet — no change
 */
export type DayOutcome = 'done' | 'missed' | 'honest_miss' | 'rest' | 'pending';

export interface StreakState {
  current: number;
  best: number;
  freezes: number;
  lastDoneDate: LocalDate | null;
}

export type StreakEvent =
  | { kind: 'freeze_earned'; date: LocalDate }
  | { kind: 'freeze_used'; date: LocalDate }
  | { kind: 'streak_reset'; date: LocalDate; lost: number };

export const EMPTY_STREAK: StreakState = { current: 0, best: 0, freezes: 0, lastDoneDate: null };

/** Apply one day's outcome. Pure; returns the new state and any events. */
export function applyDayOutcome(
  state: StreakState,
  date: LocalDate,
  outcome: DayOutcome,
  maxFreezes: number,
): { state: StreakState; events: StreakEvent[] } {
  const events: StreakEvent[] = [];
  const next: StreakState = { ...state, freezes: Math.min(state.freezes, maxFreezes) };
  switch (outcome) {
    case 'done': {
      next.current += 1;
      next.best = Math.max(next.best, next.current);
      next.lastDoneDate = date;
      if (next.current % HARD_CAPS.freezeEarnEveryDays === 0 && next.freezes < maxFreezes) {
        next.freezes += 1;
        events.push({ kind: 'freeze_earned', date });
      }
      break;
    }
    case 'missed':
    case 'honest_miss': {
      if (next.current === 0) break;
      if (next.freezes > 0) {
        next.freezes -= 1;
        events.push({ kind: 'freeze_used', date });
      } else {
        events.push({ kind: 'streak_reset', date, lost: next.current });
        next.current = 0;
      }
      break;
    }
    case 'rest':
    case 'pending':
      break;
  }
  return { state: next, events };
}

/** Replay a full ordered history of outcomes. */
export function replayStreak(
  days: readonly { date: LocalDate; outcome: DayOutcome }[],
  maxFreezes: number,
  initial: StreakState = EMPTY_STREAK,
): { state: StreakState; events: StreakEvent[] } {
  let state = initial;
  const events: StreakEvent[] = [];
  for (const d of days) {
    const r = applyDayOutcome(state, d.date, d.outcome, maxFreezes);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
}

export const BADGES = [
  'first_checkin',
  'streak_3',
  'streak_7',
  'streak_14',
  'streak_21',
  'streak_30',
  'streak_60',
  'streak_100',
  'checkins_10',
  'checkins_50',
  'checkins_100',
  'challenge_complete',
] as const;
export type BadgeId = (typeof BADGES)[number];

export const STREAK_BADGES: readonly { badge: BadgeId; days: number }[] = [
  { badge: 'streak_3', days: 3 },
  { badge: 'streak_7', days: 7 },
  { badge: 'streak_14', days: 14 },
  { badge: 'streak_21', days: 21 },
  { badge: 'streak_30', days: 30 },
  { badge: 'streak_60', days: 60 },
  { badge: 'streak_100', days: 100 },
];

/** Lifetime check-in milestones (honest misses count: showing up is the habit). */
export const COUNT_BADGES: readonly { badge: BadgeId; count: number }[] = [
  { badge: 'checkins_10', count: 10 },
  { badge: 'checkins_50', count: 50 },
  { badge: 'checkins_100', count: 100 },
];

/** Badges newly earned given the current facts and what the user already has. */
export function newBadges(
  facts: { totalCheckins: number; currentStreak: number; challengeCompleted: boolean },
  owned: ReadonlySet<BadgeId>,
): BadgeId[] {
  const earned: BadgeId[] = [];
  if (facts.totalCheckins >= 1) earned.push('first_checkin');
  for (const s of STREAK_BADGES) if (facts.currentStreak >= s.days) earned.push(s.badge);
  for (const c of COUNT_BADGES) if (facts.totalCheckins >= c.count) earned.push(c.badge);
  if (facts.challengeCompleted) earned.push('challenge_complete');
  return earned.filter((b) => !owned.has(b));
}

/** Progress towards a locked badge, 0..1. */
export function badgeProgress(
  badge: BadgeId,
  facts: { totalCheckins: number; bestStreak: number; challengesCompleted: number },
): number {
  if (badge === 'first_checkin') return Math.min(facts.totalCheckins, 1);
  if (badge === 'challenge_complete') return Math.min(facts.challengesCompleted, 1);
  const count = COUNT_BADGES.find((c) => c.badge === badge)?.count;
  if (count) return Math.min(facts.totalCheckins / count, 1);
  const days = STREAK_BADGES.find((s) => s.badge === badge)?.days ?? 1;
  return Math.min(facts.bestStreak / days, 1);
}
