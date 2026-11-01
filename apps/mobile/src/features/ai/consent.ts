import { Alert } from '../../components/ui/Dialog';
import { t } from '../../i18n';
import type { AiProvider } from '../../lib/aiKeys';
import { getPref, setPref } from '../../lib/prefs';
import { AI_COMPANY } from './providers';

export function hasAiConsent(provider: AiProvider): boolean {
  return (getPref('aiConsent') ?? []).includes(provider);
}

export function grantAiConsent(provider: AiProvider): void {
  if (!hasAiConsent(provider)) setPref('aiConsent', [...(getPref('aiConsent') ?? []), provider]);
}

/**
 * App Store guideline 5.1.2(i): ask before personal data first goes to a third-party AI, once per
 * provider. Resolves true only when the person agrees.
 */
export function ensureAiConsent(provider: AiProvider): Promise<boolean> {
  if (hasAiConsent(provider)) return Promise.resolve(true);
  const company = AI_COMPANY[provider];
  return new Promise((resolve) => {
    Alert.alert(t('aiConsent.title', { company }), t('aiConsent.body', { company }), [
      { text: t('common.notNow'), style: 'cancel', onPress: () => resolve(false) },
      {
        text: t('aiConsent.allow'),
        onPress: () => {
          grantAiConsent(provider);
          resolve(true);
        },
      },
    ]);
  });
}
