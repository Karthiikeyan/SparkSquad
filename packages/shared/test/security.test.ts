import { describe, expect, it } from 'vitest';
import { canonicalTimeZone } from '../src/date';
import { extractJson } from '../src/plan';
import { checkinIdSchema, proofUploadSchema, timeZoneSchema } from '../src/schemas';

describe('fenced block extraction (security)', () => {
  it('still reads fenced, multi-fence and four-backtick replies', () => {
    expect(extractJson('```json\n{"sparksquad_plan":1}\n```')).toEqual({ sparksquad_plan: 1 });
    expect(extractJson('```\n{"a":1}\n``` then ```js\n{"sparksquad_plan":1}\n```')).toEqual({
      sparksquad_plan: 1,
    });
    expect(extractJson('````json\n{"a":2}\n````')).toEqual({ a: 2 });
  });

  it('stays linear on a long unclosed fence line', () => {
    const hostile = '```' + 'a'.repeat(400_000);
    const started = performance.now();
    expect(extractJson(hostile)).toBeNull();
    expect(performance.now() - started).toBeLessThan(500);
  });
});

describe('ids and timezones used in storage keys', () => {
  it('check-in ids cannot carry path syntax', () => {
    for (const bad of ['../x/abcdefghij', 'abcdefghij#', 'a/b/cdefghij', 'short']) {
      expect(checkinIdSchema.safeParse(bad).success, bad).toBe(false);
      expect(
        proofUploadSchema.safeParse({ checkinId: bad, contentType: 'image/jpeg', size: 1 }).success,
      ).toBe(false);
    }
    expect(checkinIdSchema.safeParse('01JABCDEFGHJKMNPQRSTVWXYZ0').success).toBe(true);
  });

  it('folds timezone case without swapping aliases', () => {
    expect(canonicalTimeZone('europe/london')).toBe('Europe/London');
    expect(canonicalTimeZone('Asia/Kolkata')).toBe('Asia/Kolkata');
    expect(timeZoneSchema.parse('AMERICA/NEW_YORK')).toBe('America/New_York');
    expect(timeZoneSchema.safeParse('Mars/Olympus').success).toBe(false);
  });
});
