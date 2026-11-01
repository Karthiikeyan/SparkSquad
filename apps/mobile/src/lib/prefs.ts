import { createMMKV, type MMKV } from 'react-native-mmkv';

/**
 * Small, non-secret preferences (MMKV). Secrets (auth cookies, BYOK keys) never go here:
 * they live in expo-secure-store.
 */
export interface Prefs {
  /** User id that finished onboarding on this phone (per-user so account switches re-check). */
  onboardedUserId: string;
  /** Invite code from a deep link, consumed after sign-in/onboarding. */
  pendingInvite: string;
  /** Expo push token registered with the API for this install. */
  pushToken: string;
  reminderTime: string;
  aiDailyLimit: number;
  aiUsage: { date: string; count: number };
  aiProvider: 'gemini' | 'groq' | 'openrouter' | 'openai' | 'anthropic';
  analyticsOptOut: boolean;
  recentSearches: string[];
  lastFreezeNoticeDate: string;
  /** Public handles for on-device verification (mirrors the server; usernames only). */
  integrations: Partial<Record<'github' | 'leetcode' | 'codeforces', string>>;
  /** The user allowed reading steps from Health Connect / HealthKit on this phone. */
  stepsConnected: boolean;
  /** Colour theme; dark is the default (Design System). Applied at launch. */
  theme: 'dark' | 'light' | 'system';
  /** AI providers the user agreed to send data to (App Store 5.1.2). */
  aiConsent: ('gemini' | 'groq' | 'openrouter' | 'openai' | 'anthropic')[];
  /** This phone signed in with Apple, so deleting the account must revoke Apple's tokens. */
  appleSignIn: boolean;
  /** What the Android home-screen widget draws (written by the app, read in the background). */
  widgetSnapshot: {
    /** What's due, for today and the next two days so it's right after midnight. */
    days: Record<
      string,
      {
        challengeId: string;
        squad: string;
        title: string;
        checkedIn: boolean;
        checked: number;
        members: number;
        tasks: {
          title: string;
          type: 'check' | 'count' | 'minutes';
          target?: number;
          unit?: string;
        }[];
        values: Record<number, number | boolean>;
      }[]
    >;
  };
  /** When the store rating prompt last showed (ISO date). */
  reviewAskedAt: string;
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

/* Keyed JSON values outside the fixed Prefs shape (drafts, local photo paths). */

export function getKeyed<T>(namespace: 'draft' | 'photo', key: string): T | undefined {
  const raw = mmkv().getString(`${namespace}:${key}`);
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function setKeyed(namespace: 'draft' | 'photo', key: string, value: unknown): void {
  mmkv().set(`${namespace}:${key}`, JSON.stringify(value));
}

export function removeKeyed(namespace: 'draft' | 'photo', key: string): void {
  mmkv().remove(`${namespace}:${key}`);
}

/** Removes every draft and local photo path (sign-out / account switch). */
export function clearKeyed(): void {
  for (const k of mmkv().getAllKeys()) {
    if (k.startsWith('draft:') || k.startsWith('photo:')) mmkv().remove(k);
  }
}
