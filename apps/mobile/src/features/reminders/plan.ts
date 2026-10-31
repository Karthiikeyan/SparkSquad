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
  days?: number;
}

export interface PlannedReminder {
  id: string;
  kind: 'reminder' | 'missed';
  at: Date;
  title: string;
  body: string;
}

/** Morning note time for "you can still check in for yesterday". */
export const MISSED_NOTE_HOUR = 8;

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
  if (input.activeTitles.length === 0) return [];
  const [h, m] = (isReminderTime(input.reminderTime) ? input.reminderTime : '20:00')
    .split(':')
    .map(Number) as [number, number];
  const days = input.days ?? 7;
  const body =
    input.activeTitles.length === 1
      ? t('reminders.bodyOne', { title: input.activeTitles[0]! })
      : t('reminders.bodyMany', { n: input.activeTitles.length });
  const out: PlannedReminder[] = [];
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
  return out;
}
