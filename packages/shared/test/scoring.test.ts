import { describe, expect, it } from 'vitest';
import {
  computeCheckinStatus,
  consistencyPercent,
  countsAsDone,
  rankLeaderboard,
  taskMet,
  tasksCompleted,
} from '../src/scoring';

const tasks = [
  { type: 'count' as const, target: 2 },
  { type: 'minutes' as const, target: 30 },
  { type: 'check' as const },
];

describe('tasks', () => {
  it('evaluates individual tasks', () => {
    expect(taskMet({ type: 'check' }, true)).toBe(true);
    expect(taskMet({ type: 'check' }, false)).toBe(false);
    expect(taskMet({ type: 'check' }, 1)).toBe(true);
    expect(taskMet({ type: 'check' }, undefined)).toBe(false);
    expect(taskMet({ type: 'count', target: 2 }, 2)).toBe(true);
    expect(taskMet({ type: 'count', target: 2 }, 1)).toBe(false);
    expect(taskMet({ type: 'count', target: 2 }, true)).toBe(false);
    expect(taskMet({ type: 'minutes' }, 1)).toBe(true);
  });

  it('counts completed tasks', () => {
    expect(
      tasksCompleted(tasks, [
        { t: 0, v: 2 },
        { t: 2, v: true },
      ]),
    ).toBe(2);
  });
});

describe('computeCheckinStatus', () => {
  it('done when all tasks are met', () => {
    expect(
      computeCheckinStatus(tasks, [
        { t: 0, v: 3 },
        { t: 1, v: 30 },
        { t: 2, v: true },
      ]),
    ).toEqual({ status: 'done', completed: 3, fraction: 1 });
  });

  it('partial otherwise', () => {
    expect(computeCheckinStatus(tasks, [{ t: 0, v: 2 }]).status).toBe('partial');
    expect(computeCheckinStatus(tasks, []).completed).toBe(0);
  });

  it('honest miss', () => {
    expect(computeCheckinStatus(tasks, [{ t: 0, v: 2 }], true).status).toBe('honest_miss');
  });

  it('rest days are done', () => {
    expect(computeCheckinStatus([], []).status).toBe('done');
  });

  it('partial counts as done at 50% when allowed', () => {
    expect(countsAsDone('done', 1, false)).toBe(true);
    expect(countsAsDone('partial', 0.5, true)).toBe(true);
    expect(countsAsDone('partial', 0.33, true)).toBe(false);
    expect(countsAsDone('partial', 0.9, false)).toBe(false);
    expect(countsAsDone('honest_miss', 0, true)).toBe(false);
  });
});

describe('leaderboard', () => {
  it('computes consistency', () => {
    expect(consistencyPercent(11, 12)).toBe(92);
    expect(consistencyPercent(0, 0)).toBe(0);
    expect(consistencyPercent(15, 12)).toBe(100);
  });

  it('ranks by score then tasks, sharing exact ties', () => {
    const rows = rankLeaderboard([
      { userId: 'u3', name: 'Arun', daysDone: 11, daysElapsed: 12, tasksDone: 33 },
      { userId: 'u2', name: 'You', daysDone: 12, daysElapsed: 12, tasksDone: 34 },
      { userId: 'u1', name: 'Divya', daysDone: 12, daysElapsed: 12, tasksDone: 36 },
      { userId: 'u4', name: 'Meena', daysDone: 11, daysElapsed: 12, tasksDone: 33 },
      { userId: 'u5', name: 'Nisha', daysDone: 0, daysElapsed: 0, tasksDone: 0 },
    ]);
    expect(rows.map((r) => [r.name, r.rank, r.score])).toEqual([
      ['Divya', 1, 100],
      ['You', 2, 100],
      ['Arun', 3, 92],
      ['Meena', 3, 92],
      ['Nisha', 5, 0],
    ]);
  });

  it('ranks members who joined later fairly by ratio', () => {
    const rows = rankLeaderboard([
      { userId: 'a', name: 'A', daysDone: 9, daysElapsed: 12, tasksDone: 50 },
      { userId: 'b', name: 'B', daysDone: 4, daysElapsed: 4, tasksDone: 12 },
    ]);
    expect(rows[0]!.userId).toBe('b');
  });

  it('breaks full ties by user id for stability', () => {
    const rows = rankLeaderboard([
      { userId: 'b', name: 'Same', daysDone: 1, daysElapsed: 1, tasksDone: 1 },
      { userId: 'a', name: 'Same', daysDone: 1, daysElapsed: 1, tasksDone: 1 },
    ]);
    expect(rows.map((r) => r.userId)).toEqual(['a', 'b']);
    expect(rows.map((r) => r.rank)).toEqual([1, 1]);
  });
});
