import { isReminderTime } from '@sparksquad/shared';

export const DEFAULT_REMINDER = '20:00';

/** "20:00" → a Date today at that local time (for pickers). */
export function reminderToDate(value: string, base: Date = new Date()): Date {
  const time = isReminderTime(value) ? value : DEFAULT_REMINDER;
  const [h, m] = time.split(':').map(Number);
  const d = new Date(base);
  d.setHours(h ?? 20, m ?? 0, 0, 0);
  return d;
}

/** A picked Date → "HH:MM" (local). */
export function dateToReminder(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** "20:00" → "8:00 PM". */
export function formatReminder(value: string): string {
  const time = isReminderTime(value) ? value : DEFAULT_REMINDER;
  const [h = 20, m = 0] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}
