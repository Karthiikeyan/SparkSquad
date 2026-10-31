import { describe, expect, it } from 'vitest';
import {
  chatUrlSchema,
  consentSchema,
  createChallengeSchema,
  createSquadSchema,
  joinSquadSchema,
  proofUploadSchema,
  reportSchema,
  updateMeSchema,
  upsertCheckinSchema,
  usernameSchema,
  integrationSchema,
} from '../src/schemas';

describe('schemas', () => {
  it('validates usernames', () => {
    expect(usernameSchema.parse(' Divya_7 ')).toBe('divya_7');
    expect(usernameSchema.safeParse('ab').success).toBe(false);
    expect(usernameSchema.safeParse('has space').success).toBe(false);
  });

  it('validates profile updates', () => {
    expect(
      updateMeSchema.safeParse({ timezone: 'Asia/Kolkata', reminderTime: '20:00' }).success,
    ).toBe(true);
    expect(updateMeSchema.safeParse({ timezone: 'Nowhere/Land' }).success).toBe(false);
    expect(updateMeSchema.safeParse({ avatarColor: 12 }).success).toBe(false);
  });

  it('requires both consents', () => {
    expect(consentSchema.safeParse({ ageConfirmed: true, termsAccepted: true }).success).toBe(true);
    expect(consentSchema.safeParse({ ageConfirmed: false, termsAccepted: true }).success).toBe(
      false,
    );
  });

  it('only allows WhatsApp/Telegram chat links', () => {
    expect(chatUrlSchema.safeParse('https://chat.whatsapp.com/AbC123').success).toBe(true);
    expect(chatUrlSchema.safeParse('https://t.me/placement_squad').success).toBe(true);
    expect(chatUrlSchema.safeParse('https://evil.example/whatsapp').success).toBe(false);
    expect(chatUrlSchema.safeParse('http://t.me/x').success).toBe(false);
  });

  it('validates squads', () => {
    const ok = createSquadSchema.safeParse({
      name: 'Placement Squad 7',
      category: 'career',
      privacy: 'private',
    });
    expect(ok.success).toBe(true);
    expect(
      createSquadSchema.safeParse({ name: 'x', category: 'career', privacy: 'private' }).success,
    ).toBe(false);
    expect(
      createSquadSchema.safeParse({
        name: 'Squad',
        category: 'career',
        privacy: 'public',
        memberLimit: 101,
      }).success,
    ).toBe(false);
  });

  it('accepts join by code or id', () => {
    expect(joinSquadSchema.safeParse({ code: 'ABC234' }).success).toBe(true);
    expect(joinSquadSchema.safeParse({ squadId: '01H' }).success).toBe(true);
    expect(joinSquadSchema.safeParse({}).success).toBe(false);
  });

  it('validates check-ins', () => {
    const base = {
      challengeId: 'c1',
      localDate: '2026-10-31',
      timezone: 'Asia/Kolkata',
      values: [
        { t: 0, v: 2 },
        { t: 1, v: true },
      ],
    };
    expect(upsertCheckinSchema.safeParse(base).success).toBe(true);
    expect(upsertCheckinSchema.safeParse({ ...base, note: 'x'.repeat(281) }).success).toBe(false);
    expect(upsertCheckinSchema.safeParse({ ...base, localDate: '31/10/2026' }).success).toBe(false);
    expect(upsertCheckinSchema.safeParse({ ...base, values: [{ t: 9, v: 1 }] }).success).toBe(
      false,
    );
  });

  it('validates challenge creation and uploads', () => {
    expect(
      createChallengeSchema.safeParse({ plan: { a: 1 }, startDate: '2026-11-02' }).success,
    ).toBe(true);
    expect(createChallengeSchema.safeParse({ plan: 'text', startDate: 'soon' }).success).toBe(
      false,
    );
    expect(
      proofUploadSchema.safeParse({ checkinId: 'x', contentType: 'image/png', size: 10 }).success,
    ).toBe(false);
    expect(
      proofUploadSchema.safeParse({ checkinId: 'x', contentType: 'image/webp', size: 400 * 1024 })
        .success,
    ).toBe(false);
  });

  it('validates reports and handles', () => {
    expect(
      reportSchema.safeParse({ targetType: 'comment', targetId: 'x', reason: 'spam' }).success,
    ).toBe(true);
    expect(
      reportSchema.safeParse({ targetType: 'planet', targetId: 'x', reason: 'spam' }).success,
    ).toBe(false);
    expect(integrationSchema.safeParse({ handle: 'tourist' }).success).toBe(true);
    expect(integrationSchema.safeParse({ handle: 'https://github.com/x' }).success).toBe(false);
  });
});
