import type { SquadPreviewDTO } from '@sparksquad/shared';
import {
  addRecent,
  joinLabel,
  sortStartingSoon,
  squadMeta,
  squadTimeline,
} from '../../discover/model';
import { afterPlanRoute, buildBlankPlan, clampStartDate, defaultStartDate } from '../flow';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

describe('create flow helpers', () => {
  it('defaults to next Monday and clamps to the API window', () => {
    expect(defaultStartDate('2026-10-31')).toBe('2026-11-02');
    expect(defaultStartDate('2026-11-02')).toBe('2026-11-09');
    expect(clampStartDate('2026-10-01', '2026-10-31')).toBe('2026-10-31');
    expect(clampStartDate('2027-06-01', '2026-10-31')).toBe('2027-01-29');
    expect(clampStartDate('2026-11-10', '2026-10-31')).toBe('2026-11-10');
  });

  it('sends Discover templates through basics first', () => {
    expect(afterPlanRoute({ existing: false, basics: null })).toBe('/create/basics');
    expect(afterPlanRoute({ existing: true, basics: null })).toBe('/create/review');
    expect(
      afterPlanRoute({
        existing: false,
        basics: { name: 'S', category: 'career', privacy: 'private' },
      }),
    ).toBe('/create/review');
  });

  it('builds a blank plan with review days for short weeks', () => {
    const r = buildBlankPlan({
      title: ' SQL sprint ',
      category: 'career',
      durationDays: 14,
      daysPerWeek: 5,
      tasks: [{ title: 'Solve one query', type: 'check' }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.title).toBe('SQL sprint');
    expect(r.plan.days).toHaveLength(14);
    expect(r.plan.days.filter((d) => d.rest).map((d) => d.day)).toEqual([6, 7, 13, 14]);
    expect(r.stats.tasks).toBe(10);
  });
});

describe('discover helpers', () => {
  const s = (id: string, start: string | null): SquadPreviewDTO => ({
    id,
    name: id,
    description: '',
    rules: '',
    category: 'career',
    privacy: 'public',
    memberCount: 64,
    memberLimit: 100,
    owner: { id: 'o', username: null, displayName: 'O', avatarColor: 0 },
    challenge: start
      ? { id: 'c', title: 'DSA 60', durationDays: 60, startDate: start, daysPerWeek: 7 }
      : null,
    myStatus: null,
  });

  it('describes when a squad starts', () => {
    expect(squadMeta(s('a', '2026-11-03'), '2026-10-31')).toBe(
      '64 of 100 joined, starts Tuesday 3 November',
    );
    expect(squadMeta(s('a', '2026-10-20'), '2026-10-31')).toBe(
      '64 of 100 joined, started Tuesday 20 October',
    );
    expect(squadMeta(s('a', null), '2026-10-31')).toBe('64 of 100 joined');
  });

  it('sorts upcoming squads first, soonest first', () => {
    const list = [
      s('none', null),
      s('running', '2026-10-01'),
      s('later', '2026-11-10'),
      s('soon', '2026-11-02'),
    ];
    expect(sortStartingSoon(list, '2026-10-31').map((x) => x.id)).toEqual([
      'soon',
      'later',
      'running',
      'none',
    ]);
  });

  it('keeps recent searches unique and short', () => {
    expect(addRecent(['dsa', 'sql'], 'SQL')).toEqual(['SQL', 'dsa']);
    expect(addRecent(['a', 'b', 'c', 'd', 'e', 'f'], 'g')).toHaveLength(6);
    expect(addRecent(['a'], '  ')).toEqual(['a']);
  });

  it('describes a squad on a card and labels the join button', () => {
    expect(squadTimeline(s('a', '2026-11-03'), '2026-10-31')).toBe('Starts Tuesday 3 November');
    expect(squadTimeline(s('a', '2026-10-20'), '2026-10-31')).toBe('Day 12 of 60');
    expect(squadTimeline(s('a', null), '2026-10-31')).toBe('Plan coming soon');
    expect(joinLabel(s('a', null))).toBe('Join');
    expect(joinLabel({ ...s('a', null), myStatus: 'active' })).toBe('Open');
  });
});
