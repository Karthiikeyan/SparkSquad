import { describe, expect, it } from 'vitest';
import {
  PLAN_ERRORS,
  exportPlan,
  parsePlan,
  parsePlanDay,
  planHash,
  planStats,
  type Plan,
} from '../../src/plan';
import { chatterReply, fullPlan, minimalPlan, smartQuotesReply, twoBlocksReply } from './fixtures';

function ok(input: unknown) {
  const r = parsePlan(input);
  if (!r.ok) throw new Error(`expected ok, got ${r.errors.join('; ')}`);
  return r;
}

function fail(input: unknown) {
  const r = parsePlan(input);
  if (r.ok) throw new Error('expected failure');
  return r;
}

describe('parsePlan — valid input', () => {
  it('parses a minimal plan without fixes', () => {
    const r = ok(minimalPlan);
    expect(r.fixes).toEqual([]);
    expect(r.plan.duration_days).toBe(1);
    expect(r.plan.category).toBe('other');
    expect(r.plan.days_per_week).toBe(7);
    expect(r.plan.days[0]!.tasks[0]).toEqual({ id: 'd1t0', title: 'Do one thing', type: 'check' });
    expect(r.stats).toEqual({ days: 1, tasks: 1, restDays: 0, phases: 0, verifiedTasks: 0 });
  });

  it('parses a full 60-day plan', () => {
    const r = ok(fullPlan(60));
    expect(r.fixes).toEqual([]);
    expect(r.plan.days).toHaveLength(60);
    expect(r.stats.restDays).toBe(8);
    expect(r.stats.tasks).toBe(52 * 3);
    expect(r.stats.verifiedTasks).toBe(52);
    expect(r.stats.phases).toBe(4);
    expect(r.plan.days[1]!.tasks[0]).toMatchObject({
      id: 'd2t0',
      type: 'count',
      target: 2,
      unit: 'problems',
      verify: 'leetcode',
    });
  });

  it('accepts JSON text', () => {
    expect(ok(JSON.stringify(minimalPlan)).plan.title).toBe('Tiny plan');
  });

  it('finds the plan in a reply wrapped in chatter and a json fence', () => {
    expect(ok(chatterReply).plan.title).toBe('Tiny plan');
  });

  it('uses the second code block when it holds the plan', () => {
    const r = ok(twoBlocksReply);
    expect(r.plan.title).toBe('60 days of DSA');
    expect(r.plan.duration_days).toBe(14);
  });

  it('tolerates smart quotes, comments and trailing commas', () => {
    const r = ok(smartQuotesReply);
    expect(r.plan.title).toBe('Smart quotes plan');
    expect(r.plan.days).toHaveLength(2);
    expect(r.plan.days[1]!.tasks[0]).toMatchObject({ type: 'minutes', target: 20 });
  });

  it('tolerates a BOM', () => {
    expect(ok(`\uFEFF${JSON.stringify(minimalPlan)}`).plan.title).toBe('Tiny plan');
  });

  it('ignores unknown fields silently', () => {
    const r = ok({ ...minimalPlan, author: 'someone', extra: { a: 1 } });
    expect(r.fixes).toEqual([]);
    expect(r.plan).not.toHaveProperty('author');
  });

  it('accepts numeric strings for numbers', () => {
    const r = ok({
      ...minimalPlan,
      duration_days: '1',
      days: [{ day: '1', tasks: [{ title: 'x' }] }],
    });
    expect(r.plan.days[0]!.title).toBe('Day 1');
  });
});

describe('parsePlan — hard failures', () => {
  it('fails when sparksquad_plan is missing', () => {
    const { sparksquad_plan: _drop, ...rest } = minimalPlan;
    expect(fail(rest).errors).toEqual([PLAN_ERRORS.missingVersion]);
  });

  it('fails when sparksquad_plan is 2', () => {
    const r = fail({ ...minimalPlan, sparksquad_plan: 2 });
    expect(r.errors[0]).toContain('version 2');
  });

  it('fails when there is no JSON', () => {
    expect(fail('Sorry, I cannot help with that.').errors).toEqual([PLAN_ERRORS.noJson]);
    expect(fail('').errors).toEqual([PLAN_ERRORS.noJson]);
  });

  it('fails on non-object roots', () => {
    expect(fail([1, 2]).errors).toEqual([PLAN_ERRORS.notObject]);
    expect(fail(42).errors).toEqual([PLAN_ERRORS.notObject]);
    expect(fail(null).errors).toEqual([PLAN_ERRORS.notObject]);
  });

  it('fails with zero usable days', () => {
    expect(fail({ ...minimalPlan, days: [] }).errors).toEqual([PLAN_ERRORS.noDays]);
    expect(fail({ ...minimalPlan, days: 'none' }).errors).toEqual([PLAN_ERRORS.noDays]);
    expect(fail({ ...minimalPlan, days: [{ title: 'no number' }] }).errors).toEqual([
      PLAN_ERRORS.noDays,
    ]);
    expect(fail({ ...minimalPlan, duration_days: 3, days: [{ day: 9 }] }).errors).toEqual([
      PLAN_ERRORS.noDays,
    ]);
  });

  it('rejects input over 512 KB', () => {
    const big = JSON.stringify({ ...minimalPlan, padding: 'x'.repeat(600 * 1024) });
    expect(fail(big).errors).toEqual([PLAN_ERRORS.tooLarge]);
  });
});

describe('parsePlan — fixes', () => {
  it('changes an unknown task type to check', () => {
    const plan = { ...fullPlan(30) };
    (plan.days as { tasks: { type: string }[] }[])[22]!.tasks[0]!.type = 'quiz';
    const r = ok(plan);
    expect(r.fixes).toContain('Day 23: task type "quiz" changed to done-or-not');
    const task = r.plan.days[22]!.tasks[0]!;
    expect(task.type).toBe('check');
    expect(task.target).toBeUndefined();
    expect(task.unit).toBeUndefined();
  });

  it('removes an unsupported verify source', () => {
    const plan = fullPlan(31);
    (plan.days as { tasks: { verify?: string }[] }[])[30]!.tasks[0]!.verify = 'HackerRank';
    const r = ok(plan);
    expect(r.fixes).toContain('Day 31: HackerRank check removed, not supported yet');
    expect(r.plan.days[30]!.tasks[0]!.verify).toBeUndefined();
  });

  it('removes steps verify on a non-count task', () => {
    const r = ok({
      ...minimalPlan,
      days: [{ day: 1, tasks: [{ title: 'Walk', type: 'minutes', target: 30, verify: 'steps' }] }],
    });
    expect(r.fixes[0]).toContain('steps check removed');
  });

  it('clamps a 150-day plan to 120 and drops extra days', () => {
    const r = ok(fullPlan(150));
    expect(r.plan.duration_days).toBe(120);
    expect(r.plan.days).toHaveLength(120);
    expect(r.fixes).toContain(
      'The plan length was changed from 150 to 120 days (allowed: 1 to 120)',
    );
    expect(r.fixes).toContain('30 days after day 120 removed (day 121–150)');
    // Phase 4 (46–150) no longer fits and milestone on day 150 is dropped.
    expect(r.plan.phases).toHaveLength(3);
    expect(r.plan.milestones).toHaveLength(1);
  });

  it('fills missing days 5–9 with open days', () => {
    const plan = fullPlan(14);
    plan.days = (plan.days as { day: number }[]).filter((d) => d.day < 5 || d.day > 9);
    const r = ok(plan);
    expect(r.plan.days).toHaveLength(14);
    expect(r.plan.days[4]).toEqual({ day: 5, title: 'Open day', rest: true, tasks: [] });
    expect(r.fixes).toContain('5 days were missing and added as open days (day 5–9)');
  });

  it('keeps the first of duplicate days', () => {
    const r = ok({
      ...minimalPlan,
      duration_days: 2,
      days: [
        { day: 1, title: 'First', tasks: [{ title: 'a' }] },
        { day: 1, title: 'Second', tasks: [{ title: 'b' }] },
        { day: 2, title: 'Two', tasks: [{ title: 'c' }] },
      ],
    });
    expect(r.plan.days[0]!.title).toBe('First');
    expect(r.fixes).toEqual(['Day 1 appeared more than once, kept the first one']);
  });

  it('trims a day with 12 tasks to 8', () => {
    const tasks = Array.from({ length: 12 }, (_, i) => ({ title: `Task ${i + 1}`, type: 'check' }));
    const r = ok({ ...minimalPlan, days: [{ day: 1, tasks }] });
    expect(r.plan.days[0]!.tasks).toHaveLength(8);
    expect(r.fixes).toEqual(['Day 1: 4 extra tasks removed (max 8 a day)']);
  });

  it('removes an http:// link', () => {
    const r = ok({
      ...minimalPlan,
      days: [{ day: 1, tasks: [{ title: 'Read', link: 'http://example.com' }] }],
    });
    expect(r.plan.days[0]!.tasks[0]!.link).toBeUndefined();
    expect(r.fixes).toEqual(['Day 1: a link was removed (links must start with https:// )']);
  });

  it('cuts long titles and records a fix', () => {
    const r = ok({
      ...minimalPlan,
      title: 'T'.repeat(100),
      goal: 'G'.repeat(200),
      days: [{ day: 1, title: 'D'.repeat(70), tasks: [{ title: 'x'.repeat(90) }] }],
    });
    expect(r.plan.title).toHaveLength(80);
    expect(r.plan.goal).toHaveLength(160);
    expect(r.plan.days[0]!.title).toHaveLength(60);
    expect(r.plan.days[0]!.tasks[0]!.title).toHaveLength(80);
    expect(r.fixes).toHaveLength(4);
  });

  it('names an untitled plan', () => {
    const r = ok({ ...minimalPlan, title: '  ' });
    expect(r.plan.title).toBe('My plan');
  });

  it('maps unknown category to other', () => {
    const r = ok({ ...minimalPlan, category: 'cooking' });
    expect(r.plan.category).toBe('other');
    expect(r.fixes).toEqual(['Category "cooking" changed to "other"']);
  });

  it('accepts category in any case', () => {
    expect(ok({ ...minimalPlan, category: 'Fitness' }).plan.category).toBe('fitness');
  });

  it('defaults invalid days_per_week', () => {
    const r = ok({ ...minimalPlan, days_per_week: 9 });
    expect(r.plan.days_per_week).toBe(7);
    expect(r.fixes).toEqual(['Days per week must be 1 to 7, set to 7']);
  });

  it('uses the highest day when duration is missing', () => {
    const r = ok({ sparksquad_plan: 1, title: 'x', days: [{ day: 3, tasks: [{ title: 'a' }] }] });
    expect(r.plan.duration_days).toBe(3);
    expect(r.fixes[0]).toBe('The plan length was missing, set to 3 days');
  });

  it('clamps duration below 1', () => {
    const r = ok({ ...minimalPlan, duration_days: 0 });
    expect(r.plan.duration_days).toBe(1);
  });

  it('fills missing and out-of-range targets', () => {
    const r = ok({
      ...minimalPlan,
      days: [
        {
          day: 1,
          tasks: [
            { title: 'a', type: 'count' },
            { title: 'b', type: 'minutes', target: 50000 },
            { title: 'c', type: 'count', target: -3, unit: 'u'.repeat(30) },
          ],
        },
      ],
    });
    const [a, b, c] = r.plan.days[0]!.tasks;
    expect(a).toMatchObject({ target: 1, unit: 'times' });
    expect(b).toMatchObject({ target: 10000 });
    expect(b!.unit).toBeUndefined();
    expect(c).toMatchObject({ target: 1 });
    expect(c!.unit).toHaveLength(20);
    expect(r.fixes).toHaveLength(4);
  });

  it('drops tasks without titles and invalid tasks', () => {
    const r = ok({
      ...minimalPlan,
      days: [{ day: 1, tasks: [{ title: '' }, 'oops', { title: 'Keep' }] }],
    });
    expect(r.plan.days[0]!.tasks).toHaveLength(1);
    expect(r.plan.days[0]!.tasks[0]!.id).toBe('d1t0');
    expect(r.fixes).toHaveLength(2);
  });

  it('turns a day with no tasks into a rest day', () => {
    const r = ok({
      ...minimalPlan,
      duration_days: 2,
      days: [{ day: 1, tasks: [{ title: 'a' }] }, { day: 2 }],
    });
    expect(r.plan.days[1]!.rest).toBe(true);
    expect(r.fixes).toEqual(['Day 2 had no tasks, so it is now a rest day']);
  });

  it('ignores tasks on rest days without a fix', () => {
    const r = ok({ ...minimalPlan, days: [{ day: 1, rest: true, tasks: [{ title: 'x' }] }] });
    expect(r.plan.days[0]!.tasks).toEqual([]);
    expect(r.fixes).toEqual([]);
  });

  it('drops days without day numbers', () => {
    const r = ok({ ...minimalPlan, days: [...minimalPlan.days, { title: 'lost' }] });
    expect(r.fixes).toEqual(['1 day without a day number was removed']);
  });

  it('drops overlapping and invalid phases', () => {
    const r = ok({
      ...fullPlan(30),
      phases: [
        { name: 'A', from_day: 1, to_day: 10 },
        { name: 'B', from_day: 5, to_day: 15 },
        { name: 'C', from_day: 11, to_day: 40 },
        { name: '', from_day: 11, to_day: 20 },
        'bad',
        { name: 'D', from_day: 21, to_day: 30 },
      ],
    });
    expect(r.plan.phases.map((p) => p.name)).toEqual(['A', 'D']);
    expect(r.fixes).toEqual(['4 phases were removed (outside the plan or overlapping)']);
  });

  it('caps phases at 12 and milestones at 20', () => {
    const r = ok({
      ...fullPlan(60),
      phases: Array.from({ length: 15 }, (_, i) => ({
        name: `P${i}`,
        from_day: i * 4 + 1,
        to_day: i * 4 + 4,
      })),
      milestones: Array.from({ length: 25 }, (_, i) => ({ day: i + 1, title: `M${i}` })),
    });
    expect(r.plan.phases).toHaveLength(12);
    expect(r.plan.milestones).toHaveLength(20);
  });

  it('drops invalid milestones', () => {
    const r = ok({ ...minimalPlan, milestones: [{ day: 5, title: 'x' }, { day: 1 }, 7] });
    expect(r.plan.milestones).toEqual([]);
    expect(r.fixes).toEqual(['3 milestones were removed (outside the plan)']);
  });

  it('cleans up verify casing', () => {
    const r = ok({
      ...minimalPlan,
      days: [{ day: 1, tasks: [{ title: 'Push code', type: 'check', verify: 'GitHub' }] }],
    });
    expect(r.plan.days[0]!.tasks[0]!.verify).toBe('github');
  });
});

describe('round trip and hashing', () => {
  it('exportPlan(parsePlan(x)) is stable', () => {
    const first = ok(fullPlan(60));
    const exported = exportPlan(first.plan);
    const second = ok(exported);
    expect(second.plan).toEqual(first.plan);
    expect(second.fixes).toEqual([]);
    expect(exportPlan(second.plan)).toBe(exported);
  });

  it('client text and server object produce the same hash', () => {
    const client = ok(chatterReply);
    const server = ok(JSON.parse(exportPlan(client.plan)) as unknown);
    expect(planHash(server.plan)).toBe(planHash(client.plan));
    expect(planHash(client.plan)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('different plans hash differently', () => {
    const a = ok(minimalPlan).plan;
    const b: Plan = { ...a, title: 'Other' };
    expect(planHash(a)).not.toBe(planHash(b));
  });

  it('planStats counts', () => {
    expect(planStats(ok(fullPlan(14)).plan)).toEqual({
      days: 14,
      tasks: 36,
      restDays: 2,
      phases: 1,
      verifiedTasks: 12,
    });
  });
});

describe('parsePlanDay', () => {
  it('normalises one day', () => {
    const r = parsePlanDay(
      { title: 'Edited', tasks: [{ title: 'New task', type: 'minutes', target: 15 }] },
      4,
    );
    expect(r.ok && r.day).toEqual({
      day: 4,
      title: 'Edited',
      rest: false,
      tasks: [{ id: 'd4t0', title: 'New task', type: 'minutes', target: 15 }],
    });
  });

  it('rejects non-objects', () => {
    expect(parsePlanDay('x', 1).ok).toBe(false);
  });
});
