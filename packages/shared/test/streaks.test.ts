import { describe, expect, it } from 'vitest';
import { addDays } from '../src/date';
import {
  EMPTY_STREAK,
  applyDayOutcome,
  badgeProgress,
  newBadges,
  replayStreak,
  type DayOutcome,
} from '../src/streaks';

function days(outcomes: DayOutcome[], start = '2026-11-02') {
  return outcomes.map((outcome, i) => ({ date: addDays(start, i), outcome }));
}

describe('streaks', () => {
  it('counts consecutive done days and tracks best', () => {
    const { state } = replayStreak(days(['done', 'done', 'done', 'missed', 'done']), 2);
    expect(state.current).toBe(1);
    expect(state.best).toBe(3);
    expect(state.lastDoneDate).toBe('2026-11-06');
  });

  it('rest and pending days do not change the streak', () => {
    const { state } = replayStreak(days(['done', 'rest', 'done', 'pending']), 2);
    expect(state.current).toBe(2);
  });

  it('earns a freeze every 7 days, capped by the tier', () => {
    const seven = Array<DayOutcome>(7).fill('done');
    const r = replayStreak(days([...seven, ...seven, ...seven]), 2);
    expect(r.state.freezes).toBe(2);
    expect(r.events.filter((e) => e.kind === 'freeze_earned')).toHaveLength(2);
    const plus = replayStreak(days([...seven, ...seven, ...seven]), 5);
    expect(plus.state.freezes).toBe(3);
  });

  it('uses a freeze on a missed day and keeps the streak', () => {
    const seven = Array<DayOutcome>(7).fill('done');
    const r = replayStreak(days([...seven, 'missed', 'done']), 2);
    expect(r.state.current).toBe(8);
    expect(r.state.freezes).toBe(0);
    expect(r.events.map((e) => e.kind)).toEqual(['freeze_earned', 'freeze_used']);
  });

  it('honest miss uses a freeze when available, else resets', () => {
    const withFreeze = applyDayOutcome(
      { current: 5, best: 5, freezes: 1, lastDoneDate: '2026-11-01' },
      '2026-11-02',
      'honest_miss',
      2,
    );
    expect(withFreeze.state.current).toBe(5);
    expect(withFreeze.events[0]!.kind).toBe('freeze_used');

    const without = applyDayOutcome(
      { current: 5, best: 5, freezes: 0, lastDoneDate: '2026-11-01' },
      '2026-11-02',
      'honest_miss',
      2,
    );
    expect(without.state.current).toBe(0);
    expect(without.events[0]).toEqual({ kind: 'streak_reset', date: '2026-11-02', lost: 5 });
  });

  it('a miss with no streak does not spend a freeze', () => {
    const r = applyDayOutcome({ ...EMPTY_STREAK, freezes: 2 }, '2026-11-02', 'missed', 2);
    expect(r.state.freezes).toBe(2);
    expect(r.events).toEqual([]);
  });

  it('caps banked freezes when a plan downgrades', () => {
    const r = applyDayOutcome({ ...EMPTY_STREAK, freezes: 5 }, '2026-11-02', 'rest', 2);
    expect(r.state.freezes).toBe(2);
  });
});

describe('badges', () => {
  it('awards new badges only', () => {
    expect(
      newBadges(
        { totalCheckins: 30, currentStreak: 21, challengeCompleted: true },
        new Set(['first_checkin']),
      ),
    ).toEqual(['streak_7', 'streak_21', 'challenge_complete']);
    expect(
      newBadges({ totalCheckins: 0, currentStreak: 0, challengeCompleted: false }, new Set()),
    ).toEqual([]);
  });

  it('reports progress', () => {
    const facts = { totalCheckins: 3, bestStreak: 14, challengesCompleted: 0 };
    expect(badgeProgress('first_checkin', facts)).toBe(1);
    expect(badgeProgress('streak_7', facts)).toBe(1);
    expect(badgeProgress('streak_21', facts)).toBeCloseTo(14 / 21);
    expect(badgeProgress('challenge_complete', facts)).toBe(0);
  });
});
