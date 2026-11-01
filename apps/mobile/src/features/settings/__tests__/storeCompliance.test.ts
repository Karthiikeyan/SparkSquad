import { LEGAL_DOCS, legalParagraphs, reportReasonSchema } from '@sparksquad/shared';
import appConfig from '../../../../app.config';
import { grantAiConsent, hasAiConsent } from '../../ai/consent';
import { clearPrefs } from '../../../lib/prefs';
import en from '../../../i18n/en.json';

const config = appConfig({ config: {} } as never);

describe('store policy guards', () => {
  it('never ships Android permissions the app does not use', () => {
    const blocked = config.android?.blockedPermissions ?? [];
    for (const p of [
      // Play's photo policy: the app uses the system picker, so broad access isn't allowed.
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
      'android.permission.READ_MEDIA_VIDEO',
      // Calendar goes through the phone's "new event" screen, with no permission.
      'android.permission.READ_CALENDAR',
      'android.permission.WRITE_CALENDAR',
      // No ads.
      'com.google.android.gms.permission.AD_ID',
    ]) {
      expect(blocked).toContain(p);
    }
  });

  it('declares iOS encryption and privacy reasons so uploads are not held up', () => {
    expect(config.ios?.infoPlist?.ITSAppUsesNonExemptEncryption).toBe(false);
    expect(config.ios?.privacyManifests?.NSPrivacyTracking).toBe(false);
    expect(config.ios?.privacyManifests?.NSPrivacyAccessedAPITypes?.length).toBeGreaterThan(0);
  });

  it('does not claim steps stay on the phone, because check-ins can carry them', () => {
    const copy = JSON.stringify([en.integrations, config.plugins, LEGAL_DOCS.privacy.body]);
    expect(copy).not.toMatch(/steps stay on/i);
    expect(LEGAL_DOCS.privacy.body).toContain('leaves your phone only when you submit a check-in');
  });

  it('names every AI provider in the privacy policy', () => {
    for (const name of ['Gemini', 'Groq', 'OpenRouter', 'OpenAI', 'Anthropic']) {
      expect(LEGAL_DOCS.privacy.body).toContain(name);
    }
  });

  it('fills in every placeholder in legal text', () => {
    const vars = { email: 'a@b.c', deleteUrl: 'https://x/d', childSafetyUrl: 'https://x/c' };
    for (const doc of Object.keys(LEGAL_DOCS) as (keyof typeof LEGAL_DOCS)[]) {
      expect(legalParagraphs(doc, vars).join(' ')).not.toContain('{{');
    }
  });

  it('labels every report reason, including child safety', () => {
    expect(reportReasonSchema.options).toContain('child_safety');
    for (const r of reportReasonSchema.options) {
      expect(en.report[r]).toBeTruthy();
    }
  });

  it('remembers AI consent per provider', () => {
    clearPrefs();
    expect(hasAiConsent('groq')).toBe(false);
    grantAiConsent('groq');
    expect(hasAiConsent('groq')).toBe(true);
    expect(hasAiConsent('openai')).toBe(false);
  });
});
