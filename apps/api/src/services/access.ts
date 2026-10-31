import {
  TIER_LIMITS,
  effectivePlan,
  wordFilter,
  type ErrorCode,
  type UserPlan,
} from '@sparksquad/shared';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { blocks, squadMembers, squads, usageCounters, user } from '../db/schema';
import { ApiError, errors } from '../lib/errors';

type Role = 'owner' | 'admin' | 'member';

export async function getUser(db: Db, userId: string) {
  const row = await db.select().from(user).where(eq(user.id, userId)).get();
  if (!row || row.deletedAt) throw errors.notFound('That person');
  return row;
}

export async function userPlan(db: Db, userId: string): Promise<UserPlan> {
  const row = await db
    .select({ plan: user.plan, planExpiresAt: user.planExpiresAt })
    .from(user)
    .where(eq(user.id, userId))
    .get();
  return row ? effectivePlan(row.plan, row.planExpiresAt) : 'free';
}

/** Loads a squad and the caller's active membership; enforces roles. */
export async function requireMember(
  db: Db,
  squadId: string,
  userId: string,
  roles?: readonly Role[],
) {
  const squad = await db.select().from(squads).where(eq(squads.id, squadId)).get();
  if (!squad || squad.archivedAt || squad.hiddenAt) throw errors.notFound('That squad');
  const member = await db
    .select()
    .from(squadMembers)
    .where(and(eq(squadMembers.squadId, squadId), eq(squadMembers.userId, userId)))
    .get();
  if (!member || member.status !== 'active')
    throw errors.forbidden('You’re not a member of this squad.');
  if (roles && !roles.includes(member.role)) {
    throw errors.forbidden('Only the squad owner or an admin can do that.');
  }
  return { squad, member };
}

export async function countJoined(db: Db, userId: string): Promise<number> {
  const row = await db
    .select({ n: sql<number>`count(*)` })
    .from(squadMembers)
    .innerJoin(squads, eq(squads.id, squadMembers.squadId))
    .where(
      and(
        eq(squadMembers.userId, userId),
        inArray(squadMembers.status, ['active', 'pending']),
        sql`${squads.archivedAt} is null`,
      ),
    )
    .get();
  return row?.n ?? 0;
}

export async function countOwned(db: Db, userId: string): Promise<number> {
  const row = await db
    .select({ n: sql<number>`count(*)` })
    .from(squads)
    .where(and(eq(squads.ownerId, userId), sql`${squads.archivedAt} is null`))
    .get();
  return row?.n ?? 0;
}

export async function joinLimitError(db: Db, userId: string): Promise<ApiError> {
  const plan = await userPlan(db, userId);
  return errors.limit(
    'LIMIT_SQUADS_JOINED',
    `You’re in ${TIER_LIMITS[plan].squadsJoined} squads, the most on your plan. Leave one or upgrade to join more.`,
  );
}

export async function ownLimitError(db: Db, userId: string): Promise<ApiError> {
  const plan = await userPlan(db, userId);
  return errors.limit(
    'LIMIT_SQUADS_OWNED',
    `You can run ${TIER_LIMITS[plan].squadsOwned} squad${TIER_LIMITS[plan].squadsOwned === 1 ? '' : 's'} on your plan. Upgrade to start more.`,
  );
}

export async function assertCanJoin(db: Db, userId: string): Promise<void> {
  const plan = await userPlan(db, userId);
  if ((await countJoined(db, userId)) >= TIER_LIMITS[plan].squadsJoined) {
    throw await joinLimitError(db, userId);
  }
}

/** True when a write already landed above the limit (concurrent requests); callers roll back. */
export async function overJoinLimit(db: Db, userId: string): Promise<boolean> {
  const plan = await userPlan(db, userId);
  return (await countJoined(db, userId)) > TIER_LIMITS[plan].squadsJoined;
}

export async function overOwnLimit(db: Db, userId: string): Promise<boolean> {
  const plan = await userPlan(db, userId);
  return (await countOwned(db, userId)) > TIER_LIMITS[plan].squadsOwned;
}

/** True when owning one more squad would exceed the user's plan. */
export async function atOwnLimit(db: Db, userId: string): Promise<boolean> {
  const plan = await userPlan(db, userId);
  return (await countOwned(db, userId)) >= TIER_LIMITS[plan].squadsOwned;
}

export async function assertCanOwn(db: Db, userId: string): Promise<void> {
  const plan = await userPlan(db, userId);
  if ((await countOwned(db, userId)) >= TIER_LIMITS[plan].squadsOwned) {
    throw await ownLimitError(db, userId);
  }
}

/** Throws CONTENT_NOT_ALLOWED if any text fails the word filter. */
export function assertClean(...texts: (string | null | undefined)[]): void {
  for (const t of texts) if (t && !wordFilter.isAllowed(t)) throw errors.content();
}

/** Users the viewer has blocked (their content is hidden from the viewer). */
export async function blockedByMe(db: Db, userId: string): Promise<string[]> {
  const rows = await db
    .select({ id: blocks.blockedId })
    .from(blocks)
    .where(eq(blocks.blockerId, userId))
    .all();
  return rows.map((r) => r.id);
}

export async function isBlockedEitherWay(db: Db, a: string, b: string): Promise<boolean> {
  const row = await db
    .select({ x: blocks.blockerId })
    .from(blocks)
    .where(
      or(
        and(eq(blocks.blockerId, a), eq(blocks.blockedId, b)),
        and(eq(blocks.blockerId, b), eq(blocks.blockedId, a)),
      ),
    )
    .get();
  return Boolean(row);
}

/**
 * Atomically increments a daily counter if it is below `max`.
 * Returns false when the cap is already reached.
 */
export async function takeUsage(
  db: Db,
  userId: string,
  day: string,
  kind: string,
  max: number,
): Promise<boolean> {
  const row = await db
    .insert(usageCounters)
    .values({ userId, day, kind, count: 1 })
    .onConflictDoUpdate({
      target: [usageCounters.userId, usageCounters.day, usageCounters.kind],
      set: { count: sql`${usageCounters.count} + 1` },
      setWhere: sql`${usageCounters.count} < ${max}`,
    })
    .returning({ count: usageCounters.count })
    .get();
  return Boolean(row);
}

export function limitError(code: ErrorCode, message: string): ApiError {
  return new ApiError(429, code, message);
}
