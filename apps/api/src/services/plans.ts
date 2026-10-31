import { mergeDayEdits, planHash, type Plan, type PlanDay } from '@sparksquad/shared';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import type { challenges } from '../db/schema';
import { planDayEdits } from '../db/schema';
import type { Bindings } from '../env';
import { errors } from '../lib/errors';
import { dayFromJson, parseJson } from './dto';

type ChallengeRow = typeof challenges.$inferSelect;

/**
 * Per-isolate cache; plans are immutable per key (key contains the hash). Bounded by total
 * serialized size, not just entry count, so large plans cannot grow the isolate heap unchecked.
 */
const PLAN_CACHE_MAX_BYTES = 8 * 1024 * 1024;
const planCache = new Map<string, { plan: Plan; bytes: number }>();
let planCacheBytes = 0;

function cachePlan(key: string, plan: Plan, bytes: number): void {
  if (bytes > PLAN_CACHE_MAX_BYTES / 4) return;
  const old = planCache.get(key);
  if (old) {
    planCacheBytes -= old.bytes;
    planCache.delete(key);
  }
  while (planCacheBytes + bytes > PLAN_CACHE_MAX_BYTES && planCache.size > 0) {
    const [oldestKey, oldest] = planCache.entries().next().value!;
    planCache.delete(oldestKey);
    planCacheBytes -= oldest.bytes;
  }
  planCache.set(key, { plan, bytes });
  planCacheBytes += bytes;
}

export function planKeyFor(challengeId: string, hash: string): string {
  return `plans/${challengeId}/${hash}.json`;
}

export async function storePlan(
  env: Bindings,
  challengeId: string,
  plan: Plan,
): Promise<{ key: string; hash: string }> {
  const hash = planHash(plan);
  const key = planKeyFor(challengeId, hash);
  const json = JSON.stringify(plan);
  await env.BUCKET.put(key, json, {
    httpMetadata: { contentType: 'application/json' },
  });
  cachePlan(key, plan, json.length);
  return { key, hash };
}

export async function loadPlan(env: Bindings, key: string): Promise<Plan> {
  const cached = planCache.get(key);
  if (cached) return cached.plan;
  const obj = await env.BUCKET.get(key);
  if (!obj) throw errors.notFound('That plan');
  const text = await obj.text();
  const plan = JSON.parse(text) as Plan;
  cachePlan(key, plan, text.length);
  return plan;
}

export async function dayEdits(db: Db, challengeId: string): Promise<PlanDay[]> {
  const rows = await db
    .select()
    .from(planDayEdits)
    .where(eq(planDayEdits.challengeId, challengeId))
    .all();
  return rows.map((r) => dayFromJson(r.dayJson)).filter((d): d is PlanDay => d !== null);
}

/** The stored plan with owner day edits merged. */
export async function effectivePlanFor(env: Bindings, db: Db, ch: ChallengeRow): Promise<Plan> {
  return mergeDayEdits(await loadPlan(env, ch.planKey), await dayEdits(db, ch.id));
}

export async function effectiveDay(
  env: Bindings,
  db: Db,
  ch: ChallengeRow,
  dayNumber: number,
): Promise<PlanDay> {
  const plan = await effectivePlanFor(env, db, ch);
  const day = plan.days.find((d) => d.day === dayNumber);
  if (!day) throw errors.notFound('That day');
  return day;
}

export function planShape(plan: Plan): { restDays: number[]; taskCounts: number[] } {
  return {
    restDays: plan.days.filter((d) => d.rest).map((d) => d.day),
    taskCounts: plan.days.map((d) => d.tasks.length),
  };
}

export function restDaysOf(ch: Pick<ChallengeRow, 'restDays'>): Set<number> {
  return new Set(parseJson<number[]>(ch.restDays, []));
}
