const weekdayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'long' });
const dayMonthFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' });
const timeFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

/** "Saturday, 31 October" (Today header). */
export function formatLongDate(date: Date): string {
  return `${weekdayFmt.format(date)}, ${dayMonthFmt.format(date)}`;
}

/** "7:42 AM" */
export function formatTime(date: Date): string {
  return timeFmt.format(date);
}

/** Masks a secret for display: first 4 + •••• + last 3 ("AIza••••3kQ"). Never log the input. */
export function maskSecret(secret: string): string {
  if (secret.length <= 8) return '••••';
  return `${secret.slice(0, 4)}••••${secret.slice(-3)}`;
}
