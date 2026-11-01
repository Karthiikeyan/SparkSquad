import {
  addDays,
  challengePhase,
  compareLocalDates,
  isValidTimeZone,
  isWithinCheckinWindow,
  localDateInZone,
  rawDayNumber,
  restartOffer,
  type RestartOffer,
  type ChallengeDTO,
  type CheckinDTO,
  type LocalDate,
  type MeDTO,
  type Plan,
  type PlanDay,
  type SquadDTO,
  type StreakDTO,
} from '@sparksquad/shared';
import { effectiveDay } from '../../lib/plans';

export interface SourceUser {
  id: string;
  displayName: string;
  avatarColor: number;
}

/** Everything Today needs, read from the local store in one go. */
export interface TodaySource {
  me: MeDTO;
  squads: SquadDTO[];
  challenges: ChallengeDTO[];
  /** Active member ids per squad id. */
  members: Map<string, string[]>;
  users: Map<string, SourceUser>;
  plans: Map<string, Plan>;
  edits: Map<string, PlanDay[]>;
  /** Recent check-ins (the last week) for active challenges. */
  checkins: CheckinDTO[];
  pendingCheckinIds: Set<string>;
  streaks: StreakDTO[];
}

export interface CardMember {
  id: string;
  name: string;
  avatarColor: number;
  checked: boolean;
  isMe: boolean;
}

export type CardState = 'upcoming' | 'active' | 'finished';

export interface TodayCard {
  challenge: ChallengeDTO;
  squad: SquadDTO;
  state: CardState;
  today: LocalDate;
  dayNumber: number;
  /** Effective plan day for today; null while the plan downloads. */
  day: PlanDay | null;
  mine: CheckinDTO | null;
  minePending: boolean;
  members: CardMember[];
  checkedCount: number;
  /** "Steps card" variant: one count task verified by steps (design Main, card 2). */
  kind: 'tasks' | 'steps';
  /** Yesterday can still be checked in (B7). */
  backfill: { date: LocalDate; dayNumber: number } | null;
  /** Missed days and no freeze left: today can be a smaller restart day. */
  comeback: RestartOffer | null;
}

export function timeZoneOf(me: Pick<MeDTO, 'timezone'>): string {
  return isValidTimeZone(me.timezone) ? me.timezone : 'UTC';
}

/** The user's local date, from their (validated) timezone. */
export function todayFor(me: Pick<MeDTO, 'timezone'>, now: Date): LocalDate {
  return localDateInZone(now, timeZoneOf(me));
}

export function dayFor(src: Pick<TodaySource, 'plans' | 'edits'>, ch: ChallengeDTO, n: number) {
  const plan = src.plans.get(ch.planHash);
  return plan ? effectiveDay(plan, src.edits.get(ch.id) ?? [], n) : null;
}

export function buildTodayCards(src: TodaySource, now: Date): TodayCard[] {
  const today = todayFor(src.me, now);
  const tz = timeZoneOf(src.me);
  const squads = new Map(src.squads.map((s) => [s.id, s]));
  const cards: TodayCard[] = [];

  for (const ch of src.challenges) {
    if (ch.status !== 'active') continue;
    const squad = squads.get(ch.squadId);
    if (!squad) continue;
    const phase = challengePhase(today, ch.startDate, ch.durationDays);
    const state: CardState =
      phase === 'running' ? 'active' : phase === 'upcoming' ? 'upcoming' : 'finished';
    const n = Math.min(Math.max(rawDayNumber(today, ch.startDate), 1), ch.durationDays);
    const day = dayFor(src, ch, n);

    const todays = src.checkins.filter((c) => c.challengeId === ch.id && c.localDate === today);
    const checkedIds = new Set(todays.map((c) => c.userId));
    const mine = todays.find((c) => c.userId === src.me.id) ?? null;

    const others: CardMember[] = [];
    for (const id of src.members.get(squad.id) ?? []) {
      if (id === src.me.id) continue;
      const u = src.users.get(id);
      others.push({
        id,
        name: u?.displayName ?? '',
        avatarColor: u?.avatarColor ?? 0,
        checked: checkedIds.has(id),
        isMe: false,
      });
    }
    others.sort((a, b) => Number(b.checked) - Number(a.checked));
    const members: CardMember[] = [
      ...others,
      {
        id: src.me.id,
        name: src.me.displayName,
        avatarColor: src.me.avatarColor,
        checked: !!mine,
        isMe: true,
      },
    ];

    let backfill: TodayCard['backfill'] = null;
    const yesterday = addDays(today, -1);
    const yN = rawDayNumber(yesterday, ch.startDate);
    if (state !== 'upcoming' && yN >= 1 && yN <= ch.durationDays) {
      const hadYesterday = src.checkins.some(
        (c) => c.challengeId === ch.id && c.userId === src.me.id && c.localDate === yesterday,
      );
      const yDay = dayFor(src, ch, yN);
      if (!hadYesterday && !yDay?.rest && isWithinCheckinWindow(yesterday, now, tz)) {
        backfill = { date: yesterday, dayNumber: yN };
      }
    }

    const task0 = day?.tasks[0];
    const kind =
      day && day.tasks.length === 1 && task0?.type === 'count' && task0.verify === 'steps'
        ? 'steps'
        : 'tasks';

    cards.push({
      comeback:
        phase === 'running' && !mine && !day?.rest
          ? restartOffer({
              date: today,
              startDate: ch.startDate,
              current: src.streaks.find((x) => x.scope === ch.id)?.current ?? 0,
              lastDoneDate: src.streaks.find((x) => x.scope === ch.id)?.lastDoneDate ?? null,
              isRest: (date) => !!dayFor(src, ch, rawDayNumber(date, ch.startDate))?.rest,
              restartDates: src.checkins
                .filter((c) => c.challengeId === ch.id && c.userId === src.me.id && c.restart)
                .map((c) => c.localDate),
            })
          : null,
      challenge: ch,
      squad,
      state,
      today,
      dayNumber: n,
      day,
      mine,
      minePending: !!mine && src.pendingCheckinIds.has(mine.id),
      members,
      checkedCount: members.filter((m) => m.checked).length,
      kind,
      backfill,
    });
  }

  const rank = (c: TodayCard) =>
    c.state === 'active' ? (c.mine ? 1 : 0) : c.state === 'upcoming' ? 2 : 3;
  return cards.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      compareLocalDates(a.challenge.startDate, b.challenge.startDate) ||
      a.challenge.title.localeCompare(b.challenge.title),
  );
}

/** Cards the user can still check in for today (centre tab button, sheet picker). */
export function pendingCards(cards: readonly TodayCard[]): TodayCard[] {
  return cards.filter((c) => c.state === 'active' && !c.mine && c.day !== null && !c.day.rest);
}

export function globalStreak(streaks: readonly StreakDTO[]): StreakDTO | null {
  return streaks.find((s) => s.scope === 'global') ?? null;
}

/**
 * Streak to show right after a check-in, before the server's answer arrives. A gap since the
 * last done day was either covered by a freeze (current kept) or reset by the server (current 0).
 */
export function predictedStreak(
  streak: Pick<StreakDTO, 'current' | 'lastDoneDate'> | null,
  date: LocalDate,
  countsDone: boolean,
): number {
  const current = streak?.current ?? 0;
  if (!countsDone || streak?.lastDoneDate === date) return current;
  return current + 1;
}
