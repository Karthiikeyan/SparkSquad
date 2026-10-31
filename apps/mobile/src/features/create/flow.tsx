import {
  addDays,
  compareLocalDates,
  nextMonday,
  parsePlan,
  type ChallengeDTO,
  type CreateSquadInput,
  type LocalDate,
  type Plan,
  type PlanStats,
  type SquadDTO,
} from '@sparksquad/shared';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export interface ChosenPlan {
  plan: Plan;
  fixes: string[];
  stats: PlanStats;
  templateSlug?: string;
}

export interface CreateFlow {
  /** Existing squad getting a new challenge, or the squad this flow already created. */
  squadId: string | null;
  existing: boolean;
  basics: CreateSquadInput | null;
  plan: ChosenPlan | null;
  startDate: LocalDate | null;
  /** Text handed to the import screen (paste / AI reply). */
  pasted: string;
  goal: string;
  created: { squad: SquadDTO; challenge: ChallengeDTO } | null;
}

interface FlowApi {
  flow: CreateFlow;
  update: (patch: Partial<CreateFlow>) => void;
  reset: () => void;
}

const EMPTY: CreateFlow = {
  squadId: null,
  existing: false,
  basics: null,
  plan: null,
  startDate: null,
  pasted: '',
  goal: '',
  created: null,
};

const FlowContext = createContext<FlowApi | null>(null);

/** One create-flow draft per `create/` stack (D1–D11). */
export function CreateFlowProvider({ children }: { children: ReactNode }) {
  const [flow, setFlow] = useState<CreateFlow>(EMPTY);
  const api = useMemo<FlowApi>(
    () => ({
      flow,
      update: (patch) => setFlow((cur) => ({ ...cur, ...patch })),
      reset: () => setFlow(EMPTY),
    }),
    [flow],
  );
  return <FlowContext.Provider value={api}>{children}</FlowContext.Provider>;
}

export function useCreateFlow(): FlowApi {
  const ctx = useContext(FlowContext);
  if (!ctx) throw new Error('useCreateFlow must be used inside CreateFlowProvider');
  return ctx;
}

/** Product Spec: default start is next Monday; the API accepts up to 90 days ahead. */
export function defaultStartDate(today: LocalDate): LocalDate {
  return nextMonday(today);
}

export function clampStartDate(date: LocalDate, today: LocalDate): LocalDate {
  if (compareLocalDates(date, today) < 0) return today;
  const max = addDays(today, 90);
  return compareLocalDates(date, max) > 0 ? max : date;
}

/** Where to go once a plan is chosen: review, or squad basics first when coming from Discover. */
export function afterPlanRoute(
  flow: Pick<CreateFlow, 'existing' | 'basics'>,
): '/create/review' | '/create/basics' {
  return flow.existing || flow.basics ? '/create/review' : '/create/basics';
}

export interface BlankInput {
  title: string;
  category: Plan['category'];
  durationDays: number;
  daysPerWeek: number;
  tasks: Record<string, unknown>[];
}

/**
 * D9: every day gets the default tasks; with fewer than 7 days a week the last days of each
 * week become review days. Goes through the shared parser like any other source.
 */
export function buildBlankPlan(input: BlankInput) {
  const days = Array.from({ length: input.durationDays }, (_, i) => {
    const weekday = i % 7;
    const rest = weekday >= input.daysPerWeek;
    return rest
      ? { day: i + 1, title: 'Review day', rest: true, tasks: [] }
      : { day: i + 1, title: `Day ${i + 1}`, tasks: input.tasks };
  });
  return parsePlan({
    sparksquad_plan: 1,
    title: input.title.trim(),
    category: input.category,
    duration_days: input.durationDays,
    days_per_week: input.daysPerWeek,
    phases: [],
    days,
    milestones: [],
  });
}
