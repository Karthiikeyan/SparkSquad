import { isReminderTime } from '@sparksquad/shared';
import { t } from '../../i18n';

export interface ReminderInput {
  now: Date;
  /** "HH:MM" in the phone's local time. */
  reminderTime: string;
  /** Titles of active challenges with tasks today (rest days excluded). */
  activeTitles: readonly string[];
  /** Every active challenge has today's check-in. */
  todayDone: boolean;
  notifyMissedDay: boolean;
  /** Current global streak (for "streak at risk"). */
  streak?: number;
  notifyStreakRisk?: boolean;
  /** Challenges that haven't started yet (startDate is a local YYYY-MM-DD). */
  upcoming?: readonly { title: string; startDate: string; squadId: string }[];
  notifyChallengeStart?: boolean;
  days?: number;
}

export interface PlannedReminder {
  id: string;
  kind: 'reminder' | 'missed' | 'streak' | 'start';
  at: Date;
  title: string;
  body: string;
  /** Extra data for routing the tap (e.g. the squad of a starting challenge). */
  data?: Record<string, string>;
}

/** Morning note time for "you can still check in for yesterday". */
export const MISSED_NOTE_HOUR = 8;
/** Streak-at-risk note: 10 PM, or 11 PM when the daily reminder is already late. */
export const STREAK_RISK_HOUR = 22;
/** Streaks shorter than this aren't worth a second nudge. */
export const STREAK_RISK_MIN = 3;
export const START_EVE_HOUR = 19;
export const START_MORNING_HOUR = 8;

function at(base: Date, dayOffset: number, hour: number, minute: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/**
 * Local notifications for the next few days (Architecture §5.3: reminders run on the phone).
 * Today's reminder is skipped once everything is checked in; the morning note is only planned
 * while today is still open, and is cancelled by re-planning after the check-in.
 */
export function planReminders(input: ReminderInput): PlannedReminder[] {
  const out: PlannedReminder[] = [...planStarts(input)];
  if (input.activeTitles.length === 0) return out.sort((a, b) => a.at.getTime() - b.at.getTime());
  const [h, m] = (isReminderTime(input.reminderTime) ? input.reminderTime : '20:00')
    .split(':')
    .map(Number) as [number, number];
  const days = input.days ?? 7;
  const body =
    input.activeTitles.length === 1
      ? t('reminders.bodyOne', { title: input.activeTitles[0]! })
      : t('reminders.bodyMany', { n: input.activeTitles.length });
  for (let i = 0; i < days; i++) {
    if (i === 0 && input.todayDone) continue;
    const when = at(input.now, i, h, m);
    if (when.getTime() <= input.now.getTime()) continue;
    out.push({
      id: `reminder-${i}`,
      kind: 'reminder',
      at: when,
      title: t('reminders.title'),
      body,
    });
  }
  if (input.notifyMissedDay && !input.todayDone) {
    out.push({
      id: 'missed-1',
      kind: 'missed',
      at: at(input.now, 1, MISSED_NOTE_HOUR, 0),
      title: t('reminders.missedTitle'),
      body: t('reminders.missedBody'),
    });
  }
  out.push(...planStreakRisk(input, h * 60 + m));
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Today (with the count) and tomorrow (generic), only while a real streak is on the line. */
function planStreakRisk(input: ReminderInput, reminderMinutes: number): PlannedReminder[] {
  const streak = input.streak ?? 0;
  if (!input.notifyStreakRisk || streak < STREAK_RISK_MIN - 1) return [];
  const hour = reminderMinutes >= (STREAK_RISK_HOUR - 1) * 60 + 30 ? 23 : STREAK_RISK_HOUR;
  const out: PlannedReminder[] = [];
  const today = at(input.now, 0, hour, 0);
  if (!input.todayDone && streak >= STREAK_RISK_MIN && today > input.now) {
    out.push({
      id: 'streak-0',
      kind: 'streak',
      at: today,
      title: t('reminders.streakTitle', { n: streak }),
      body: t('reminders.streakBody'),
    });
  }
  out.push({
    id: 'streak-1',
    kind: 'streak',
    at: at(input.now, 1, hour, 0),
    title: t('reminders.streakTitleSoon'),
    body: t('reminders.streakBody'),
  });
  return out;
}

function localDay(date: string, dayOffset: number, hour: number): Date {
  const [y, mo, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(y, mo - 1, d + dayOffset, hour, 0, 0, 0);
}

/** The evening before and the morning a challenge starts. */
function planStarts(input: ReminderInput): PlannedReminder[] {
  if (!input.notifyChallengeStart) return [];
  const out: PlannedReminder[] = [];
  (input.upcoming ?? []).slice(0, 4).forEach((c, i) => {
    const eve = localDay(c.startDate, -1, START_EVE_HOUR);
    const morning = localDay(c.startDate, 0, START_MORNING_HOUR);
    const data = { squadId: c.squadId };
    if (eve > input.now) {
      out.push({
        id: `start-eve-${i}`,
        kind: 'start',
        at: eve,
        title: t('reminders.startTomorrowTitle', { title: c.title }),
        body: t('reminders.startTomorrowBody'),
        data,
      });
    }
    if (morning > input.now) {
      out.push({
        id: `start-day-${i}`,
        kind: 'start',
        at: morning,
        title: t('reminders.startTodayTitle', { title: c.title }),
        body: t('reminders.startTodayBody'),
        data,
      });
    }
  });
  return out;
}
