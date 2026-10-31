import type {
  ChallengeDTO,
  CheckinDTO,
  MeDTO,
  Plan,
  PlanDay,
  Role,
  SquadDTO,
} from '@sparksquad/shared';
import { and, eq } from 'drizzle-orm';
import { parseJson } from '../../lib/db/helpers';
import {
  announcements,
  challenges,
  checkins,
  members,
  nudges,
  squads,
  users,
} from '../../lib/db/schema';
import type { LocalDb } from '../../lib/db/types';
import { readDayEdits, readPlan } from '../../lib/plans';
import { todayFor } from '../today/model';

export interface SquadMember {
  userId: string;
  role: Role;
  joinedAt: string;
  name: string;
  username: string | null;
  avatarColor: number;
}

/** Everything one squad's screens need, from the local store. */
export interface SquadSource {
  me: MeDTO;
  squad: SquadDTO;
  myRole: Role | null;
  members: SquadMember[];
  challenge: ChallengeDTO | null;
  plan: Plan | null;
  edits: PlanDay[];
  checkins: CheckinDTO[];
  pendingIds: Set<string>;
  /** Members I already nudged today in the active challenge. */
  nudgedToday: Set<string>;
  announcement: { body: string; authorId: string | null; updatedAt: string } | null;
}

export async function readSquadSource(
  db: LocalDb,
  me: MeDTO,
  squadId: string,
  now: Date = new Date(),
): Promise<SquadSource | null> {
  const row = await db.select().from(squads).where(eq(squads.id, squadId)).get();
  const squad = row ? parseJson<SquadDTO | null>(row.data, null) : null;
  if (!squad) return null;

  const memberRows = await db
    .select({
      userId: members.userId,
      role: members.role,
      joinedAt: members.joinedAt,
      status: members.status,
      name: users.displayName,
      username: users.username,
      avatarColor: users.avatarColor,
    })
    .from(members)
    .leftJoin(users, eq(users.id, members.userId))
    .where(eq(members.squadId, squadId))
    .all();
  const active = memberRows.filter((m) => m.status === 'active');
  const mine = memberRows.find((m) => m.userId === me.id);

  const chRows = await db
    .select()
    .from(challenges)
    .where(and(eq(challenges.squadId, squadId), eq(challenges.status, 'active')))
    .all();
  const challenge = chRows[0] ? parseJson<ChallengeDTO | null>(chRows[0].data, null) : null;
  const plan = challenge ? await readPlan(db, challenge.planHash) : null;
  const edits = challenge ? await readDayEdits(db, challenge.id) : [];
  const checkinRows = challenge
    ? await db.select().from(checkins).where(eq(checkins.challengeId, challenge.id)).all()
    : [];
  const today = todayFor(me, now);
  const nudgeRows = challenge
    ? await db
        .select({ to: nudges.toUserId })
        .from(nudges)
        .where(
          and(
            eq(nudges.challengeId, challenge.id),
            eq(nudges.fromUserId, me.id),
            eq(nudges.localDate, today),
          ),
        )
        .all()
    : [];
  const ann = await db.select().from(announcements).where(eq(announcements.squadId, squadId)).get();

  return {
    me,
    squad,
    myRole: mine && mine.status === 'active' ? (mine.role as Role) : null,
    members: active.map((m) => ({
      userId: m.userId,
      role: m.role as Role,
      joinedAt: m.joinedAt,
      name: m.userId === me.id ? me.displayName : (m.name ?? ''),
      username: m.userId === me.id ? me.username : (m.username ?? null),
      avatarColor: m.userId === me.id ? me.avatarColor : (m.avatarColor ?? 0),
    })),
    challenge,
    plan,
    edits,
    checkins: checkinRows
      .map((c) => parseJson<CheckinDTO | null>(c.data, null))
      .filter((c): c is CheckinDTO => c !== null),
    pendingIds: new Set(checkinRows.filter((c) => c.pending).map((c) => c.id)),
    nudgedToday: new Set(nudgeRows.map((n) => n.to)),
    announcement: ann ? { body: ann.body, authorId: ann.authorId, updatedAt: ann.updatedAt } : null,
  };
}

/** Squad ids on this phone (sync only keeps squads I'm an active member of). */
export async function readMySquadIds(db: LocalDb): Promise<string[]> {
  const all = await db.select({ id: squads.id }).from(squads).all();
  return all.map((s) => s.id);
}
