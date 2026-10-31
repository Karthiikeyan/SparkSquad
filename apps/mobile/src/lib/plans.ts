import { mergeDayEdits, type Plan, type PlanDay } from '@sparksquad/shared';
import { eq, inArray } from 'drizzle-orm';
import { endpoints } from './api/endpoints';
import { parseJson, withWriteLock } from './db/helpers';
import { challenges, dayEdits, plans } from './db/schema';
import type { LocalDb } from './db/types';

type FetchPlan = (challengeId: string) => Promise<Plan | null>;

/**
 * Downloads plan JSON for active challenges whose plan hash isn't cached yet.
 * Plans are immutable per hash, so each one is fetched once. Returns how many were added.
 */
export async function ensurePlans(
  db: LocalDb,
  fetchPlan: FetchPlan = (id) => endpoints.plan(id),
): Promise<number> {
  const active = await db
    .select({ id: challenges.id, hash: challenges.planHash })
    .from(challenges)
    .where(eq(challenges.status, 'active'))
    .all();
  if (active.length === 0) return 0;
  const cached = new Set(
    (
      await db
        .select({ hash: plans.hash })
        .from(plans)
        .where(
          inArray(
            plans.hash,
            active.map((a) => a.hash),
          ),
        )
        .all()
    ).map((p) => p.hash),
  );
  let added = 0;
  const seen = new Set<string>();
  for (const ch of active) {
    if (cached.has(ch.hash) || seen.has(ch.hash)) continue;
    seen.add(ch.hash);
    try {
      const plan = await fetchPlan(ch.id);
      if (!plan) continue;
      await withWriteLock(() =>
        db
          .insert(plans)
          .values({
            hash: ch.hash,
            json: JSON.stringify(plan),
            fetchedAt: new Date().toISOString(),
          })
          .onConflictDoNothing(),
      );
      added += 1;
    } catch {
      // Offline or server trouble: the card shows a loading state and we retry next sync.
    }
  }
  // Drop plans no active challenge uses any more.
  const keep = new Set(active.map((a) => a.hash));
  const all = await db.select({ hash: plans.hash }).from(plans).all();
  const stale = all.map((p) => p.hash).filter((h) => !keep.has(h));
  if (stale.length) {
    await withWriteLock(() => db.delete(plans).where(inArray(plans.hash, stale)));
  }
  return added;
}

export async function readPlan(db: LocalDb, hash: string): Promise<Plan | null> {
  const row = await db.select().from(plans).where(eq(plans.hash, hash)).get();
  return row ? parseJson<Plan | null>(row.json, null) : null;
}

export async function readDayEdits(db: LocalDb, challengeId: string): Promise<PlanDay[]> {
  const rows = await db.select().from(dayEdits).where(eq(dayEdits.challengeId, challengeId)).all();
  return rows
    .map((r) => parseJson<PlanDay | null>(r.data, null))
    .filter((d): d is PlanDay => d !== null);
}

/** The effective plan day `n`: owner edits overlay the stored plan. */
export function effectiveDay(plan: Plan, edits: readonly PlanDay[], n: number): PlanDay | null {
  const relevant = edits.filter((e) => e.day === n);
  const merged = relevant.length ? mergeDayEdits(plan, relevant) : plan;
  return merged.days.find((d) => d.day === n) ?? null;
}
