import Constants from 'expo-constants';

interface Extra {
  apiUrl?: string;
  eas?: { projectId?: string };
}

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

function flag(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

/** Public, non-secret build configuration. EXPO_PUBLIC_* values are inlined at build time. */
export const env = {
  apiUrl: (process.env.EXPO_PUBLIC_API_URL ?? extra.apiUrl ?? 'http://localhost:8787').replace(
    /\/+$/,
    '',
  ),
  appVersion: Constants.expoConfig?.version ?? '0.0.0',
  scheme: 'sparksquad',
  paymentsEnabled: flag(process.env.EXPO_PUBLIC_PAYMENTS_ENABLED),
  /** Public RevenueCat SDK keys (safe to ship; only used when payments are on). */
  revenuecatIosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || undefined,
  revenuecatAndroidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || undefined,
  posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY || undefined,
  posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || undefined,
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined,
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
  easProjectId: extra.eas?.projectId || undefined,
} as const;

/** Compares dotted versions numerically ("1.10.0" > "1.9.3"). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}
