import type { CheckinDTO, Plan, PlanDay } from '@sparksquad/shared';
import { eq } from 'drizzle-orm';
import { checkins, nudges } from '../../../lib/db/schema';
import { createOutbox } from '../../../lib/outbox/outbox';
import { upsertCheckinRow } from '../../../lib/sync/applySync';
import { challenge, checkin, me, ME_ID, squad } from '../../../test/fixtures';
import { createTestDb } from '../../../test/testDb';
import { needsTasks } from '../screens/LeaderboardSection';
import { memberActions } from '../screens/MembersScreen';
import { moveItem, toPayloadTasks, toDraftTask } from '../../plan/TaskEditor';
import { squadChanges } from '../screens/SquadSettingsScreen';
import { longestStreaks } from '../screens/ShareCardScreen';
import { sendNudge, toggleFire } from '../actions';
import {
  buildBoard,
  canEditDay,
  currentRuns,
  nextMilestone,
  phaseFor,
  planStrip,
  restChecker,
  weekdayLetter,
} from '../model';
import type { SquadSource } from '../source';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('../../../lib/runtime', () => ({
  refresh: jest.fn(async () => undefined),
  getRuntime: jest.fn(),
}));

const NOW = new Date('2026-10-31T06:30:00.000Z'); // 12:00 IST, day 12 of the fixture challenge

const days = (rest: number[] = []): PlanDay[] =>
  Array.from({ length: 60 }, (_, i) => ({
    day: i + 1,
    title: `Day ${i + 1}`,
    rest: rest.includes(i + 1),
    tasks: rest.includes(i + 1)
      ? []
      : [
          { id: 'a', title: 'Problems', type: 'count' as const, target: 2, unit: 'problems' },
          { id: 'b', title: 'Notes', type: 'check' as const },
        ],
  }));

const plan = (rest: number[] = []): Plan => ({
  sparksquad_plan: 1,
  title: 'DSA 60',
  category: 'career',
  duration_days: 60,
  days_per_week: 7,
  phases: [
    { name: 'Arrays', from_day: 1, to_day: 14 },
    { name: 'Trees', from_day: 15, to_day: 60 },
  ],
  days: days(rest),
  milestones: [
    { day: 30, title: 'Halfway' },
    { day: 14, title: 'Arrays done' },
  ],
});

function src(over: Partial<SquadSource> = {}): SquadSource {
  return {
    me: me(),
    squad: squad('S1'),
    myRole: 'owner',
    members: [
      {
        userId: ME_ID,
        role: 'owner',
        joinedAt: '',
        name: 'Kiran Raj',
        username: 'me',
        avatarColor: 5,
      },
      {
        userId: 'U2',
        role: 'member',
        joinedAt: '',
        name: 'Divya S',
        username: null,
        avatarColor: 1,
      },
      { userId: 'U3', role: 'member', joinedAt: '', name: 'Arun', username: null, avatarColor: 2 },
    ],
    challenge: challenge('C1', 'S1'),
    plan: plan(),
    edits: [],
    checkins: [],
    pendingIds: new Set(),
    nudgedToday: new Set(),
    announcement: null,
    ...over,
  };
}

const ck = (id: string, user: string, date: string, over: Partial<CheckinDTO> = {}) =>
  checkin(id, 'C1', user, date, over);

describe('buildBoard', () => {
  it('counts who showed up, orders the grid and lists who to nudge', () => {
    const board = buildBoard(
      src({
        checkins: [
          ck('K2', 'U2', '2026-10-31', {
            values: [
              { t: 0, v: 2 },
              { t: 1, v: true },
            ],
            updatedAt: '2026-10-31T02:00:00Z',
          }),
          ck('K9', 'U3', '2026-10-30'),
        ],
        nudgedToday: new Set(['U3']),
      }),
      NOW,
    );
    expect(board).toMatchObject({ state: 'running', dayNumber: 12, checkedCount: 1 });
    expect(board.grid.map((m) => m.id)).toEqual(['U2', ME_ID, 'U3']);
    expect(board.stillToCheckIn).toEqual([expect.objectContaining({ id: 'U3', nudged: true })]);
    expect(board.feed).toHaveLength(1);
    expect(board.feed[0]).toMatchObject({ tasksDone: 2, tasksTotal: 2 });
  });

  it('nudges nobody on a rest day or before the start', () => {
    expect(buildBoard(src({ plan: plan([12]) }), NOW).stillToCheckIn).toEqual([]);
    const upcoming = { ...challenge('C1', 'S1'), startDate: '2026-11-03' };
    expect(buildBoard(src({ challenge: upcoming }), NOW)).toMatchObject({
      state: 'upcoming',
      stillToCheckIn: [],
    });
    expect(buildBoard(src({ challenge: null }), NOW).state).toBe('none');
  });
});

describe('runs and streak lines', () => {
  it('counts consecutive days, skips rest days, ignores honest misses', () => {
    const checks = [
      ck('a', 'U2', '2026-10-31'),
      ck('b', 'U2', '2026-10-30'),
      ck('c', 'U2', '2026-10-28'),
      ck('d', 'U3', '2026-10-30'),
      ck('e', 'U3', '2026-10-29', { status: 'honest_miss' }),
    ];
    const isRest = (d: string) => d === '2026-10-29';
    const runs = currentRuns(checks, '2026-10-31', isRest);
    expect(runs.get('U2')).toBe(3);
    expect(runs.get('U3')).toBe(1);
    expect(currentRuns(checks, '2026-10-31').get('U2')).toBe(2);
  });

  it('builds the share card streak line from first names', () => {
    const s = src({
      checkins: [
        ck('a', 'U2', '2026-10-31'),
        ck('b', 'U2', '2026-10-30'),
        ck('c', ME_ID, '2026-10-31'),
      ],
    });
    expect(longestStreaks(s, '2026-10-31')).toEqual([
      { name: 'Divya', n: 2 },
      { name: 'Kiran', n: 1 },
    ]);
    expect(restChecker(src({ plan: plan([5]) }))('2026-10-24')).toBe(true);
  });
});

describe('plan segment', () => {
  it('finds the phase, progress and next milestone', () => {
    expect(phaseFor(plan(), 12)).toMatchObject({ index: 1, total: 2, progress: 12 / 14 });
    expect(phaseFor(plan(), 99)).toBeNull();
    expect(nextMilestone(plan(), 12)?.title).toBe('Arrays done');
    expect(nextMilestone(plan(), 31)).toBeNull();
  });

  it('marks strip days without shaming unknown history', () => {
    const strip = planStrip(
      src({
        plan: plan([3]),
        checkins: [
          ck('a', ME_ID, '2026-10-30'),
          ck('b', ME_ID, '2026-10-25', { status: 'honest_miss' }),
        ],
      }),
      '2026-10-31',
      '2026-10-24',
    );
    const state = (n: number) => strip[n - 1]!.state;
    expect(state(1)).toBe('past'); // before the synced range
    expect(state(3)).toBe('rest');
    expect(state(6)).toBe('missed'); // honest miss
    expect(state(10)).toBe('missed');
    expect(state(11)).toBe('done');
    expect(state(12)).toBe('today');
    expect(state(13)).toBe('future');
    expect(strip).toHaveLength(60);
    expect(weekdayLetter('2026-10-31')).toBe('S');
  });

  it('only allows editing future days', () => {
    const ch = challenge('C1', 'S1');
    expect(canEditDay(ch, 12, '2026-10-31')).toBe(false);
    expect(canEditDay(ch, 13, '2026-10-31')).toBe(true);
  });
});

describe('squad actions on the local store', () => {
  it('toggles fire optimistically and coalesces the queue', async () => {
    const { db } = await createTestDb();
    const outbox = createOutbox({ db, handlers: {} as never });
    await upsertCheckinRow(db, ck('K1', 'U2', '2026-10-31', { reactionCount: 2 }));
    expect(await toggleFire(db, outbox, 'K1')).toBe(true);
    let data = JSON.parse(
      (await db.select().from(checkins).where(eq(checkins.id, 'K1')).get())!.data,
    );
    expect(data).toMatchObject({ reactionCount: 3, reactedByMe: true });
    expect(await toggleFire(db, outbox, 'K1')).toBe(false);
    data = JSON.parse((await db.select().from(checkins).where(eq(checkins.id, 'K1')).get())!.data);
    expect(data).toMatchObject({ reactionCount: 2, reactedByMe: false });
    const queued = await outbox.list();
    expect(queued).toHaveLength(1);
    expect(queued[0]!.payload).toEqual({ checkinId: 'K1', on: false });
    expect(await toggleFire(db, outbox, 'missing')).toBe(false);
  });

  it('records a nudge locally and queues it once', async () => {
    const { db } = await createTestDb();
    const outbox = createOutbox({ db, handlers: {} as never });
    const args = { challengeId: 'C1', fromUserId: ME_ID, toUserId: 'U2', localDate: '2026-10-31' };
    await sendNudge(db, outbox, args);
    await sendNudge(db, outbox, args);
    expect(await db.select().from(nudges).all()).toHaveLength(1);
    expect(await outbox.list()).toHaveLength(1);
  });
});

describe('screen helpers', () => {
  it('limits member actions by role', () => {
    expect(memberActions('owner', { role: 'member' }, false)).toEqual({
      promote: true,
      demote: false,
      remove: true,
      report: true,
    });
    expect(memberActions('owner', { role: 'admin' }, false)).toMatchObject({
      demote: true,
      remove: true,
    });
    expect(memberActions('admin', { role: 'admin' }, false)).toMatchObject({
      promote: false,
      remove: false,
    });
    expect(memberActions('admin', { role: 'member' }, false)).toMatchObject({ remove: true });
    expect(memberActions('member', { role: 'member' }, false)).toEqual({
      promote: false,
      demote: false,
      remove: false,
      report: true,
    });
    expect(memberActions('owner', { role: 'owner' }, true)).toMatchObject({
      remove: false,
      report: false,
    });
  });

  it('shows tasks only for tied leaderboard rows', () => {
    const e = (id: string, done: number, tasks: number) => ({
      rank: 1,
      user: { id, username: null, displayName: id, avatarColor: 0 },
      daysDone: done,
      daysElapsed: 12,
      tasksDone: tasks,
      score: 0,
      isMe: false,
    });
    const rows = [e('a', 12, 36), e('b', 12, 34), e('c', 11, 30)];
    expect(rows.map((r) => needsTasks(rows, r))).toEqual([true, true, false]);
  });

  it('builds edit-day payloads and reorders tasks', () => {
    const drafts = [
      toDraftTask({
        id: 'x',
        title: ' Solve ',
        type: 'count',
        target: 3,
        unit: 'problems',
        verify: 'leetcode',
      }),
      toDraftTask({ id: 'y', title: 'Notes', type: 'check' }),
      {
        ...toDraftTask({ id: 'z', title: 'Watch', type: 'minutes', target: 30 }),
        link: 'https://x.test',
      },
    ];
    expect(toPayloadTasks(drafts)).toEqual([
      { title: 'Solve', type: 'count', target: 3, unit: 'problems', verify: 'leetcode' },
      { title: 'Notes', type: 'check' },
      { title: 'Watch', type: 'minutes', target: 30, link: 'https://x.test' },
    ]);
    expect(moveItem([1, 2, 3], 2, 0)).toEqual([3, 1, 2]);
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
  });

  it('sends only changed squad fields', () => {
    const s = squad('S1', { name: 'Old', partialCounts: true });
    expect(squadChanges(s, { name: 'New', partialCounts: true, chatUrl: null })).toEqual({
      name: 'New',
    });
  });
});
