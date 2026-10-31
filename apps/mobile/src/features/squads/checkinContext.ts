import type { ChallengeDTO, CheckinDTO, PlanDay, SquadDTO } from '@sparksquad/shared';
import { eq } from 'drizzle-orm';
import { parseJson } from '../../lib/db/helpers';
import { challenges, checkins, squads, users } from '../../lib/db/schema';
import type { LocalDb } from '../../lib/db/types';
import { effectiveDay, readDayEdits, readPlan } from '../../lib/plans';

export interface CheckinContext {
  checkin: CheckinDTO | null;
  challenge: ChallengeDTO | null;
  squad: SquadDTO | null;
  day: PlanDay | null;
  author: { id: string; displayName: string; avatarColor: number } | null;
}

/** What the phone already knows about a check-in (works offline). */
export async function readCheckinContext(db: LocalDb, checkinId: string): Promise<CheckinContext> {
  const row = await db.select().from(checkins).where(eq(checkins.id, checkinId)).get();
  const checkin = row ? parseJson<CheckinDTO | null>(row.data, null) : null;
  const chRow = checkin
    ? await db.select().from(challenges).where(eq(challenges.id, checkin.challengeId)).get()
    : undefined;
  const challenge = chRow ? parseJson<ChallengeDTO | null>(chRow.data, null) : null;
  const sqRow = challenge
    ? await db.select().from(squads).where(eq(squads.id, challenge.squadId)).get()
    : undefined;
  const squad = sqRow ? parseJson<SquadDTO | null>(sqRow.data, null) : null;
  const plan = challenge ? await readPlan(db, challenge.planHash) : null;
  const edits = challenge ? await readDayEdits(db, challenge.id) : [];
  const day = plan && checkin ? effectiveDay(plan, edits, checkin.dayNumber) : null;
  const u = checkin
    ? await db.select().from(users).where(eq(users.id, checkin.userId)).get()
    : undefined;
  return {
    checkin,
    challenge,
    squad,
    day,
    author: u ? { id: u.id, displayName: u.displayName, avatarColor: u.avatarColor } : null,
  };
}
