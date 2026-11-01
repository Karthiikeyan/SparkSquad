import { calendarEvent } from '../../calendar/addToCalendar';
import { planReminders } from '../../reminders/plan';
import { routeForNotification } from '../../push/AppBackground';
import { buildWeeklyRecap, isRecapDay } from '../recap';
import type { SquadSource } from '../source';

type Partial = {
  userId: string;
  localDate: string;
  status?: string;
};

function source(rows: Partial[]): SquadSource {
  return {
    me: { id: 'U1', timezone: 'UTC' },
    squad: { id: 'S1', name: 'Placement Squad' },
    myRole: 'owner',
    members: [
      {
        userId: 'U1',
        name: 'Kiran Raj',
        role: 'owner',
        joinedAt: '',
        username: null,
        avatarColor: 0,
      },
      { userId: 'U2', name: 'Divya', role: 'member', joinedAt: '', username: null, avatarColor: 1 },
    ],
    challenge: { id: 'C1', startDate: '2026-10-01', durationDays: 60 },
    plan: null,
    edits: [],
    checkins: rows.map((r) => ({ status: 'done', challengeId: 'C1', ...r })),
    pendingIds: new Set(),
    nudgedToday: new Set(),
    announcement: null,
  } as unknown as SquadSource;
}

describe('weekly recap', () => {
  const today = '2026-11-01'; // a Sunday

  it('knows Sunday', () => {
    expect(isRecapDay(today)).toBe(true);
    expect(isRecapDay('2026-11-02')).toBe(false);
  });

  it('counts the last seven days and full-squad days, not honest misses or older days', () => {
    const recap = buildWeeklyRecap(
      source([
        { userId: 'U1', localDate: '2026-11-01' },
        { userId: 'U2', localDate: '2026-11-01' },
        { userId: 'U1', localDate: '2026-10-31' },
        { userId: 'U2', localDate: '2026-10-31', status: 'honest_miss' },
        { userId: 'U2', localDate: '2026-10-25' },
      ]),
      today,
    )!;
    expect(recap.from).toBe('2026-10-26');
    expect(recap.checkins).toBe(3);
    expect(recap.activeMembers).toBe(2);
    expect(recap.perfectDays).toBe(1);
    expect(recap.top).toEqual({ name: 'Kiran', days: 2 });
    expect(recap.bestStreak).toEqual({ name: 'Kiran', days: 2 });
  });

  it('starts at the challenge when it began this week', () => {
    const src = source([]);
    src.challenge = { ...src.challenge!, startDate: '2026-10-30' };
    expect(buildWeeklyRecap(src, today)!.from).toBe('2026-10-30');
  });

  it('has nothing to say without a challenge', () => {
    const src = source([]);
    src.challenge = null;
    expect(buildWeeklyRecap(src, today)).toBeNull();
  });

  it('plans one Sunday evening note that opens the card', () => {
    const planned = planReminders({
      now: new Date(2026, 9, 28, 10), // Wednesday
      reminderTime: '20:00',
      activeTitles: [],
      todayDone: false,
      notifyMissedDay: false,
      recapSquadId: 'S1',
    }).filter((p) => p.kind === 'recap');
    expect(planned).toHaveLength(1);
    expect(planned[0]!.at.getDay()).toBe(0);
    expect(planned[0]!.at.getHours()).toBe(18);
    expect(routeForNotification({ type: 'recap', squadId: 'S1' })).toBe('/squad/S1/recap');
  });

  it('moves to next Sunday once this Sunday evening has passed', () => {
    const [recap] = planReminders({
      now: new Date(2026, 10, 1, 19),
      reminderTime: '20:00',
      activeTitles: [],
      todayDone: false,
      notifyMissedDay: false,
      recapSquadId: 'S1',
    }).filter((p) => p.kind === 'recap');
    expect(recap!.at.getDate()).toBe(8);
  });
});

describe('calendar event', () => {
  const base = {
    title: 'DSA 30',
    squadName: 'Placement Squad',
    startDate: '2026-11-10',
    durationDays: 30,
    reminderTime: '07:30',
  };

  it('repeats daily at the reminder time from the first day of an upcoming challenge', () => {
    const e = calendarEvent({ ...base, today: '2026-11-01' });
    expect(e.startDate).toEqual(new Date(2026, 10, 10, 7, 30));
    expect(e.endDate.getTime() - e.startDate.getTime()).toBe(15 * 60_000);
    expect(e.occurrence).toBe(30);
  });

  it('only covers the days left of a running challenge', () => {
    const e = calendarEvent({ ...base, today: '2026-11-20' });
    expect(e.startDate).toEqual(new Date(2026, 10, 20, 7, 30));
    expect(e.occurrence).toBe(20);
  });
});
