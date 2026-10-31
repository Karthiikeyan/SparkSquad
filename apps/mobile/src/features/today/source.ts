import {
  addDays,
  type ChallengeDTO,
  type CheckinDTO,
  type MeDTO,
  type Plan,
  type PlanDay,
  type SquadDTO,
  type StreakDTO,
} from '@sparksquad/shared';
import { and, eq, gte, inArray } from 'drizzle-orm';
import { getKv, parseJson } from '../../lib/db/helpers';
import {
  challenges,
  checkins,
  dayEdits,
  members,
  plans,
  squads,
  streaks,
  users,
} from '../../lib/db/schema';
import type { LocalDb } from '../../lib/db/types';
import { KV_ME } from '../../lib/sync/applySync';
import { todayFor, type SourceUser, type TodaySource } from './model';

/** Reads the signed-in user's cached profile, or null before the first sync. */
export async function readMe(db: LocalDb): Promise<MeDTO | null> {
  return parseJson<MeDTO | null>(await getKv(db, KV_ME), null);
}

export async function readTodaySource(
  db: LocalDb,
  me: MeDTO,
  now: Date = new Date(),
): Promise<TodaySource> {
  const today = todayFor(me, now);
  const squadRows = await db.select().from(squads).all();
  const chRows = await db.select().from(challenges).where(eq(challenges.status, 'active')).all();
  const chIds = chRows.map((c) => c.id);
  const memberRows = await db
    .select({ squadId: members.squadId, userId: members.userId })
    .from(members)
    .where(eq(members.status, 'active'))
    .all();
  const userRows = await db.select().from(users).all();
  const hashes = [...new Set(chRows.map((c) => c.planHash))];
  const planRows = hashes.length
    ? await db.select().from(plans).where(inArray(plans.hash, hashes)).all()
    : [];
  const editRows = chIds.length
    ? await db.select().from(dayEdits).where(inArray(dayEdits.challengeId, chIds)).all()
    : [];
  const checkinRows = chIds.length
    ? await db
        .select()
        .from(checkins)
        .where(
          and(inArray(checkins.challengeId, chIds), gte(checkins.localDate, addDays(today, -2))),
        )
        .all()
    : [];
  const streakRows = await db.select().from(streaks).all();

  const memberMap = new Map<string, string[]>();
  for (const m of memberRows) {
    const list = memberMap.get(m.squadId) ?? [];
    list.push(m.userId);
    memberMap.set(m.squadId, list);
  }
  const edits = new Map<string, PlanDay[]>();
  for (const e of editRows) {
    const day = parseJson<PlanDay | null>(e.data, null);
    if (!day) continue;
    const list = edits.get(e.challengeId) ?? [];
    list.push(day);
    edits.set(e.challengeId, list);
  }
  const planMap = new Map<string, Plan>();
  for (const p of planRows) {
    const plan = parseJson<Plan | null>(p.json, null);
    if (plan) planMap.set(p.hash, plan);
  }

  return {
    me,
    squads: squadRows
      .map((s) => parseJson<SquadDTO | null>(s.data, null))
      .filter((s): s is SquadDTO => s !== null),
    challenges: chRows
      .map((c) => parseJson<ChallengeDTO | null>(c.data, null))
      .filter((c): c is ChallengeDTO => c !== null),
    members: memberMap,
    users: new Map<string, SourceUser>(
      userRows.map((u) => [
        u.id,
        { id: u.id, displayName: u.displayName, avatarColor: u.avatarColor },
      ]),
    ),
    plans: planMap,
    edits,
    checkins: checkinRows
      .map((c) => parseJson<CheckinDTO | null>(c.data, null))
      .filter((c): c is CheckinDTO => c !== null),
    pendingCheckinIds: new Set(checkinRows.filter((c) => c.pending).map((c) => c.id)),
    streaks: streakRows.map((s): StreakDTO => ({
      scope: s.scope,
      current: s.current,
      best: s.best,
      freezes: s.freezes,
      lastDoneDate: s.lastDoneDate,
      updatedAt: s.updatedAt,
    })),
  };
}
