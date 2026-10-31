import { describe, expect, it } from 'vitest';
import {
  addDays,
  challengePhase,
  compareLocalDates,
  dateRange,
  dayNumber,
  diffDays,
  endDate,
  isLocalDate,
  isReminderTime,
  isValidTimeZone,
  isWithinCheckinWindow,
  isoWeekday,
  localDateInZone,
  localHour,
  nextMonday,
  rawDayNumber,
  startOfWeek,
} from '../src/date';

describe('local dates', () => {
  it('validates dates', () => {
    expect(isLocalDate('2026-10-31')).toBe(true);
    expect(isLocalDate('2026-02-30')).toBe(false);
    expect(isLocalDate('2026-1-01')).toBe(false);
    expect(isLocalDate('hello')).toBe(false);
  });

  it('validates timezones', () => {
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidTimeZone('Mars/Base')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });

  it('computes local date in IST (no DST)', () => {
    // 2026-10-31 20:00 UTC = 2026-11-01 01:30 IST
    const t = new Date('2026-10-31T20:00:00Z');
    expect(localDateInZone(t, 'Asia/Kolkata')).toBe('2026-11-01');
    expect(localDateInZone(t, 'UTC')).toBe('2026-10-31');
    expect(localHour(t, 'Asia/Kolkata')).toBe(1);
    expect(localHour(new Date('2026-10-31T18:30:00Z'), 'Asia/Kolkata')).toBe(0);
  });

  it('handles a DST zone (America/New_York, fall back on 2026-11-01)', () => {
    expect(localDateInZone(new Date('2026-11-01T05:30:00Z'), 'America/New_York')).toBe(
      '2026-11-01',
    );
    expect(localDateInZone(new Date('2026-11-01T03:59:00Z'), 'America/New_York')).toBe(
      '2026-10-31',
    );
    expect(localDateInZone(new Date('2026-11-02T04:59:00Z'), 'America/New_York')).toBe(
      '2026-11-01',
    );
    expect(localDateInZone(new Date('2026-11-02T05:00:00Z'), 'America/New_York')).toBe(
      '2026-11-02',
    );
    // Day arithmetic is unaffected by DST.
    expect(addDays('2026-10-31', 2)).toBe('2026-11-02');
    expect(diffDays('2026-03-07', '2026-03-09')).toBe(2);
  });

  it('does arithmetic across months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(diffDays('2026-10-01', '2026-10-31')).toBe(30);
    expect(diffDays('2026-10-31', '2026-10-01')).toBe(-30);
    expect(compareLocalDates('2026-01-01', '2026-01-02')).toBe(-1);
    expect(compareLocalDates('2026-01-02', '2026-01-01')).toBe(1);
    expect(compareLocalDates('2026-01-01', '2026-01-01')).toBe(0);
    expect(() => addDays('bad', 1)).toThrow();
  });

  it('computes weeks', () => {
    expect(isoWeekday('2026-10-31')).toBe(6); // Saturday
    expect(isoWeekday('2026-11-01')).toBe(7); // Sunday
    expect(startOfWeek('2026-10-31')).toBe('2026-10-26');
    expect(startOfWeek('2026-10-26')).toBe('2026-10-26');
    expect(nextMonday('2026-10-31')).toBe('2026-11-02');
    expect(nextMonday('2026-11-02')).toBe('2026-11-09');
  });

  it('computes day numbers', () => {
    expect(rawDayNumber('2026-11-02', '2026-11-02')).toBe(1);
    expect(rawDayNumber('2026-11-01', '2026-11-02')).toBe(0);
    expect(dayNumber('2026-11-13', '2026-11-02', 60)).toBe(12);
    expect(dayNumber('2026-10-01', '2026-11-02', 60)).toBe(1);
    expect(dayNumber('2027-10-01', '2026-11-02', 60)).toBe(60);
    expect(endDate('2026-11-02', 30)).toBe('2026-12-01');
    expect(challengePhase('2026-11-01', '2026-11-02', 30)).toBe('upcoming');
    expect(challengePhase('2026-11-02', '2026-11-02', 30)).toBe('running');
    expect(challengePhase('2026-12-01', '2026-11-02', 30)).toBe('running');
    expect(challengePhase('2026-12-02', '2026-11-02', 30)).toBe('finished');
  });

  it('builds ranges', () => {
    expect(dateRange('2026-10-30', '2026-11-01')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
    expect(dateRange('2026-11-01', '2026-10-30')).toEqual([]);
  });

  it('validates reminder times', () => {
    expect(isReminderTime('20:00')).toBe(true);
    expect(isReminderTime('24:00')).toBe(false);
    expect(isReminderTime('8:00')).toBe(false);
  });
});

describe('check-in window', () => {
  const tz = 'Asia/Kolkata';
  const now = new Date('2026-10-31T12:00:00Z'); // 17:30 IST on Oct 31

  it('accepts today and yesterday', () => {
    expect(isWithinCheckinWindow('2026-10-31', now, tz)).toBe(true);
    expect(isWithinCheckinWindow('2026-10-30', now, tz)).toBe(true);
  });

  it('accepts tomorrow only within the 14 h travel tolerance', () => {
    expect(isWithinCheckinWindow('2026-11-01', now, tz)).toBe(true);
    const morning = new Date('2026-10-31T00:30:00Z'); // 06:00 IST
    expect(isWithinCheckinWindow('2026-11-01', morning, tz)).toBe(false);
  });

  it('rejects two days ago and far future', () => {
    const lateNight = new Date('2026-10-31T18:00:00Z'); // 23:30 IST
    expect(isWithinCheckinWindow('2026-10-29', lateNight, tz)).toBe(false);
    expect(isWithinCheckinWindow('2026-11-03', now, tz)).toBe(false);
    expect(isWithinCheckinWindow('nope', now, tz)).toBe(false);
  });
});
