import { inviteCode } from '@sparksquad/shared';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { challenges, squadMembers, squads } from '../db/schema';

export async function recountMembers(db: Db, squadIds: string[]): Promise<void> {
  if (squadIds.length === 0) return;
  const ts = new Date().toISOString();
  for (const id of squadIds) {
    await db
      .update(squads)
      .set({
        memberCount: sql`(select count(*) from ${squadMembers} where ${squadMembers.squadId} = ${id} and ${squadMembers.status} = 'active')`,
        updatedAt: ts,
      })
      .where(eq(squads.id, id))
      .run();
  }
}

export async function uniqueInviteCode(db: Db): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = inviteCode();
    const taken = await db
      .select({ id: squads.id })
      .from(squads)
      .where(eq(squads.inviteCode, code))
      .get();
    if (!taken) return code;
  }
  throw new Error('Could not allocate an invite code');
}

export async function activeChallenge(db: Db, squadId: string) {
  return db
    .select()
    .from(challenges)
    .where(and(eq(challenges.squadId, squadId), eq(challenges.status, 'active')))
    .get();
}

export async function activeMemberIds(db: Db, squadId: string): Promise<string[]> {
  const rows = await db
    .select({ id: squadMembers.userId })
    .from(squadMembers)
    .where(and(eq(squadMembers.squadId, squadId), eq(squadMembers.status, 'active')))
    .all();
  return rows.map((r) => r.id);
}

export async function managerIds(db: Db, squadId: string): Promise<string[]> {
  const rows = await db
    .select({ id: squadMembers.userId })
    .from(squadMembers)
    .where(
      and(
        eq(squadMembers.squadId, squadId),
        eq(squadMembers.status, 'active'),
        inArray(squadMembers.role, ['owner', 'admin']),
      ),
    )
    .all();
  return rows.map((r) => r.id);
}

export async function mySquadIds(db: Db, userId: string): Promise<string[]> {
  const rows = await db
    .select({ id: squadMembers.squadId })
    .from(squadMembers)
    .where(and(eq(squadMembers.userId, userId), eq(squadMembers.status, 'active')))
    .all();
  return rows.map((r) => r.id);
}
