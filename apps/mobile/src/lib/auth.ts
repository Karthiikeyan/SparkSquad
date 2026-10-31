import { expoClient } from '@better-auth/expo/client';
import { emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';
import { env } from './env';

/**
 * Better Auth client. The Expo plugin keeps the session cookie in expo-secure-store
 * and exposes `getCookie()` so our own API calls can authenticate.
 */
export const authClient = createAuthClient({
  baseURL: `${env.apiUrl}/api/auth`,
  plugins: [
    expoClient({
      scheme: env.scheme,
      storagePrefix: 'sparksquad',
      storage: SecureStore,
    }),
    emailOTPClient(),
  ],
});

export async function authCookie(): Promise<string> {
  try {
    return await authClient.getCookie();
  } catch {
    return '';
  }
}
