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
      'You earned a badge: 7-day streak',
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
});
