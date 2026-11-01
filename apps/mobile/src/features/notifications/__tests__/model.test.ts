import type { NotificationDTO, PlanTask } from '@sparksquad/shared';
import { planReminders } from '../../reminders/plan';
import { taskMeta, targetLabel } from '../../today/taskText';
import { freezeNotice, groupByDay, notificationRoute, notificationText } from '../model';

const n = (over: Partial<NotificationDTO>): NotificationDTO => ({
  id: 'N1',
  kind: 'nudge',
  payload: {},
  readAt: null,
  createdAt: '2026-10-31T03:00:00.000Z',
  ...over,
});

describe('inbox copy', () => {
  it('writes one line per kind with safe fallbacks', () => {
    expect(notificationText(n({ payload: { fromName: 'Divya', title: 'DSA 60' } }))).toBe(
      'Divya nudged you: DSA 60 is waiting',
    );
    expect(notificationText(n({ kind: 'join_request', payload: { squadName: 'Squad 7' } }))).toBe(
      'A squadmate asked to join Squad 7',
    );
    expect(notificationText(n({ kind: 'badge', payload: { badge: 'streak_7' } }))).toBe(
      'You earned a badge: Kindling',
    );
    expect(
      notificationText(
        n({ kind: 'challenge_ended', payload: { title: 'DSA 60', daysDone: 50, daysElapsed: 60 } }),
      ),
    ).toBe('DSA 60 has ended. You showed up 50 of 60 days.');
    expect(
      notificationText(n({ kind: 'role_changed', payload: { role: 'admin', squadName: 'S' } })),
    ).toBe('You’re now an admin of S');
    expect(
      notificationText(n({ kind: 'freeze_used', payload: { streak: 12, title: 'DSA 60' } })),
    ).toBe('A streak freeze kept your 12-day streak in DSA 60');
    expect(notificationRoute(n({ kind: 'badge' }))).toBe('/you');
    expect(notificationRoute(n({}))).toBe('/today');
    expect(notificationRoute(n({ kind: 'join_request', payload: { squadId: 'S1' } }))).toBe(
      '/squad/S1/requests',
    );
    expect(
      notificationRoute(
        n({ kind: 'challenge_ended', payload: { squadId: 'S1', challengeId: 'C1' } }),
      ),
    ).toBe('/squad/S1/history/C1');
    expect(notificationRoute(n({ kind: 'announcement', payload: { squadId: 'S1' } }))).toBe(
      '/squad/S1',
    );
  });

  it('describes comments, grouped fires, new members and milestone days', () => {
    expect(
      notificationText(n({ kind: 'comment', payload: { name: 'Asha', body: 'Great work' } })),
    ).toBe('Asha commented on your check-in: Great work');
    expect(notificationText(n({ kind: 'fires', payload: { name: 'Ravi', count: 1 } }))).toBe(
      'Ravi sent fire on your check-in',
    );
    expect(notificationText(n({ kind: 'fires', payload: { name: 'Ravi', count: 3 } }))).toBe(
      'Ravi and 2 more sent fire on your check-in',
    );
    expect(
      notificationText(n({ kind: 'member_joined', payload: { name: 'Mia', squadName: 'S' } })),
    ).toBe('Mia joined S');
    expect(
      notificationText(
        n({ kind: 'milestone', payload: { squadName: 'S', day: 30, total: 60, title: 'DSA 60' } }),
      ),
    ).toBe('S reached day 30 of 60 in DSA 60. Keep going.');
    expect(
      notificationRoute(n({ kind: 'comment', payload: { checkinId: 'K1', squadId: 'S1' } })),
    ).toBe('/checkins/K1');
    expect(notificationRoute(n({ kind: 'member_joined', payload: { squadId: 'S1' } }))).toBe(
      '/squad/S1/members',
    );
  });

  it('groups by the user’s local day', () => {
    const today = n({ id: 'a', createdAt: '2026-10-30T20:00:00.000Z' }); // 01:30 IST on the 31st
    const earlier = n({ id: 'b', createdAt: '2026-10-30T10:00:00.000Z' });
    const g = groupByDay([today, earlier], '2026-10-31', 'Asia/Kolkata');
    expect(g.today.map((x) => x.id)).toEqual(['a']);
    expect(g.earlier.map((x) => x.id)).toEqual(['b']);
  });

  it('shows the freeze notice once, on the morning it was created', () => {
    const freeze = n({ id: 'F', kind: 'freeze_used', createdAt: '2026-10-30T19:45:00.000Z' });
    expect(freezeNotice([freeze], '2026-10-31', 'Asia/Kolkata', undefined)?.id).toBe('F');
    expect(freezeNotice([freeze], '2026-10-31', 'Asia/Kolkata', '2026-10-31')).toBeNull();
    expect(
      freezeNotice([{ ...freeze, readAt: 'x' }], '2026-10-31', 'Asia/Kolkata', undefined),
    ).toBeNull();
    expect(freezeNotice([freeze], '2026-11-01', 'Asia/Kolkata', undefined)).toBeNull();
  });
});

describe('task text', () => {
  const count: PlanTask = {
    id: 'a',
    title: 'P',
    type: 'count',
    target: 2,
    unit: 'problems',
    verify: 'leetcode',
  };
  it('describes progress and verification', () => {
    expect(taskMeta(count, 1)).toBe('1 of 2 problems, auto-checks from LeetCode');
    expect(taskMeta({ id: 'b', title: 'L', type: 'minutes', target: 30 }, undefined)).toBe(
      '30 minutes',
    );
    expect(taskMeta({ id: 'c', title: 'N', type: 'check' }, false)).toBe('Tap to mark done');
    expect(targetLabel({ id: 'b', title: 'L', type: 'minutes', target: 30 })).toBe(
      'Target 30 minutes',
    );
    expect(targetLabel({ id: 's', title: 'S', type: 'count', target: 10000, unit: 'steps' })).toBe(
      'Target 10,000 steps',
    );
  });
});

describe('planReminders', () => {
  const now = new Date(2026, 9, 31, 9, 0); // local 09:00
  const base = {
    now,
    reminderTime: '20:00',
    activeTitles: ['DSA 60'],
    todayDone: false,
    notifyMissedDay: true,
  };

  it('plans a week of reminders plus tomorrow’s morning note while today is open', () => {
    const plan = planReminders(base);
    const reminders = plan.filter((p) => p.kind === 'reminder');
    expect(reminders).toHaveLength(7);
    expect(reminders[0]!.at).toEqual(new Date(2026, 9, 31, 20, 0));
    expect(reminders[0]!.body).toBe('Your squad is showing up today. Take a minute for DSA 60.');
    expect(plan.find((p) => p.kind === 'missed')?.at).toEqual(new Date(2026, 10, 1, 8, 0));
  });

  it('skips today once everything is checked in and drops the morning note', () => {
    const plan = planReminders({ ...base, todayDone: true });
    expect(plan.every((p) => p.kind === 'reminder')).toBe(true);
    expect(plan[0]!.at).toEqual(new Date(2026, 10, 1, 20, 0));
  });

  it('skips a reminder time that already passed and respects the missed-day switch', () => {
    const late = planReminders({
      ...base,
      now: new Date(2026, 9, 31, 21, 0),
      notifyMissedDay: false,
    });
    expect(late).toHaveLength(6);
    expect(late.some((p) => p.kind === 'missed')).toBe(false);
  });

  it('plans nothing without active challenges and summarises several', () => {
    expect(planReminders({ ...base, activeTitles: [] })).toEqual([]);
    expect(planReminders({ ...base, activeTitles: ['A', 'B'] })[0]!.body).toBe(
      '2 challenges are waiting for you today.',
    );
  });

  it('warns at 10 PM when a streak of 3+ is on the line, and stays quiet when switched off', () => {
    const plan = planReminders({ ...base, streak: 5, notifyStreakRisk: true });
    const risk = plan.filter((p) => p.kind === 'streak');
    expect(risk.map((p) => p.at)).toEqual([
      new Date(2026, 9, 31, 22, 0),
      new Date(2026, 10, 1, 22, 0),
    ]);
    expect(risk[0]!.title).toBe('Your 5-day streak ends at midnight');
    const done = planReminders({ ...base, todayDone: true, streak: 5, notifyStreakRisk: true });
    expect(done.filter((p) => p.kind === 'streak').map((p) => p.id)).toEqual(['streak-1']);
    expect(
      planReminders({ ...base, streak: 1, notifyStreakRisk: true }).some(
        (p) => p.kind === 'streak',
      ),
    ).toBe(false);
    expect(
      planReminders({ ...base, streak: 5, notifyStreakRisk: false }).some(
        (p) => p.kind === 'streak',
      ),
    ).toBe(false);
    const lateReminder = planReminders({
      ...base,
      reminderTime: '21:45',
      streak: 5,
      notifyStreakRisk: true,
    });
    expect(lateReminder.find((p) => p.id === 'streak-0')?.at).toEqual(new Date(2026, 9, 31, 23, 0));
  });

  it('plans the evening before and the morning a challenge starts', () => {
    const plan = planReminders({
      ...base,
      activeTitles: [],
      upcoming: [{ title: 'SQL 30', startDate: '2026-11-02', squadId: 'S1' }],
      notifyChallengeStart: true,
    });
    expect(plan.map((p) => [p.id, p.at])).toEqual([
      ['start-eve-0', new Date(2026, 10, 1, 19, 0)],
      ['start-day-0', new Date(2026, 10, 2, 8, 0)],
    ]);
    expect(plan[0]!.title).toBe('SQL 30 starts tomorrow');
    expect(plan[0]!.data).toEqual({ squadId: 'S1' });
    expect(
      planReminders({
        ...base,
        upcoming: [{ title: 'SQL 30', startDate: '2026-11-02', squadId: 'S1' }],
        notifyChallengeStart: false,
      }).some((p) => p.kind === 'start'),
    ).toBe(false);
  });
});
