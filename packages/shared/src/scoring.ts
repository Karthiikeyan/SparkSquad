import type { PlanTask } from './plan/schema';

export type CheckinStatus = 'done' | 'partial' | 'honest_miss';

/** One value per task index; boolean for `check`, number for `count`/`minutes`. */
export interface TaskValue {
  t: number;
  v: number | boolean;
}

type ScorableTask = Pick<PlanTask, 'type' | 'target'>;

export function taskMet(task: ScorableTask, value: number | boolean | undefined): boolean {
  if (value === undefined) return false;
  if (task.type === 'check') return value === true || (typeof value === 'number' && value > 0);
  if (typeof value !== 'number') return false;
  return value >= (task.target ?? 1);
}

export function tasksCompleted(
  tasks: readonly ScorableTask[],
  values: readonly TaskValue[],
): number {
  const byIndex = new Map(values.map((v) => [v.t, v.v]));
  return tasks.reduce((n, task, i) => n + (taskMet(task, byIndex.get(i)) ? 1 : 0), 0);
}

/** Server-side status for a submitted check-in. Rest days (no tasks) are always `done`. */
export function computeCheckinStatus(
  tasks: readonly ScorableTask[],
  values: readonly TaskValue[],
  honestMiss = false,
): { status: CheckinStatus; completed: number; fraction: number } {
  if (honestMiss) return { status: 'honest_miss', completed: 0, fraction: 0 };
  if (tasks.length === 0) return { status: 'done', completed: 0, fraction: 1 };
  const completed = tasksCompleted(tasks, values);
  const fraction = completed / tasks.length;
  return { status: completed === tasks.length ? 'done' : 'partial', completed, fraction };
}

/** Partial counts as done when the squad allows it and at least half the tasks are met. */
export const PARTIAL_DONE_THRESHOLD = 0.5;

export function countsAsDone(
  status: CheckinStatus,
  fraction: number,
  partialCounts: boolean,
): boolean {
  if (status === 'done') return true;
  if (status === 'partial') return partialCounts && fraction >= PARTIAL_DONE_THRESHOLD;
  return false;
}

/** Consistency score as a whole percentage (done days ÷ days elapsed). */
export function consistencyPercent(daysDone: number, daysElapsed: number): number {
  if (daysElapsed <= 0) return 0;
  return Math.round((Math.min(daysDone, daysElapsed) / daysElapsed) * 100);
}

export interface LeaderboardInput {
  userId: string;
  name: string;
  daysDone: number;
  daysElapsed: number;
  tasksDone: number;
}

export interface LeaderboardRow extends LeaderboardInput {
  rank: number;
  score: number;
}

/**
 * Rank by consistency (exact ratio, not the rounded %), ties broken by tasks done.
 * Equal ratio and tasks share a rank (1, 1, 3). Name only orders display within a tie.
 */
export function rankLeaderboard(rows: readonly LeaderboardInput[]): LeaderboardRow[] {
  const ratio = (r: LeaderboardInput): number =>
    r.daysElapsed > 0 ? Math.min(r.daysDone, r.daysElapsed) / r.daysElapsed : 0;
  const sorted = [...rows].sort(
    (a, b) =>
      ratio(b) - ratio(a) ||
      b.tasksDone - a.tasksDone ||
      a.name.localeCompare(b.name) ||
      a.userId.localeCompare(b.userId),
  );
  const out: LeaderboardRow[] = [];
  sorted.forEach((row, i) => {
    const prev = out[i - 1];
    const tied =
      prev !== undefined && ratio(prev) === ratio(row) && prev.tasksDone === row.tasksDone;
    out.push({
      ...row,
      rank: tied ? prev.rank : i + 1,
      score: consistencyPercent(row.daysDone, row.daysElapsed),
    });
  });
  return out;
}
