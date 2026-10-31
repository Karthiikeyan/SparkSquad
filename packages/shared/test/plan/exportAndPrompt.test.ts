import { describe, expect, it } from 'vitest';
import {
  BYOK_SYSTEM_RULE,
  PROMPT_EXAMPLE_PLAN,
  PROMPT_GOAL_PLACEHOLDER,
  buildPrompt,
  buildRepairMessage,
  canonicalJson,
  exportPlan,
  mergeDayEdits,
  parsePlan,
  planFileName,
  planSlug,
  sha256Hex,
} from '../../src/plan';
import { fullPlan } from './fixtures';

describe('buildPrompt', () => {
  it('inserts the goal and minified format', () => {
    const p = buildPrompt('  Crack DSA   in 60 days ');
    expect(p).toContain('My goal: Crack DSA in 60 days');
    expect(p).toContain(JSON.stringify(PROMPT_EXAMPLE_PLAN));
    expect(p).not.toContain('{{');
    expect(p).not.toContain(BYOK_SYSTEM_RULE);
  });

  it('uses the placeholder when empty', () => {
    expect(buildPrompt('')).toContain(`My goal: ${PROMPT_GOAL_PLACEHOLDER}`);
  });

  it('keeps $ characters in goals literally', () => {
    expect(buildPrompt('Save $& money')).toContain('My goal: Save $& money');
  });

  it('adds the BYOK rule', () => {
    expect(buildPrompt('x', { byok: true }).endsWith(BYOK_SYSTEM_RULE)).toBe(true);
  });

  it('the example in the prompt is itself a valid plan', () => {
    const r = parsePlan(PROMPT_EXAMPLE_PLAN);
    expect(r.ok).toBe(true);
  });

  it('builds a repair message', () => {
    expect(buildRepairMessage(['a', 'b'])).toBe('repair:\n- a\n- b');
  });
});

describe('exportPlan', () => {
  const parsed = parsePlan(fullPlan(14));
  if (!parsed.ok) throw new Error('fixture');
  const plan = parsed.plan;

  it('merges day edits', () => {
    const merged = mergeDayEdits(plan, [
      {
        day: 3,
        title: 'Edited',
        rest: false,
        tasks: [{ id: 'old', title: 'New', type: 'check' }],
      },
    ]);
    expect(merged.days[2]).toEqual({
      day: 3,
      title: 'Edited',
      rest: false,
      tasks: [{ id: 'd3t0', title: 'New', type: 'check' }],
    });
    expect(mergeDayEdits(plan)).toBe(plan);
    const json = JSON.parse(exportPlan(plan, [{ day: 3, title: 'Edited', rest: true, tasks: [] }]));
    expect(json.days[2]).toEqual({ day: 3, title: 'Edited', rest: true, tasks: [] });
  });

  it('writes the documented format without ids', () => {
    const text = exportPlan(plan);
    expect(text.endsWith('\n')).toBe(true);
    const json = JSON.parse(text);
    expect(Object.keys(json)).toEqual([
      'sparksquad_plan',
      'title',
      'goal',
      'category',
      'duration_days',
      'days_per_week',
      'phases',
      'days',
      'milestones',
    ]);
    expect(text).not.toContain('"id"');
  });

  it('slugs file names', () => {
    expect(planFileName('60 days of DSA!')).toBe('60-days-of-dsa.sparksquad.json');
    expect(planSlug('Café ☕ plan')).toBe('cafe-plan');
    expect(planSlug('!!!')).toBe('plan');
    expect(planSlug('a'.repeat(39) + ' b')).toBe('a'.repeat(39));
  });
});

describe('hash', () => {
  it('matches SHA-256 test vectors', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('a'.repeat(1000))).toBe(
      '41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3',
    );
    expect(sha256Hex(new TextEncoder().encode('abc'))).toBe(sha256Hex('abc'));
  });

  it('canonical JSON sorts keys and drops undefined', () => {
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: undefined }, null] })).toBe(
      '{"a":[{"d":2},null],"b":1}',
    );
    expect(canonicalJson(undefined)).toBe('null');
  });
});
