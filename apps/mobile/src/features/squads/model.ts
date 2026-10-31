import {
  addDays,
  challengePhase,
  compareLocalDates,
  rawDayNumber,
  type ChallengeDTO,
  type CheckinDTO,
  type LocalDate,
  type Plan,
  type PlanDay,
  type PlanMilestone,
  type PlanPhase,
  type Role,
} from '@sparksquad/shared';
import type { DayState, StripDay } from '../../components/ui';
import { effectiveDay } from '../../lib/plans';
import { todayFor } from '../today/model';
import type { SquadMember, SquadSource } from './source';

export const canManage = (role: Role | null): boolean => role === 'owner' || role === 'admin';

export function dayOfChallenge(ch: ChallengeDTO, date: LocalDate): number {
  return Math.min(Math.max(rawDayNumber(date, ch.startDate), 1), ch.durationDays);
}

export function dayFromSource(src: Pick<SquadSource, 'plan' | 'edits'>, n: number): PlanDay | null {
  return src.plan ? effectiveDay(src.plan, src.edits, n) : null;
}

/** True for plan rest days (they never break a run). */
export function restChecker(src: Pick<SquadSource, 'plan' | 'edits' | 'challenge'>) {
  const ch = src.challenge;
  return (date: LocalDate): boolean => {
    if (!ch) return false;
    const n = rawDayNumber(date, ch.startDate);
    return n >= 1 && n <= ch.durationDays && !!dayFromSource(src, n)?.rest;
  };
}

/** Statuses that count as "showed up" for a run (honest misses don't extend runs). */
const extendsRun = (c: CheckinDTO) => c.status !== 'honest_miss';

/**
 * Current run per member from locally synced check-ins (others are kept 14 days), walking back
 * from today (or yesterday if today isn't in yet); rest days are skipped, not broken.
 */
export function currentRuns(
  checkins: readonly CheckinDTO[],
  today: LocalDate,
  isRest: (date: LocalDate) => boolean = () => false,
  maxDays = 14,
): Map<string, number> {
  const byUser = new Map<string, Set<LocalDate>>();
  for (const c of checkins) {
    if (!extendsRun(c)) continue;
    const set = byUser.get(c.userId) ?? new Set<LocalDate>();
    set.add(c.localDate);
    byUser.set(c.userId, set);
  }
  const out = new Map<string, number>();
  for (const [userId, dates] of byUser) {
    let day = dates.has(today) ? today : addDays(today, -1);
    let run = 0;
    for (let i = 0; i < maxDays; i++) {
      if (dates.has(day)) run += 1;
      else if (!isRest(day)) break;
      day = addDays(day, -1);
    }
    out.set(userId, run);
  }
  return out;
}

export interface BoardMember {
  id: string;
  name: string;
  avatarColor: number;
  checked: boolean;
  isMe: boolean;
}

export interface FeedItem {
  checkin: CheckinDTO;
  author: BoardMember;
  pending: boolean;
  tasksTotal: number;
  tasksDone: number;
}

export interface Board {
  today: LocalDate;
  state: 'none' | 'upcoming' | 'running' | 'finished';
  dayNumber: number;
  day: PlanDay | null;
  grid: BoardMember[];
  checkedCount: number;
  stillToCheckIn: (BoardMember & { nudged: boolean })[];
  feed: FeedItem[];
}

function tasksDone(c: CheckinDTO, day: PlanDay | null): number {
  if (!day)
    return c.values.filter((v) => v.v === true || (typeof v.v === 'number' && v.v > 0)).length;
  return day.tasks.reduce((n, task, i) => {
    const v = c.values.find((x) => x.t === i)?.v;
    if (task.type === 'check') return n + (v === true ? 1 : 0);
    return n + (typeof v === 'number' && v >= (task.target ?? 1) ? 1 : 0);
  }, 0);
}

/** C2: "6/9 showed up today", member grid, still to check in, today's feed. */
export function buildBoard(src: SquadSource, now: Date): Board {
  const today = todayFor(src.me, now);
  const ch = src.challenge;
  const phase = ch ? challengePhase(today, ch.startDate, ch.durationDays) : null;
  const state = !ch
    ? 'none'
    : phase === 'running'
      ? 'running'
      : phase === 'upcoming'
        ? 'upcoming'
        : 'finished';
  const n = ch ? dayOfChallenge(ch, today) : 0;
  const day = ch ? dayFromSource(src, n) : null;

  const todays = src.checkins.filter((c) => c.localDate === today);
  const checked = new Set(todays.map((c) => c.userId));
  const toMember = (m: SquadMember): BoardMember => ({
    id: m.userId,
    name: m.name,
    avatarColor: m.avatarColor,
    checked: checked.has(m.userId),
    isMe: m.userId === src.me.id,
  });
  const all = src.members.map(toMember);
  const others = all.filter((m) => !m.isMe);
  const me = all.find((m) => m.isMe);
  const grid = [
    ...others.filter((m) => m.checked),
    ...(me ? [me] : []),
    ...others.filter((m) => !m.checked),
  ];
  const byId = new Map(all.map((m) => [m.id, m]));

  const restToday = !!day?.rest;
  const stillToCheckIn =
    state === 'running' && !restToday
      ? others.filter((m) => !m.checked).map((m) => ({ ...m, nudged: src.nudgedToday.has(m.id) }))
      : [];

  const feed = todays
    .map((c): FeedItem | null => {
      const author = byId.get(c.userId);
      if (!author) return null;
      return {
        checkin: c,
        author,
        pending: src.pendingIds.has(c.id),
        tasksTotal: day?.tasks.length ?? c.values.length,
        tasksDone: tasksDone(c, day),
      };
    })
    .filter((f): f is FeedItem => f !== null)
    .sort((a, b) => b.checkin.updatedAt.localeCompare(a.checkin.updatedAt));

  return {
    today,
    state,
    dayNumber: n,
    day,
    grid,
    checkedCount: all.filter((m) => m.checked).length,
    stillToCheckIn,
    feed,
  };
}

/* ---------- Plan segment (C4) ---------- */

export interface PhaseInfo {
  index: number;
  total: number;
  phase: PlanPhase;
  progress: number;
}

export function phaseFor(plan: Plan, n: number): PhaseInfo | null {
  const i = plan.phases.findIndex((p) => n >= p.from_day && n <= p.to_day);
  if (i < 0) return null;
  const p = plan.phases[i]!;
  const span = p.to_day - p.from_day + 1;
  return {
    index: i + 1,
    total: plan.phases.length,
    phase: p,
    progress: (n - p.from_day + 1) / span,
  };
}

export function nextMilestone(plan: Plan, n: number): PlanMilestone | null {
  return [...plan.milestones].sort((a, b) => a.day - b.day).find((m) => m.day >= n) ?? null;
}

const WEEKDAY = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** One-letter weekday for a local date (Monday first). */
export function weekdayLetter(date: LocalDate): string {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay();
  return WEEKDAY[(d + 6) % 7]!;
}

/**
 * Day tiles for the whole plan. Days before the locally synced range show as `past`
 * (we don't know), never as missed.
 */
export function planStrip(
  src: Pick<SquadSource, 'plan' | 'edits' | 'checkins' | 'me' | 'challenge' | 'squad'>,
  today: LocalDate,
  syncedFrom: LocalDate,
): StripDay[] {
  const ch = src.challenge;
  if (!ch || !src.plan) return [];
  const mine = new Map(
    src.checkins.filter((c) => c.userId === src.me.id).map((c) => [c.localDate, c]),
  );
  const out: StripDay[] = [];
  for (let n = 1; n <= ch.durationDays; n++) {
    const date = addDays(ch.startDate, n - 1);
    const day = effectiveDay(src.plan, src.edits, n);
    const c = mine.get(date);
    let state: DayState;
    const cmp = compareLocalDates(date, today);
    if (cmp === 0) state = 'today';
    else if (cmp > 0) state = day?.rest ? 'rest' : 'future';
    else if (day?.rest) state = 'rest';
    else if (c && c.status !== 'honest_miss') state = 'done';
    else if (compareLocalDates(date, syncedFrom) < 0 && !c) state = 'past';
    else state = 'missed';
    out.push({ n, weekday: weekdayLetter(date), state });
  }
  return out;
}

/** Day editing is allowed for future days only (DAY_LOCKED on the server). */
export function canEditDay(ch: ChallengeDTO, n: number, today: LocalDate): boolean {
  return compareLocalDates(addDays(ch.startDate, n - 1), today) > 0;
}
