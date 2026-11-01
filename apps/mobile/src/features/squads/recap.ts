import { addDays, compareLocalDates, type LocalDate } from '@sparksquad/shared';
import { currentRuns, restChecker } from './model';
import type { SquadSource } from './source';

export interface WeeklyRecap {
  from: LocalDate;
  to: LocalDate;
  /** Check-ins that count as showing up (honest misses don't). */
  checkins: number;
  /** Members who showed up at least once this week. */
  activeMembers: number;
  totalMembers: number;
  /** Days on which every member showed up. */
  perfectDays: number;
  /** Member who showed up the most, when anyone did. */
  top: { name: string; days: number } | null;
  /** Longest running streak right now. */
  bestStreak: { name: string; days: number } | null;
}

/** Sunday: the app offers this week's recap card. */
export function isRecapDay(date: LocalDate): boolean {
  return new Date(`${date}T12:00:00Z`).getUTCDay() === 0;
}

const firstName = (name: string) => name.split(' ')[0] || name;

/** The 7 days ending today, from check-ins already on this phone (sync keeps 14 days). */
export function buildWeeklyRecap(src: SquadSource, today: LocalDate): WeeklyRecap | null {
  const ch = src.challenge;
  if (!ch) return null;
  const weekStart = addDays(today, -6);
  const from = compareLocalDates(ch.startDate, weekStart) > 0 ? ch.startDate : weekStart;
  const names = new Map(src.members.map((m) => [m.userId, firstName(m.name)]));
  const week = src.checkins.filter(
    (c) =>
      c.status !== 'honest_miss' &&
      names.has(c.userId) &&
      compareLocalDates(c.localDate, from) >= 0 &&
      compareLocalDates(c.localDate, today) <= 0,
  );

  const daysByMember = new Map<string, number>();
  const membersByDay = new Map<LocalDate, Set<string>>();
  for (const c of week) {
    daysByMember.set(c.userId, (daysByMember.get(c.userId) ?? 0) + 1);
    const day = membersByDay.get(c.localDate) ?? new Set<string>();
    day.add(c.userId);
    membersByDay.set(c.localDate, day);
  }
  const best = (entries: Iterable<[string, number]>) => {
    const [winner] = [...entries]
      .filter(([, n]) => n > 0)
      .map(([id, days]) => ({ name: names.get(id) ?? '', days }))
      .filter((x) => x.name)
      .sort((a, b) => b.days - a.days || a.name.localeCompare(b.name));
    return winner ?? null;
  };

  return {
    from,
    to: today,
    checkins: week.length,
    activeMembers: daysByMember.size,
    totalMembers: src.members.length,
    perfectDays: [...membersByDay.values()].filter((d) => d.size === src.members.length).length,
    top: best(daysByMember),
    bestStreak: best(currentRuns(src.checkins, today, restChecker(src))),
  };
}
