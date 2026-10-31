import { mergeDayEdits, planHash, type Plan, type PlanDay } from '@sparksquad/shared';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import type { challenges } from '../db/schema';
import { planDayEdits } from '../db/schema';
import type { Bindings } from '../env';
import { errors } from '../lib/errors';
import { dayFromJson, parseJson } from './dto';

type ChallengeRow = typeof challenges.$inferSelect;

/** Per-isolate cache; plans are immutable per key (key contains the hash). */
const planCache = new Map<string, Plan>();

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
  await env.BUCKET.put(key, JSON.stringify(plan), {
    httpMetadata: { contentType: 'application/json' },
  });
  planCache.set(key, plan);
  return { key, hash };
}

export async function loadPlan(env: Bindings, key: string): Promise<Plan> {
  const cached = planCache.get(key);
  if (cached) return cached;
  const obj = await env.BUCKET.get(key);
  if (!obj) throw errors.notFound('That plan');
  const plan = (await obj.json()) as Plan;
  if (planCache.size > 200) planCache.clear();
  planCache.set(key, plan);
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
