import { describe, expect, it } from 'vitest';
import { ERROR_CODES, PAYWALL_CODES, isErrorCode } from '../src/errors';
import { inviteCode, isInviteCode, isUlid, normalizeInviteCode, ulid } from '../src/ids';
import {
  TIER_LIMITS,
  commentRetentionDays,
  effectivePlan,
  limitsFor,
  photoRetentionDays,
} from '../src/limits';
import { createWordFilter, normalizeForFilter, wordFilter } from '../src/wordFilter';

describe('limits', () => {
  it('matches the product spec tiers', () => {
    expect(TIER_LIMITS.free).toMatchObject({ squadsJoined: 3, squadsOwned: 1, freezesBanked: 2 });
    expect(TIER_LIMITS.plus).toMatchObject({ squadsJoined: 10, squadsOwned: 5, freezesBanked: 5 });
    expect(limitsFor('free').photoUpload).toBe(false);
  });

  it('downgrades expired plus', () => {
    const now = new Date('2026-10-31T00:00:00Z');
    expect(effectivePlan('plus', '2026-10-30T00:00:00Z', now)).toBe('free');
    expect(effectivePlan('plus', '2026-11-30T00:00:00Z', now)).toBe('plus');
    expect(effectivePlan('plus', null, now)).toBe('plus');
    expect(effectivePlan('free', null, now)).toBe('free');
  });

  it('computes retention', () => {
    expect(commentRetentionDays('free', false)).toBe(30);
    expect(commentRetentionDays('plus', false)).toBe(90);
    expect(commentRetentionDays('free', true)).toBe(90);
    expect(photoRetentionDays('free', false)).toBe(0);
    expect(photoRetentionDays('plus', false)).toBe(30);
    expect(photoRetentionDays('free', true)).toBe(90);
  });
});

describe('ids', () => {
  it('makes sortable ULIDs', () => {
    const a = ulid(1_000);
    const b = ulid(2_000);
    expect(isUlid(a)).toBe(true);
    expect(a < b).toBe(true);
    expect(ulid()).toHaveLength(26);
    expect(isUlid('not-a-ulid')).toBe(false);
  });

  it('makes invite codes without look-alikes', () => {
    for (let i = 0; i < 50; i++) {
      const c = inviteCode();
      expect(isInviteCode(c)).toBe(true);
      expect(c).not.toMatch(/[01OIL]/);
    }
    expect(normalizeInviteCode(' ab-c 12x ')).toBe('ABC12X');
    expect(isInviteCode('ABC10X')).toBe(false);
  });
});

describe('errors', () => {
  it('recognises codes', () => {
    expect(isErrorCode('RATE_LIMITED')).toBe(true);
    expect(isErrorCode('NOPE')).toBe(false);
    expect(isErrorCode(3)).toBe(false);
    for (const c of PAYWALL_CODES) expect(ERROR_CODES).toContain(c);
  });
});

describe('word filter', () => {
  it('blocks listed words in many spellings', () => {
    expect(wordFilter.isAllowed('Great work today!')).toBe(true);
    expect(wordFilter.find('what the FUCK')).toBe('fuck');
    expect(wordFilter.find('sh1t happens')).toBe('shit');
    expect(wordFilter.find('f u c k this')).toBe('fuck');
    expect(wordFilter.find('fuuuuck')).toBe(null);
    expect(wordFilter.find('fuuuck')).toBe(null);
    expect(wordFilter.find('chutiya')).toBe('chutiya');
  });

  it('avoids the Scunthorpe problem', () => {
    expect(wordFilter.isAllowed('My therapist said rest')).toBe(true);
    expect(wordFilter.isAllowed('Scunthorpe grapes assessment')).toBe(true);
    expect(wordFilter.isAllowed('I solved 5 problems in 30 minutes')).toBe(true);
  });

  it('supports extra words', () => {
    const f = createWordFilter(['Spoiler', ' ']);
    expect(f.find('no spoiler please')).toBe('spoiler');
  });

  it('normalises accents and leetspeak', () => {
    expect(normalizeForFilter('Ćafé 4ll')).toBe('cafe all');
  });
});
