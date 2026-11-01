import {
  addDays,
  BADGES,
  compareLocalDates,
  COUNT_BADGES,
  MOMENT_BADGES,
  diffDays,
  isoWeekday,
  startOfWeek,
  STREAK_BADGES,
  type BadgeDTO,
  type BadgeId,
  type CheckinDTO,
  type LocalDate,
} from '@sparksquad/shared';
import { t } from '../../i18n';

export const HEATMAP_WEEKS = 18;

/** Monday of the first heatmap column. */
export const heatmapStart = (today: LocalDate, weeks = HEATMAP_WEEKS): LocalDate =>
  addDays(startOfWeek(today), -7 * (weeks - 1));

type DayCheckin = Pick<CheckinDTO, 'localDate' | 'status'>;

/** Shown up = any check-in except an honest miss. */
const showedUp = (c: DayCheckin) => c.status !== 'honest_miss';

/**
 * 18 weeks × 7 days, column-major, Monday first, last column = this week.
 * 0 none · 1 only honest misses / partial · 2 one done · 3 two or more done.
 */
export function heatmapLevels(
  checkins: readonly DayCheckin[],
  today: LocalDate,
  weeks = HEATMAP_WEEKS,
): number[] {
  const byDay = new Map<LocalDate, number>();
  for (const c of checkins) {
    byDay.set(c.localDate, (byDay.get(c.localDate) ?? 0) + (c.status === 'done' ? 1 : 0));
  }
  const first = heatmapStart(today, weeks);
  const out: number[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const day = addDays(first, i);
    const done = compareLocalDates(day, today) > 0 ? undefined : byDay.get(day);
    out.push(levelFor(done));
  }
  return out;
}

const levelFor = (done: number | undefined): number =>
  done === undefined ? 0 : done >= 2 ? 3 : done === 1 ? 2 : 1;

/** Heat level for one day (same scale as the heatmap). */
export function dayLevel(checkins: readonly DayCheckin[], day: LocalDate): number {
  const mine = checkins.filter((c) => c.localDate === day);
  return levelFor(mine.length ? mine.filter((c) => c.status === 'done').length : undefined);
}

/**
 * Share of days shown up since `from` (capped to the heatmap window).
 * Today only counts once there's a check-in, so the number never drops in the morning.
 */
export function shownUpPercent(
  checkins: readonly DayCheckin[],
  today: LocalDate,
  from: LocalDate,
): number {
  const windowStart = addDays(today, -(HEATMAP_WEEKS * 7 - 1));
  const start = compareLocalDates(from, windowStart) > 0 ? from : windowStart;
  if (compareLocalDates(start, today) > 0) return 0;
  const days = new Set(
    checkins
      .filter((c) => showedUp(c) && c.localDate >= start && c.localDate <= today)
      .map((c) => c.localDate),
  );
  const elapsed = diffDays(start, today) + (days.has(today) ? 1 : 0);
  if (elapsed <= 0) return days.size > 0 ? 100 : 0;
  return Math.min(100, Math.round((days.size / elapsed) * 100));
}

export interface WeekStats {
  days: number;
  elapsed: number;
  tasks: number;
  streak: number;
}

export function weekStats(
  checkins: readonly (DayCheckin & { tasksDone: number })[],
  today: LocalDate,
  streak: number,
): WeekStats {
  const monday = startOfWeek(today);
  const week = checkins.filter((c) => c.localDate >= monday && c.localDate <= today && showedUp(c));
  return {
    days: new Set(week.map((c) => c.localDate)).size,
    elapsed: isoWeekday(today),
    tasks: week.reduce((n, c) => n + c.tasksDone, 0),
    streak,
  };
}

/** Template weekly recap (Free); also the input to the optional AI rewrite (Plus). */
export function recapText(s: WeekStats): string {
  if (s.days === 0) return t('recap.none');
  let text = t('recap.shown', { days: s.days, elapsed: s.elapsed });
  text += s.tasks > 0 ? t('recap.tasks', { tasks: s.tasks }) : t('recap.noTasks');
  if (s.streak > 1) text += t('recap.streak', { n: s.streak });
  if (s.days < s.elapsed) text += t('recap.nudge');
  return text;
}

export type BadgeGroup = 'streaks' | 'checkins' | 'milestones';

export interface BadgeRow {
  badge: BadgeId;
  label: string;
  earned: boolean;
  earnedAt: string | null;
  group: BadgeGroup;
  /** Days (streaks) or check-ins needed; null for one-off moments. */
  target: number | null;
  /** Progress towards `target`, capped at it. */
  current: number;
  /** Still needed for locked badges with a target. */
  toGo: number | null;
  /** A moment that stays a mystery until it happens. */
  secret: boolean;
}

/** Every badge: earned first (in catalogue order), then locked with what's left. */
export function badgeRows(
  owned: readonly BadgeDTO[],
  bestStreak: number,
  totalCheckins = 0,
): BadgeRow[] {
  const have = new Map(owned.map((b) => [b.badge, b.earnedAt]));
  const rows = BADGES.map((badge): BadgeRow => {
    const days = STREAK_BADGES.find((s) => s.badge === badge)?.days ?? null;
    const count = COUNT_BADGES.find((c) => c.badge === badge)?.count ?? null;
    const target = days ?? count;
    const value = days !== null ? bestStreak : totalCheckins;
    const earned = have.has(badge);
    return {
      badge,
      label: t(`badges.${badge}`),
      earned,
      earnedAt: have.get(badge) ?? null,
      group: days !== null ? 'streaks' : count !== null ? 'checkins' : 'milestones',
      target,
      current: target === null ? 0 : Math.min(value, target),
      toGo: target !== null && !earned ? Math.max(1, target - value) : null,
      secret: MOMENT_BADGES.includes(badge) && !earned,
    };
  });
  return [...rows.filter((r) => r.earned), ...rows.filter((r) => !r.earned)];
}

/** Your flame: the highest streak form reached, and the next one to grow into. */
export function flameState(rows: readonly BadgeRow[]): {
  current: BadgeRow | null;
  next: BadgeRow | null;
} {
  const line = rows
    .filter((r) => r.group === 'streaks')
    .sort((a, b) => (a.target ?? 0) - (b.target ?? 0));
  return {
    current: line.filter((r) => r.earned).at(-1) ?? null,
    next: line.find((r) => !r.earned) ?? null,
  };
}

/** Three badges for the profile: latest earned, then the closest locked ones. */
export function badgeStrip(rows: readonly BadgeRow[], size = 3): BadgeRow[] {
  const ratio = (r: BadgeRow) => (r.target ? r.current / r.target : 0);
  const locked = rows.filter((r) => !r.earned && !r.secret).sort((a, b) => ratio(b) - ratio(a));
  const earned = rows.filter((r) => r.earned);
  const take = Math.max(size - Math.min(locked.length, 1), size - locked.length);
  return [...earned.slice(-take), ...locked].slice(0, size);
}

/** The locked badge closest to being earned (by share done), for "Up next". */
export function nextBadge(rows: readonly BadgeRow[]): BadgeRow | null {
  const locked = rows.filter((r) => !r.earned && r.target !== null);
  if (locked.length === 0) return rows.find((r) => !r.earned && !r.secret) ?? null;
  return locked.reduce((best, r) =>
    r.current / (r.target ?? 1) > best.current / (best.target ?? 1) ? r : best,
  );
}

/** Month grid for F4: leading blanks so the 1st lands on its weekday (Monday first). */
export function monthGrid(year: number, month: number): (LocalDate | null)[] {
  const first = `${year}-${String(month).padStart(2, '0')}-01` as LocalDate;
  const lead = isoWeekday(first) - 1;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => addDays(first, i)),
  ];
}

/** Moves a {year, month} pair by `delta` months. */
export function shiftMonth(ym: { year: number; month: number }, delta: number) {
  const idx = ym.year * 12 + (ym.month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}
