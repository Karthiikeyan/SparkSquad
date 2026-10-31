import * as SecureStore from 'expo-secure-store';

export const AI_PROVIDERS = ['gemini', 'openai', 'anthropic'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

const keyName = (p: AiProvider) => `sparksquad_ai_key_${p}`;

/**
 * BYOK keys live only in the phone's secure keystore (expo-secure-store). They are never sent to
 * our API, logged, or put in analytics or crash reports.
 */
export async function getAiKey(provider: AiProvider): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(keyName(provider));
  } catch {
    return null;
  }
}

export async function setAiKey(provider: AiProvider, key: string): Promise<void> {
  await SecureStore.setItemAsync(keyName(provider), key.trim(), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function removeAiKey(provider: AiProvider): Promise<void> {
  await SecureStore.deleteItemAsync(keyName(provider));
}

export async function clearAiKeys(): Promise<void> {
  for (const p of AI_PROVIDERS) await removeAiKey(p).catch(() => undefined);
}
