import type { Plan, PlanDay, PlanTask } from '@sparksquad/shared';
import { challenge, checkin, me, ME_ID, squad } from '../../../test/fixtures';
import {
  buildTodayCards,
  globalStreak,
  pendingCards,
  predictedStreak,
  type TodaySource,
} from '../model';

// 2026-10-31 12:00 IST; the fixture challenge starts 2026-10-20 → day 12.
const NOW = new Date('2026-10-31T06:30:00.000Z');

const tasks: PlanTask[] = [
  {
    id: 'a',
    title: 'Solve 2 medium array problems',
    type: 'count',
    target: 2,
    unit: 'problems',
    verify: 'leetcode',
  },
  { id: 'b', title: 'Watch the lesson', type: 'minutes', target: 30 },
  { id: 'c', title: 'Write notes', type: 'check' },
];

function plan(days: PlanDay[]): Plan {
  return {
    sparksquad_plan: 1,
    title: 'DSA 60',
    category: 'career',
    duration_days: 60,
    days_per_week: 7,
    phases: [],
    days,
    milestones: [],
  };
}

const allDays = (overrides: Record<number, Partial<PlanDay>> = {}) =>
  Array.from({ length: 60 }, (_, i) => ({
    day: i + 1,
    title: `Day ${i + 1}`,
    rest: false,
    tasks,
    ...overrides[i + 1],
  }));

function source(over: Partial<TodaySource> = {}): TodaySource {
  return {
    me: me(),
    squads: [squad('S1', { name: 'Placement Squad 7' })],
    challenges: [challenge('C1', 'S1')],
    members: new Map([['S1', [ME_ID, 'U2', 'U3']]]),
    users: new Map([
      ['U2', { id: 'U2', displayName: 'Divya', avatarColor: 1 }],
      ['U3', { id: 'U3', displayName: 'Arun', avatarColor: 2 }],
    ]),
    plans: new Map([['hash1', plan(allDays())]]),
    edits: new Map(),
    checkins: [],
    pendingCheckinIds: new Set(),
    streaks: [],
    ...over,
  };
}

describe('buildTodayCards', () => {
  it('builds an active card with day number, tasks and the squad ring', () => {
    const [card] = buildTodayCards(
      source({ checkins: [checkin('K2', 'C1', 'U3', '2026-10-31')] }),
      NOW,
    );
    expect(card).toMatchObject({
      state: 'active',
      today: '2026-10-31',
      dayNumber: 12,
      kind: 'tasks',
    });
    expect(card!.day?.tasks).toHaveLength(3);
    expect(card!.mine).toBeNull();
    // Checked-in others first, me last.
    expect(card!.members.map((m) => [m.name, m.checked])).toEqual([
      ['Arun', true],
      ['Divya', false],
      ['Kiran Raj', false],
    ]);
    expect(card!.checkedCount).toBe(1);
    expect(pendingCards([card!])).toHaveLength(1);
  });

  it('marks my check-in and its pending sync state', () => {
    const mine = checkin('K1', 'C1', ME_ID, '2026-10-31');
    const [card] = buildTodayCards(
      source({ checkins: [mine], pendingCheckinIds: new Set(['K1']) }),
      NOW,
    );
    expect(card!.mine?.id).toBe('K1');
    expect(card!.minePending).toBe(true);
    expect(card!.members.at(-1)).toMatchObject({ isMe: true, checked: true });
    expect(pendingCards([card!])).toHaveLength(0);
  });

  it('offers yesterday as a backfill when it was missed and the window is open', () => {
    const [card] = buildTodayCards(source(), NOW);
    expect(card!.backfill).toEqual({ date: '2026-10-30', dayNumber: 11 });
    const [done] = buildTodayCards(
      source({ checkins: [checkin('K0', 'C1', ME_ID, '2026-10-30')] }),
      NOW,
    );
    expect(done!.backfill).toBeNull();
  });

  it('never offers a rest day as a backfill', () => {
    const src = source({
      plans: new Map([['hash1', plan(allDays({ 11: { rest: true, tasks: [] } }))]]),
    });
    expect(buildTodayCards(src, NOW)[0]!.backfill).toBeNull();
  });

  it('applies owner day edits over the stored plan', () => {
    const edit: PlanDay = { day: 12, title: 'Edited', rest: false, tasks: [tasks[2]!] };
    const [card] = buildTodayCards(source({ edits: new Map([['C1', [edit]]]) }), NOW);
    expect(card!.day?.title).toBe('Edited');
    expect(card!.day?.tasks.map((t) => t.id)).toEqual(['d12t0']);
  });

  it('shows upcoming and plan-loading states', () => {
    const upcoming = { ...challenge('C2', 'S1'), startDate: '2026-11-03', planHash: 'missing' };
    const cards = buildTodayCards(source({ challenges: [challenge('C1', 'S1'), upcoming] }), NOW);
    expect(cards.map((c) => c.state)).toEqual(['active', 'upcoming']);
    expect(cards[1]!.day).toBeNull();
    expect(cards[1]!.backfill).toBeNull();
  });

  it('uses the steps variant for a single steps-verified count task', () => {
    const steps: PlanTask = {
      id: 's',
      title: 'Walk 10K steps',
      type: 'count',
      target: 10000,
      unit: 'steps',
      verify: 'steps',
    };
    const src = source({
      plans: new Map([['hash1', plan(allDays().map((d) => ({ ...d, tasks: [steps] })))]]),
    });
    expect(buildTodayCards(src, NOW)[0]!.kind).toBe('steps');
  });

  it('sorts open cards before checked-in ones and skips unknown squads', () => {
    const c2 = { ...challenge('C2', 'S1'), title: 'Aptitude 21' };
    const orphan = challenge('C3', 'NOPE');
    const cards = buildTodayCards(
      source({
        challenges: [challenge('C1', 'S1'), c2, orphan],
        checkins: [checkin('K1', 'C1', ME_ID, '2026-10-31')],
      }),
      NOW,
    );
    expect(cards.map((c) => c.challenge.id)).toEqual(['C2', 'C1']);
  });
});

describe('streak helpers', () => {
  it('finds the global streak', () => {
    expect(
      globalStreak([
        { scope: 'C1', current: 1, best: 1, freezes: 0, lastDoneDate: null, updatedAt: '' },
      ]),
    ).toBeNull();
  });

  it('predicts the streak shown on the success screen', () => {
    expect(predictedStreak({ current: 11, lastDoneDate: '2026-10-30' }, '2026-10-31', true)).toBe(
      12,
    );
    expect(predictedStreak({ current: 12, lastDoneDate: '2026-10-31' }, '2026-10-31', true)).toBe(
      12,
    );
    expect(predictedStreak(null, '2026-10-31', true)).toBe(1);
    expect(predictedStreak({ current: 5, lastDoneDate: '2026-10-30' }, '2026-10-31', false)).toBe(
      5,
    );
  });
});
