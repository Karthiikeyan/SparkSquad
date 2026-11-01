import { addDays, compareLocalDates, diffDays, isReminderTime } from '@sparksquad/shared';
import type * as CalendarModule from 'expo-calendar/legacy';
import { t } from '../../i18n';

export interface CalendarInput {
  title: string;
  squadName: string;
  /** YYYY-MM-DD */
  startDate: string;
  durationDays: number;
  today: string;
  /** "HH:MM" on this phone. */
  reminderTime: string;
}

const EVENT_MINUTES = 15;

/**
 * One repeating event at the reminder time from the first day still ahead to the last day of the
 * challenge, so the start date and the daily habit are both on the calendar.
 */
export function calendarEvent(input: CalendarInput) {
  const first = compareLocalDates(input.startDate, input.today) > 0 ? input.startDate : input.today;
  const elapsed = diffDays(input.startDate, first);
  const [h, m] = (isReminderTime(input.reminderTime) ? input.reminderTime : '20:00')
    .split(':')
    .map(Number) as [number, number];
  const [y, mo, d] = first.split('-').map(Number) as [number, number, number];
  const startDate = new Date(y, mo - 1, d, h, m, 0, 0);
  return {
    title: t('calendar.eventTitle', { title: input.title }),
    notes: t('calendar.eventNotes', {
      squad: input.squadName,
      end: addDays(input.startDate, input.durationDays - 1),
    }),
    startDate,
    endDate: new Date(startDate.getTime() + EVENT_MINUTES * 60_000),
    occurrence: Math.max(1, input.durationDays - elapsed),
  };
}

/**
 * Opens the phone's own "new event" screen, prefilled. The user confirms there, so the app needs
 * no calendar permission and never reads their calendar.
 */
export async function addToCalendar(input: CalendarInput): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy native module
  const Calendar = require('expo-calendar/legacy') as typeof CalendarModule;
  const { occurrence, ...event } = calendarEvent(input);
  await Calendar.createEventInCalendarAsync({
    ...event,
    recurrenceRule: { frequency: Calendar.Frequency.DAILY, occurrence },
  });
}
