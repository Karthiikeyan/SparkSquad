import {
  addDays,
  diffDays,
  endDate,
  localDateInZone,
  rankLeaderboard,
  startOfWeek,
  type LeaderboardInput,
  type LocalDate,
} from '@sparksquad/shared';
import { and, eq, gte, lte } from 'drizzle-orm';
import type { Db } from '../db/client';
import type { challenges } from '../db/schema';
import { checkins, squadMembers, user } from '../db/schema';
import { displayNameOf } from './dto';
import { restDaysOf } from './plans';

type ChallengeRow = typeof challenges.$inferSelect;
type UserLite = Pick<
  typeof user.$inferSelect,
  'id' | 'displayName' | 'name' | 'username' | 'avatarColor' | 'timezone'
>;

export interface RangeStats extends LeaderboardInput {
  user: UserLite;
}

function countNonRest(ch: ChallengeRow, rest: Set<number>, from: LocalDate, to: LocalDate): number {
  if (to < from) return 0;
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (!rest.has(diffDays(ch.startDate, d) + 1)) n++;
  }
  return n;
}

/**
 * Per-member stats for a date range of a challenge.
 * Days elapsed = non-rest days from the later of range start / join date up to yesterday,
 * plus today only if the member already has a check-in today (so nobody is penalised mid-day).
 */
export async function rangeStats(
  db: Db,
  ch: ChallengeRow,
  members: { user: UserLite; joinedAt: string }[],
  range: { from: LocalDate; to: LocalDate },
): Promise<RangeStats[]> {
  const rest = restDaysOf(ch);
  const rows = await db
    .select({
      userId: checkins.userId,
      localDate: checkins.localDate,
      countsDone: checkins.countsDone,
      tasksDone: checkins.tasksDone,
    })
    .from(checkins)
    .where(
      and(
        eq(checkins.challengeId, ch.id),
        gte(checkins.localDate, range.from),
        lte(checkins.localDate, range.to),
      ),
    )
    .all();
  const byUser = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byUser.get(r.userId) ?? [];
    list.push(r);
    byUser.set(r.userId, list);
  }
  return members.map(({ user: u, joinedAt }) => {
    const today = localDateInZone(new Date(), u.timezone);
    // Members count from the challenge start if they were in the squad when it was created
    // (or checked in earlier), otherwise from the day they joined.
    const all = byUser.get(u.id) ?? [];
    const firstCheckin = all.reduce<LocalDate | null>(
      (m, r) => (m === null || r.localDate < m ? r.localDate : m),
      null,
    );
    let joined = joinedAt <= ch.createdAt ? range.from : joinedAt.slice(0, 10);
    if (firstCheckin && firstCheckin < joined) joined = firstCheckin;
    const from = joined > range.from ? joined : range.from;
    const until = today < range.to ? today : range.to;
    const mine = (byUser.get(u.id) ?? []).filter(
      (r) => r.localDate >= from && r.localDate <= until,
    );
    const hasToday = mine.some((r) => r.localDate === until);
    const yesterday = addDays(until, -1);
    const daysElapsed =
      countNonRest(ch, rest, from, yesterday) +
      (hasToday && !rest.has(diffDays(ch.startDate, until) + 1) ? 1 : 0);
    const done = mine.filter(
      (r) => r.countsDone && !rest.has(diffDays(ch.startDate, r.localDate) + 1),
    );
    return {
      user: u,
      userId: u.id,
      name: displayNameOf(u),
      daysDone: done.length,
      daysElapsed,
      tasksDone: mine.reduce((n, r) => n + r.tasksDone, 0),
    };
  });
}

export async function challengeMembers(db: Db, squadId: string) {
  const rows = await db
    .select()
    .from(squadMembers)
    .innerJoin(user, eq(user.id, squadMembers.userId))
    .where(and(eq(squadMembers.squadId, squadId), eq(squadMembers.status, 'active')))
    .all();
  return rows.map((r) => ({ user: r.user, joinedAt: r.squad_members.joinedAt }));
}

export function rangeFor(
  ch: ChallengeRow,
  range: 'challenge' | 'week',
  today: LocalDate,
): { from: LocalDate; to: LocalDate } {
  const last = endDate(ch.startDate, ch.durationDays);
  const to = today < last ? today : last;
  if (range === 'challenge') return { from: ch.startDate, to };
  const monday = startOfWeek(to);
  return { from: monday > ch.startDate ? monday : ch.startDate, to };
}

export async function leaderboard(
  db: Db,
  ch: ChallengeRow,
  range: 'challenge' | 'week',
  viewerTz: string,
  exclude: Set<string>,
) {
  const today = localDateInZone(new Date(), viewerTz);
  const r = rangeFor(ch, range, today);
  const members = (await challengeMembers(db, ch.squadId)).filter((m) => !exclude.has(m.user.id));
  const stats = await rangeStats(db, ch, members, r);
  const byId = new Map(stats.map((s) => [s.userId, s.user]));
  return {
    range: r,
    rows: rankLeaderboard(stats).map((row) => ({ ...row, user: byId.get(row.userId)! })),
  };
}

/** Consistency % per member over the whole challenge (members screen). */
export async function memberConsistency(
  db: Db,
  ch: ChallengeRow,
  users: UserLite[],
): Promise<Map<string, number>> {
  const members = await challengeMembers(db, ch.squadId);
  const wanted = new Set(users.map((u) => u.id));
  const today = localDateInZone(new Date(), 'UTC');
  const stats = await rangeStats(
    db,
    ch,
    members.filter((m) => wanted.has(m.user.id)),
    rangeFor(ch, 'challenge', addDays(today, 1)),
  );
  return new Map(
    stats.map((s) => [
      s.userId,
      s.daysElapsed > 0
        ? Math.round((Math.min(s.daysDone, s.daysElapsed) / s.daysElapsed) * 100)
        : 0,
    ]),
  );
}
