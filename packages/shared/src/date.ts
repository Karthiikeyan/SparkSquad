/**
 * Local-date helpers. A LocalDate is a `YYYY-MM-DD` string in a member's IANA timezone.
 * All arithmetic is done on UTC midnights so DST never shifts a day.
 */
export type LocalDate = string;

const DAY_MS = 86_400_000;
const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLocalDate(value: string): value is LocalDate {
  const m = LOCAL_DATE_RE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === value;
}

export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24,
    minute: get('minute'),
  };
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

/** The local calendar date of `instant` in `timeZone`. */
export function localDateInZone(instant: Date, timeZone: string): LocalDate {
  const p = zonedParts(instant, timeZone);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
}

/** Local hour (0–23) of `instant` in `timeZone`. */
export function localHour(instant: Date, timeZone: string): number {
  return zonedParts(instant, timeZone).hour;
}

function toUtcMs(date: LocalDate): number {
  const m = LOCAL_DATE_RE.exec(date);
  if (!m) throw new Error(`Invalid local date: ${date}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function fromUtcMs(ms: number): LocalDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffDays(from: LocalDate, to: LocalDate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

export function compareLocalDates(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** ISO weekday, Monday = 1 … Sunday = 7. */
export function isoWeekday(date: LocalDate): number {
  const d = new Date(toUtcMs(date)).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Monday of the week containing `date`. */
export function startOfWeek(date: LocalDate): LocalDate {
  return addDays(date, 1 - isoWeekday(date));
}

/** Next Monday strictly after `date` (default challenge start). */
export function nextMonday(date: LocalDate): LocalDate {
  return addDays(date, 8 - isoWeekday(date));
}

/** Raw day number (can be < 1 before the start or > duration after the end). */
export function rawDayNumber(localDate: LocalDate, startDate: LocalDate): number {
  return diffDays(startDate, localDate) + 1;
}

/** Day number clamped to 1..durationDays (Architecture §7). */
export function dayNumber(
  localDate: LocalDate,
  startDate: LocalDate,
  durationDays: number,
): number {
  return Math.min(Math.max(rawDayNumber(localDate, startDate), 1), Math.max(durationDays, 1));
}

export function endDate(startDate: LocalDate, durationDays: number): LocalDate {
  return addDays(startDate, durationDays - 1);
}

export type ChallengePhase = 'upcoming' | 'running' | 'finished';

export function challengePhase(
  today: LocalDate,
  startDate: LocalDate,
  durationDays: number,
): ChallengePhase {
  const n = rawDayNumber(today, startDate);
  if (n < 1) return 'upcoming';
  if (n > durationDays) return 'finished';
  return 'running';
}

/** Travel tolerance when validating a client-supplied local date. */
export const CHECKIN_TOLERANCE_HOURS = 14;

/**
 * A check-in may be for "today" or "yesterday" in the member's timezone,
 * with ±14 h tolerance for travel (Architecture §7).
 */
export function isWithinCheckinWindow(localDate: LocalDate, now: Date, timeZone: string): boolean {
  if (!isLocalDate(localDate)) return false;
  const tol = CHECKIN_TOLERANCE_HOURS * 3_600_000;
  const latest = localDateInZone(new Date(now.getTime() + tol), timeZone);
  const earliest = addDays(localDateInZone(new Date(now.getTime() - tol), timeZone), -1);
  return localDate >= earliest && localDate <= latest;
}

/** Inclusive list of local dates from `from` to `to`. */
export function dateRange(from: LocalDate, to: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  const n = diffDays(from, to);
  for (let i = 0; i <= n; i++) out.push(addDays(from, i));
  return out;
}

/** "HH:MM" 24h reminder time. */
export function isReminderTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
