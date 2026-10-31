import { z } from 'zod';

export const PLAN_VERSION = 1 as const;
export const PLAN_MAX_INPUT_BYTES = 512 * 1024;

export const CATEGORIES = ['career', 'fitness', 'learning', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];

export const TASK_TYPES = ['check', 'count', 'minutes'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const VERIFY_KINDS = ['leetcode', 'github', 'codeforces', 'steps'] as const;
export type VerifyKind = (typeof VERIFY_KINDS)[number];

export const PLAN_LIMITS = {
  titleMax: 80,
  goalMax: 160,
  minDays: 1,
  maxDays: 120,
  maxPhases: 12,
  phaseNameMax: 40,
  dayTitleMax: 60,
  maxTasksPerDay: 8,
  taskTitleMax: 80,
  targetMin: 1,
  targetMax: 10_000,
  unitMax: 20,
  linkMax: 500,
  maxMilestones: 20,
  milestoneTitleMax: 60,
} as const;

export const planTaskSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(PLAN_LIMITS.taskTitleMax),
  type: z.enum(TASK_TYPES),
  target: z.number().int().min(PLAN_LIMITS.targetMin).max(PLAN_LIMITS.targetMax).optional(),
  unit: z.string().max(PLAN_LIMITS.unitMax).optional(),
  verify: z.enum(VERIFY_KINDS).optional(),
  link: z
    .string()
    .max(PLAN_LIMITS.linkMax)
    .regex(/^https:\/\//)
    .optional(),
});

export const planDaySchema = z.object({
  day: z.number().int().min(1).max(PLAN_LIMITS.maxDays),
  title: z.string().min(1).max(PLAN_LIMITS.dayTitleMax),
  rest: z.boolean(),
  tasks: z.array(planTaskSchema).max(PLAN_LIMITS.maxTasksPerDay),
});

export const planPhaseSchema = z.object({
  name: z.string().min(1).max(PLAN_LIMITS.phaseNameMax),
  from_day: z.number().int().min(1),
  to_day: z.number().int().min(1),
});

export const planMilestoneSchema = z.object({
  day: z.number().int().min(1),
  title: z.string().min(1).max(PLAN_LIMITS.milestoneTitleMax),
});

/** The normalised plan produced by `parsePlan` (and accepted by the API). */
export const planSchema = z.object({
  sparksquad_plan: z.literal(PLAN_VERSION),
  title: z.string().min(1).max(PLAN_LIMITS.titleMax),
  goal: z.string().max(PLAN_LIMITS.goalMax).optional(),
  category: z.enum(CATEGORIES),
  duration_days: z.number().int().min(PLAN_LIMITS.minDays).max(PLAN_LIMITS.maxDays),
  days_per_week: z.number().int().min(1).max(7),
  phases: z.array(planPhaseSchema).max(PLAN_LIMITS.maxPhases),
  days: z.array(planDaySchema).min(1),
  milestones: z.array(planMilestoneSchema).max(PLAN_LIMITS.maxMilestones),
});

export type PlanTask = z.infer<typeof planTaskSchema>;
export type PlanDay = z.infer<typeof planDaySchema>;
export type PlanPhase = z.infer<typeof planPhaseSchema>;
export type PlanMilestone = z.infer<typeof planMilestoneSchema>;
export type Plan = z.infer<typeof planSchema>;

export interface PlanStats {
  days: number;
  tasks: number;
  restDays: number;
  phases: number;
  verifiedTasks: number;
}

export type ParsePlanResult =
  { ok: true; plan: Plan; fixes: string[]; stats: PlanStats } | { ok: false; errors: string[] };
