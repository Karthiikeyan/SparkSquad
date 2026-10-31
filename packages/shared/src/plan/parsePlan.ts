import { extractJson } from './extractJson';
import {
  CATEGORIES,
  PLAN_LIMITS,
  PLAN_MAX_INPUT_BYTES,
  PLAN_VERSION,
  TASK_TYPES,
  VERIFY_KINDS,
  planSchema,
  type Category,
  type ParsePlanResult,
  type Plan,
  type PlanDay,
  type PlanMilestone,
  type PlanPhase,
  type PlanStats,
  type PlanTask,
  type TaskType,
  type VerifyKind,
} from './schema';

export const PLAN_ERRORS = {
  tooLarge: 'This file is too big (over 512 KB). A SparkSquad plan is usually under 100 KB.',
  noJson: "This isn't a SparkSquad plan: we couldn't find any JSON in what you pasted.",
  notObject: "This isn't a SparkSquad plan: the JSON must be one object in curly braces { }.",
  missingVersion: 'This isn\'t a SparkSquad plan: the "sparksquad_plan": 1 line is missing.',
  wrongVersion: (v: unknown) =>
    `This plan uses format version ${JSON.stringify(v)}, but this app reads version 1. Ask for "sparksquad_plan": 1.`,
  noDays: 'This plan has no usable days. It needs a "days" list with at least one day number.',
} as const;

const VERIFY_NAMES: Record<string, string> = {
  hackerrank: 'HackerRank',
  codechef: 'CodeChef',
  geeksforgeeks: 'GeeksforGeeks',
  gfg: 'GeeksforGeeks',
  strava: 'Strava',
  duolingo: 'Duolingo',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string | undefined {
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function asInt(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (typeof value === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(value)) {
    return Math.round(Number(value));
  }
  return undefined;
}

function cut(text: string, max: number): string {
  return text.length > max ? text.slice(0, max).trimEnd() : text;
}

function rangeLabel(nums: number[]): string {
  const sorted = [...nums].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0]!;
  let prev = start;
  for (const n of [...sorted.slice(1), Number.NaN]) {
    if (n === prev + 1) {
      prev = n;
      continue;
    }
    parts.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = n;
    prev = n;
  }
  return parts.join(', ');
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}

function normalizeTask(raw: unknown, dayNum: number, fixes: string[]): Omit<PlanTask, 'id'> | null {
  if (!isRecord(raw)) {
    fixes.push(`Day ${dayNum}: a task that wasn't valid was removed`);
    return null;
  }
  let title = asText(raw.title) ?? '';
  if (!title) {
    fixes.push(`Day ${dayNum}: a task without a title was removed`);
    return null;
  }
  if (title.length > PLAN_LIMITS.taskTitleMax) {
    title = cut(title, PLAN_LIMITS.taskTitleMax);
    fixes.push(
      `Day ${dayNum}: a task title was shortened to ${PLAN_LIMITS.taskTitleMax} characters`,
    );
  }

  let type: TaskType = 'check';
  const rawType = raw.type;
  if (rawType === undefined || rawType === null || rawType === '') {
    type = 'check';
  } else if (
    typeof rawType === 'string' &&
    (TASK_TYPES as readonly string[]).includes(rawType.trim().toLowerCase())
  ) {
    type = rawType.trim().toLowerCase() as TaskType;
  } else {
    fixes.push(`Day ${dayNum}: task type ${JSON.stringify(rawType)} changed to done-or-not`);
  }

  const task: Omit<PlanTask, 'id'> = { title, type };

  if (type !== 'check') {
    const t = asInt(raw.target);
    if (t === undefined) {
      task.target = 1;
      fixes.push(`Day ${dayNum}: "${title}" had no target, set to 1`);
    } else if (t < PLAN_LIMITS.targetMin || t > PLAN_LIMITS.targetMax) {
      task.target = Math.min(Math.max(t, PLAN_LIMITS.targetMin), PLAN_LIMITS.targetMax);
      fixes.push(`Day ${dayNum}: "${title}" target changed from ${t} to ${task.target}`);
    } else {
      task.target = t;
    }
  }

  if (type === 'count') {
    let unit = asText(raw.unit) ?? '';
    if (unit.length > PLAN_LIMITS.unitMax) {
      unit = cut(unit, PLAN_LIMITS.unitMax);
      fixes.push(`Day ${dayNum}: a unit was shortened to ${PLAN_LIMITS.unitMax} characters`);
    }
    task.unit = unit || 'times';
  }

  if (raw.verify !== undefined && raw.verify !== null && raw.verify !== '') {
    const v = typeof raw.verify === 'string' ? raw.verify.trim() : '';
    const lower = v.toLowerCase();
    if ((VERIFY_KINDS as readonly string[]).includes(lower)) {
      if (lower === 'steps' && type !== 'count') {
        fixes.push(`Day ${dayNum}: steps check removed, it only works on a count task`);
      } else {
        task.verify = lower as VerifyKind;
      }
    } else {
      const name = VERIFY_NAMES[lower] ?? (v || 'An unknown');
      fixes.push(`Day ${dayNum}: ${name} check removed, not supported yet`);
    }
  }

  if (raw.link !== undefined && raw.link !== null && raw.link !== '') {
    const link = typeof raw.link === 'string' ? raw.link.trim() : '';
    if (/^https:\/\/[^\s]+$/i.test(link) && link.length <= PLAN_LIMITS.linkMax) {
      task.link = link;
    } else {
      fixes.push(`Day ${dayNum}: a link was removed (links must start with https:// )`);
    }
  }

  return task;
}

function normalizeDay(raw: Record<string, unknown>, dayNum: number, fixes: string[]): PlanDay {
  let title = asText(raw.title) ?? '';
  if (title.length > PLAN_LIMITS.dayTitleMax) {
    title = cut(title, PLAN_LIMITS.dayTitleMax);
    fixes.push(`Day ${dayNum}: title shortened to ${PLAN_LIMITS.dayTitleMax} characters`);
  }
  if (!title) title = `Day ${dayNum}`;

  let rest = raw.rest === true || raw.rest === 'true';
  const tasks: PlanTask[] = [];
  if (!rest) {
    const rawTasks = Array.isArray(raw.tasks) ? raw.tasks : [];
    const normalized = rawTasks
      .map((t) => normalizeTask(t, dayNum, fixes))
      .filter((t): t is Omit<PlanTask, 'id'> => t !== null);
    if (normalized.length > PLAN_LIMITS.maxTasksPerDay) {
      const extra = normalized.length - PLAN_LIMITS.maxTasksPerDay;
      fixes.push(
        `Day ${dayNum}: ${plural(extra, 'extra task', 'extra tasks')} removed (max ${PLAN_LIMITS.maxTasksPerDay} a day)`,
      );
      normalized.length = PLAN_LIMITS.maxTasksPerDay;
    }
    normalized.forEach((t, i) => tasks.push({ id: `d${dayNum}t${i}`, ...t }));
    if (tasks.length === 0) {
      rest = true;
      fixes.push(`Day ${dayNum} had no tasks, so it is now a rest day`);
    }
  }
  return { day: dayNum, title, rest, tasks };
}

/** Normalise a single day (owner day editor). Same rules as inside a full plan. */
export function parsePlanDay(
  raw: unknown,
  dayNum: number,
): { ok: true; day: PlanDay; fixes: string[] } | { ok: false; errors: string[] } {
  if (!isRecord(raw)) return { ok: false, errors: ['A day must be an object'] };
  const fixes: string[] = [];
  return { ok: true, day: normalizeDay(raw, dayNum, fixes), fixes };
}

function normalizePhases(raw: unknown, duration: number, fixes: string[]): PlanPhase[] {
  if (!Array.isArray(raw)) return [];
  const valid: PlanPhase[] = [];
  let dropped = 0;
  for (const p of raw) {
    if (!isRecord(p)) {
      dropped++;
      continue;
    }
    const name = cut(asText(p.name) ?? '', PLAN_LIMITS.phaseNameMax);
    const from = asInt(p.from_day);
    const to = asInt(p.to_day);
    if (!name || from === undefined || to === undefined || from < 1 || to > duration || from > to) {
      dropped++;
      continue;
    }
    valid.push({ name, from_day: from, to_day: to });
  }
  valid.sort((a, b) => a.from_day - b.from_day);
  const out: PlanPhase[] = [];
  for (const p of valid) {
    const last = out[out.length - 1];
    if (last && p.from_day <= last.to_day) {
      dropped++;
      continue;
    }
    out.push(p);
  }
  if (out.length > PLAN_LIMITS.maxPhases) {
    dropped += out.length - PLAN_LIMITS.maxPhases;
    out.length = PLAN_LIMITS.maxPhases;
  }
  if (dropped > 0) {
    fixes.push(
      `${plural(dropped, 'phase was', 'phases were')} removed (outside the plan or overlapping)`,
    );
  }
  return out;
}

function normalizeMilestones(raw: unknown, duration: number, fixes: string[]): PlanMilestone[] {
  if (!Array.isArray(raw)) return [];
  const out: PlanMilestone[] = [];
  let dropped = 0;
  for (const m of raw) {
    if (!isRecord(m)) {
      dropped++;
      continue;
    }
    const day = asInt(m.day);
    const title = cut(asText(m.title) ?? '', PLAN_LIMITS.milestoneTitleMax);
    if (day === undefined || day < 1 || day > duration || !title) {
      dropped++;
      continue;
    }
    out.push({ day, title });
  }
  out.sort((a, b) => a.day - b.day);
  if (out.length > PLAN_LIMITS.maxMilestones) {
    dropped += out.length - PLAN_LIMITS.maxMilestones;
    out.length = PLAN_LIMITS.maxMilestones;
  }
  if (dropped > 0) {
    fixes.push(`${plural(dropped, 'milestone was', 'milestones were')} removed (outside the plan)`);
  }
  return out;
}

export function planStats(plan: Plan): PlanStats {
  let tasks = 0;
  let restDays = 0;
  let verifiedTasks = 0;
  for (const d of plan.days) {
    if (d.rest) restDays++;
    tasks += d.tasks.length;
    verifiedTasks += d.tasks.filter((t) => t.verify).length;
  }
  return {
    days: plan.duration_days,
    tasks,
    restDays,
    phases: plan.phases.length,
    verifiedTasks,
  };
}

/**
 * Parse and normalise a plan from pasted text or a parsed object (Plan Format §3).
 * Never throws.
 */
export function parsePlan(input: unknown): ParsePlanResult {
  try {
    return parsePlanUnsafe(input);
  } catch {
    return { ok: false, errors: [PLAN_ERRORS.noJson] };
  }
}

function parsePlanUnsafe(input: unknown): ParsePlanResult {
  let root: unknown = input;
  if (typeof input === 'string') {
    if (utf8Length(input) > PLAN_MAX_INPUT_BYTES)
      return { ok: false, errors: [PLAN_ERRORS.tooLarge] };
    root = extractJson(input);
    if (root === null) return { ok: false, errors: [PLAN_ERRORS.noJson] };
  }
  if (!isRecord(root)) return { ok: false, errors: [PLAN_ERRORS.notObject] };

  if (!('sparksquad_plan' in root)) return { ok: false, errors: [PLAN_ERRORS.missingVersion] };
  const version = asInt(root.sparksquad_plan);
  if (version !== PLAN_VERSION) {
    return { ok: false, errors: [PLAN_ERRORS.wrongVersion(root.sparksquad_plan)] };
  }

  const fixes: string[] = [];

  // Days with a usable day number.
  const rawDays = Array.isArray(root.days) ? root.days : [];
  const numbered: { day: number; raw: Record<string, unknown> }[] = [];
  let unnumbered = 0;
  for (const d of rawDays) {
    const day = isRecord(d) ? asInt(d.day) : undefined;
    if (!isRecord(d) || day === undefined || day < 1) {
      unnumbered++;
      continue;
    }
    numbered.push({ day, raw: d });
  }
  if (numbered.length === 0) return { ok: false, errors: [PLAN_ERRORS.noDays] };
  if (unnumbered > 0) {
    fixes.push(
      `${plural(unnumbered, 'day without a day number was', 'days without a day number were')} removed`,
    );
  }

  // Duration.
  const maxDay = Math.max(...numbered.map((d) => d.day));
  let duration = asInt(root.duration_days);
  if (duration === undefined) {
    duration = Math.min(maxDay, PLAN_LIMITS.maxDays);
    fixes.push(`The plan length was missing, set to ${duration} days`);
  } else if (duration < PLAN_LIMITS.minDays || duration > PLAN_LIMITS.maxDays) {
    const clamped = Math.min(Math.max(duration, PLAN_LIMITS.minDays), PLAN_LIMITS.maxDays);
    fixes.push(
      `The plan length was changed from ${duration} to ${clamped} days (allowed: ${PLAN_LIMITS.minDays} to ${PLAN_LIMITS.maxDays})`,
    );
    duration = clamped;
  }

  // Duplicates and days beyond the duration.
  const byDay = new Map<number, Record<string, unknown>>();
  const duplicates: number[] = [];
  const beyond: number[] = [];
  for (const { day, raw } of numbered) {
    if (day > duration) {
      beyond.push(day);
      continue;
    }
    if (byDay.has(day)) {
      duplicates.push(day);
      continue;
    }
    byDay.set(day, raw);
  }
  for (const d of [...new Set(duplicates)].sort((a, b) => a - b)) {
    fixes.push(`Day ${d} appeared more than once, kept the first one`);
  }
  if (beyond.length > 0) {
    const unique = [...new Set(beyond)];
    fixes.push(
      `${plural(unique.length, 'day', 'days')} after day ${duration} removed (day ${rangeLabel(unique)})`,
    );
  }
  if (byDay.size === 0) return { ok: false, errors: [PLAN_ERRORS.noDays] };

  // Title, goal, category, days per week.
  let title = asText(root.title) ?? '';
  if (!title) {
    title = 'My plan';
    fixes.push('The plan had no title, named it "My plan"');
  } else if (title.length > PLAN_LIMITS.titleMax) {
    title = cut(title, PLAN_LIMITS.titleMax);
    fixes.push(`The title was shortened to ${PLAN_LIMITS.titleMax} characters`);
  }

  let goal = asText(root.goal);
  if (goal && goal.length > PLAN_LIMITS.goalMax) {
    goal = cut(goal, PLAN_LIMITS.goalMax);
    fixes.push(`The goal was shortened to ${PLAN_LIMITS.goalMax} characters`);
  }

  let category: Category = 'other';
  if (root.category !== undefined && root.category !== null && root.category !== '') {
    const c = typeof root.category === 'string' ? root.category.trim().toLowerCase() : '';
    if ((CATEGORIES as readonly string[]).includes(c)) category = c as Category;
    else fixes.push(`Category ${JSON.stringify(root.category)} changed to "other"`);
  }

  let daysPerWeek = 7;
  if (root.days_per_week !== undefined && root.days_per_week !== null) {
    const dpw = asInt(root.days_per_week);
    if (dpw !== undefined && dpw >= 1 && dpw <= 7) daysPerWeek = dpw;
    else fixes.push('Days per week must be 1 to 7, set to 7');
  }

  // Every day 1..duration, sorted; missing days become open rest days.
  const days: PlanDay[] = [];
  const missing: number[] = [];
  for (let n = 1; n <= duration; n++) {
    const raw = byDay.get(n);
    if (raw) {
      days.push(normalizeDay(raw, n, fixes));
    } else {
      missing.push(n);
      days.push({ day: n, title: 'Open day', rest: true, tasks: [] });
    }
  }
  if (missing.length > 0) {
    fixes.push(
      `${plural(missing.length, 'day was', 'days were')} missing and added as open days (day ${rangeLabel(missing)})`,
    );
  }

  const phases = normalizePhases(root.phases, duration, fixes);
  const milestones = normalizeMilestones(root.milestones, duration, fixes);

  const plan: Plan = {
    sparksquad_plan: PLAN_VERSION,
    title,
    ...(goal ? { goal } : {}),
    category,
    duration_days: duration,
    days_per_week: daysPerWeek,
    phases,
    days,
    milestones,
  };

  const checked = planSchema.safeParse(plan);
  if (!checked.success) {
    return {
      ok: false,
      errors: checked.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    };
  }
  return { ok: true, plan: checked.data, fixes, stats: planStats(checked.data) };
}
