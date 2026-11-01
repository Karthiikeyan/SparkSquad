import type { CheckinDTO } from '@sparksquad/shared';
import {
  badgeRows,
  badgeStrip,
  dayLevel,
  heatmapLevels,
  heatmapStart,
  HEATMAP_WEEKS,
  monthGrid,
  nextBadge,
  recapText,
  shiftMonth,
  shownUpPercent,
  weekStats,
} from '../model';

type C = Pick<CheckinDTO, 'localDate' | 'status'>;
const c = (localDate: string, status: CheckinDTO['status'] = 'done'): C => ({ localDate, status });

// 2026-10-31 is a Saturday.
const TODAY = '2026-10-31';

describe('heatmap', () => {
  it('starts on the Monday 17 weeks before this week', () => {
    expect(heatmapStart(TODAY)).toBe('2026-06-29');
    expect(heatmapStart('2026-10-26')).toBe('2026-06-29');
  });

  it('is 18 × 7, column-major, with levels by done count', () => {
    const levels = heatmapLevels(
      [
        c('2026-10-26'), // Monday this week: one done → 2
        c('2026-10-27'),
        c('2026-10-27'), // two done → 3
        c('2026-10-28', 'partial'), // → 1
        c('2026-10-29', 'honest_miss'), // → 1 (showed up honestly)
        c('2026-06-28'), // before the window, ignored
      ],
      TODAY,
    );
    expect(levels).toHaveLength(HEATMAP_WEEKS * 7);
    const week = levels.slice(-7);
    expect(week).toEqual([2, 3, 1, 1, 0, 0, 0]);
    expect(levels.slice(0, -7).every((l) => l === 0)).toBe(true);
  });

  it('leaves future days in this week empty', () => {
    const levels = heatmapLevels([c('2026-11-01')], TODAY);
    expect(levels[levels.length - 1]).toBe(0);
  });

  it('dayLevel uses the same scale', () => {
    const all = [c('2026-10-27'), c('2026-10-27'), c('2026-10-28', 'partial')];
    expect(dayLevel(all, '2026-10-27')).toBe(3);
    expect(dayLevel(all, '2026-10-28')).toBe(1);
    expect(dayLevel(all, '2026-10-29')).toBe(0);
  });
});

describe('shownUpPercent', () => {
  it('counts days with a check-in (not honest misses) since joining', () => {
    // Joined Monday; showed up Mon, Tue, Thu. Today (Sat) has nothing yet → 3 of 5 days.
    const all = [
      c('2026-10-26'),
      c('2026-10-27', 'partial'),
      c('2026-10-28', 'honest_miss'),
      c('2026-10-29'),
    ];
    expect(shownUpPercent(all, TODAY, '2026-10-26')).toBe(60);
  });

  it('counts today once there is a check-in, so mornings never drop the number', () => {
    expect(shownUpPercent([c(TODAY)], TODAY, TODAY)).toBe(100);
    expect(shownUpPercent([], TODAY, TODAY)).toBe(0);
  });

  it('caps the window at the heatmap span', () => {
    const all = Array.from({ length: 126 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 9, 31 - i));
      return c(d.toISOString().slice(0, 10));
    });
    expect(shownUpPercent(all, TODAY, '2025-01-01')).toBe(100);
  });
});

describe('weekly recap', () => {
  it('summarises this week from Monday', () => {
    const all = [
      { ...c('2026-10-25'), tasksDone: 9 }, // last Sunday
      { ...c('2026-10-26'), tasksDone: 2 },
      { ...c('2026-10-28', 'partial'), tasksDone: 1 },
      { ...c('2026-10-29', 'honest_miss'), tasksDone: 0 },
    ];
    const s = weekStats(all, TODAY, 4);
    expect(s).toEqual({ days: 2, elapsed: 6, tasks: 3, streak: 4 });
    expect(recapText(s)).toBe(
      'You showed up 2 of 6 days this week and finished 3 tasks. Your streak is 4 days. Tomorrow is a fresh start.',
    );
  });

  it('is encouraging when nothing is in yet and never mentions a 1-day streak', () => {
    expect(recapText({ days: 0, elapsed: 3, tasks: 0, streak: 0 })).toMatch(/One small task/);
    expect(recapText({ days: 1, elapsed: 1, tasks: 0, streak: 1 })).toBe(
      'You showed up 1 of 1 days this week.',
    );
  });
});

describe('badgeRows', () => {
  it('lists earned first, then locked with what is left', () => {
    const rows = badgeRows(
      [
        { badge: 'streak_7', earnedAt: '2026-10-07T00:00:00Z' },
        { badge: 'first_checkin', earnedAt: '2026-10-01T00:00:00Z' },
      ],
      12,
      8,
    );
    expect(rows.map((r) => [r.badge, r.earned, r.toGo])).toEqual([
      ['first_checkin', true, null],
      ['streak_7', true, null],
      ['streak_3', false, 1],
      ['streak_14', false, 2],
      ['streak_21', false, 9],
      ['streak_30', false, 18],
      ['streak_60', false, 48],
      ['streak_100', false, 88],
      ['checkins_10', false, 2],
      ['checkins_50', false, 42],
      ['checkins_100', false, 92],
      ['challenge_complete', false, null],
    ]);
    expect(rows.find((r) => r.badge === 'streak_21')?.glyph).toBe('21');
    expect(rows.find((r) => r.badge === 'checkins_10')).toMatchObject({
      group: 'checkins',
      current: 8,
      tier: 1,
    });
    expect(rows.find((r) => r.badge === 'streak_100')?.tier).toBe(3);
  });

  it('picks the closest locked badge as up next', () => {
    const rows = badgeRows([], 12, 8);
    expect(nextBadge(rows)?.badge).toBe('streak_3');
    const later = badgeRows(
      [
        { badge: 'streak_3', earnedAt: '2026-10-03T00:00:00Z' },
        { badge: 'streak_7', earnedAt: '2026-10-07T00:00:00Z' },
      ],
      12,
      8,
    );
    expect(nextBadge(later)?.badge).toBe('streak_14');
  });

  it('always shows three badges on the profile, newest earned then closest locked', () => {
    expect(badgeStrip(badgeRows([], 0, 0)).map((r) => r.earned)).toEqual([false, false, false]);
    const strip = badgeStrip(
      badgeRows([{ badge: 'first_checkin', earnedAt: '2026-10-01T00:00:00Z' }], 2, 2),
    );
    expect(strip.map((r) => r.badge)).toEqual(['first_checkin', 'streak_3', 'streak_7']);
  });
});

describe('month grid', () => {
  it('pads so the 1st lands on its weekday (Monday first)', () => {
    const oct = monthGrid(2026, 10); // 1 Oct 2026 is a Thursday
    expect(oct.slice(0, 4)).toEqual([null, null, null, '2026-10-01']);
    expect(oct.filter(Boolean)).toHaveLength(31);
    expect(monthGrid(2028, 2).filter(Boolean)).toHaveLength(29);
  });

  it('shifts across years', () => {
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
  });
});
