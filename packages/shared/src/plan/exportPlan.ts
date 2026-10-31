import { canonicalJson, sha256Hex } from './hash';
import type { Plan, PlanDay, PlanTask } from './schema';

/** Overlay owner/admin day edits on top of the stored plan (edits win). */
export function mergeDayEdits(plan: Plan, edits: readonly PlanDay[] = []): Plan {
  if (edits.length === 0) return plan;
  const byDay = new Map(edits.map((e) => [e.day, e]));
  return {
    ...plan,
    days: plan.days.map((d) => {
      const edit = byDay.get(d.day);
      if (!edit) return d;
      return {
        ...edit,
        day: d.day,
        tasks: edit.tasks.map((t, i) => ({ ...t, id: `d${d.day}t${i}` })),
      };
    }),
  };
}

function exportTask(t: PlanTask): Record<string, unknown> {
  const out: Record<string, unknown> = { title: t.title, type: t.type };
  if (t.type !== 'check' && t.target !== undefined) out.target = t.target;
  if (t.type === 'count' && t.unit) out.unit = t.unit;
  if (t.verify) out.verify = t.verify;
  if (t.link) out.link = t.link;
  return out;
}

function exportDay(d: PlanDay): Record<string, unknown> {
  if (d.rest) return { day: d.day, title: d.title, rest: true, tasks: [] };
  return { day: d.day, title: d.title, tasks: d.tasks.map(exportTask) };
}

/** The plan as a plain object in the documented file format (no internal ids). */
export function planToFileObject(plan: Plan): Record<string, unknown> {
  return {
    sparksquad_plan: plan.sparksquad_plan,
    title: plan.title,
    ...(plan.goal ? { goal: plan.goal } : {}),
    category: plan.category,
    duration_days: plan.duration_days,
    days_per_week: plan.days_per_week,
    phases: plan.phases,
    days: plan.days.map(exportDay),
    milestones: plan.milestones,
  };
}

/** Pretty-printed, shareable plan JSON with day edits merged (Plan Format §4). */
export function exportPlan(plan: Plan, dayEdits: readonly PlanDay[] = []): string {
  return `${JSON.stringify(planToFileObject(mergeDayEdits(plan, dayEdits)), null, 2)}\n`;
}

/** SHA-256 of the canonical JSON of a normalised plan. Same on phone and server. */
export function planHash(plan: Plan): string {
  return sha256Hex(canonicalJson(plan));
}

export function planSlug(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return slug || 'plan';
}

export function planFileName(title: string): string {
  return `${planSlug(title)}.sparksquad.json`;
}
