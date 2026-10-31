import { createMMKV, type MMKV } from 'react-native-mmkv';

/**
 * Small, non-secret preferences (MMKV). Secrets (auth cookies, BYOK keys) never go here:
 * they live in expo-secure-store.
 */
export interface Prefs {
  onboardingDone: boolean;
  reminderTime: string;
  aiDailyLimit: number;
  analyticsOptOut: boolean;
  recentSearches: string[];
  lastFreezeNoticeDate: string;
}

let store: MMKV | null = null;

function mmkv(): MMKV {
  if (!store) store = createMMKV({ id: 'sparksquad-prefs' });
  return store;
}

export function getPref<K extends keyof Prefs>(key: K): Prefs[K] | undefined {
  const raw = mmkv().getString(key);
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw) as Prefs[K];
  } catch {
    return undefined;
  }
}

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]): void {
  mmkv().set(key, JSON.stringify(value));
}

export function removePref(key: keyof Prefs): void {
  mmkv().remove(key);
}

export function clearPrefs(): void {
  mmkv().clearAll();
}
