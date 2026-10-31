import {
  tasksCompleted,
  type BadgeDTO,
  type BadgeId,
  type CheckinDTO,
  type Plan,
  type PlanDay,
} from '@sparksquad/shared';
import { and, eq } from 'drizzle-orm';
import { parseJson } from '../../lib/db/helpers';
import { badges, challenges, checkins, members, squads, streaks } from '../../lib/db/schema';
import type { LocalDb } from '../../lib/db/types';
import { effectiveDay, readDayEdits, readPlan } from '../../lib/plans';

export interface MyCheckin extends CheckinDTO {
  /** Tasks met, from the cached plan (falls back to truthy values when the plan isn't cached). */
  tasksDone: number;
  challengeTitle: string;
  squadName: string;
}

export interface YouSource {
  checkins: MyCheckin[];
  current: number;
  best: number;
  badges: BadgeDTO[];
  squadCount: number;
  ownedCount: number;
  firstJoined: string | null;
}

export function countMet(c: Pick<CheckinDTO, 'status' | 'values'>, day: PlanDay | null): number {
  if (c.status === 'honest_miss') return 0;
  if (!day) {
    return c.values.filter((v) => v.v === true || (typeof v.v === 'number' && v.v > 0)).length;
  }
  return tasksCompleted(day.tasks, c.values);
}

/** My own history and stats from the local store (my check-ins are never pruned). */
export async function readYouSource(db: LocalDb, meId: string): Promise<YouSource> {
  const rows = await db.select().from(checkins).where(eq(checkins.userId, meId)).all();
  const chRows = await db.select().from(challenges).all();
  const sqRows = await db.select().from(squads).all();
  const chById = new Map(chRows.map((c) => [c.id, c]));
  const sqName = new Map(
    sqRows.map((s) => [s.id, parseJson<{ name: string }>(s.data, { name: '' }).name]),
  );
  const planCache = new Map<string, { plan: Plan | null; edits: PlanDay[] }>();
  const out: MyCheckin[] = [];
  for (const r of rows) {
    const c = parseJson<CheckinDTO | null>(r.data, null);
    if (!c) continue;
    const ch = chById.get(c.challengeId);
    let day: PlanDay | null = null;
    if (ch) {
      let cached = planCache.get(ch.id);
      if (!cached) {
        cached = { plan: await readPlan(db, ch.planHash), edits: await readDayEdits(db, ch.id) };
        planCache.set(ch.id, cached);
      }
      day = cached.plan ? effectiveDay(cached.plan, cached.edits, c.dayNumber) : null;
    }
    out.push({
      ...c,
      tasksDone: countMet(c, day),
      challengeTitle: ch ? parseJson<{ title: string }>(ch.data, { title: '' }).title : '',
      squadName: ch ? (sqName.get(ch.squadId) ?? '') : '',
    });
  }
  const global = await db.select().from(streaks).where(eq(streaks.scope, 'global')).get();
  const badgeList = await db.select().from(badges).all();
  const mine = await db
    .select({ role: members.role, joinedAt: members.joinedAt })
    .from(members)
    .where(and(eq(members.userId, meId), eq(members.status, 'active')))
    .all();
  return {
    checkins: out.sort((a, b) => b.localDate.localeCompare(a.localDate)),
    current: global?.current ?? 0,
    best: global?.best ?? 0,
    badges: badgeList.map((b) => ({ badge: b.badge as BadgeId, earnedAt: b.earnedAt })),
    squadCount: mine.length,
    ownedCount: mine.filter((m) => m.role === 'owner').length,
    firstJoined: mine.map((m) => m.joinedAt).sort()[0] ?? null,
  };
}
