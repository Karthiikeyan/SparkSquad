import type * as GoogleTypes from '@react-native-google-signin/google-signin';
import type * as AppleTypes from 'expo-apple-authentication';
import { randomUUID } from 'expo-crypto';
import { Platform } from 'react-native';
import { authClient } from '../../lib/auth';
import { env } from '../../lib/env';

export type SignInOutcome = 'ok' | 'cancelled';

/** Sign-in failed for a reason worth showing (not a user cancel). */
export class SignInError extends Error {
  constructor(message = 'Sign-in failed') {
    super(message);
    this.name = 'SignInError';
  }
}

type GoogleModule = typeof GoogleTypes;
type AppleModule = typeof AppleTypes;

// Native modules load lazily so Jest and signed-in screens never touch them.
function google(): GoogleModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy native module
  return require('@react-native-google-signin/google-signin') as GoogleModule;
}

function apple(): AppleModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy native module
  return require('expo-apple-authentication') as AppleModule;
}

/** Google needs the server enabled and client ids baked into this build (iOS needs its own). */
export function googleConfigured(): boolean {
  if (!env.googleWebClientId) return false;
  return Platform.OS !== 'ios' || Boolean(env.googleIosClientId);
}

let googleReady = false;

export async function signInWithGoogle(): Promise<SignInOutcome> {
  const g = google();
  if (!googleReady) {
    g.GoogleSignin.configure({
      webClientId: env.googleWebClientId,
      iosClientId: env.googleIosClientId,
      scopes: ['email', 'profile'],
    });
    googleReady = true;
  }
  try {
    if (Platform.OS === 'android') {
      await g.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }
    const res = await g.GoogleSignin.signIn();
    if (!g.isSuccessResponse(res)) return 'cancelled';
    const token = res.data.idToken;
    if (!token) throw new SignInError('Google did not return an ID token');
    const { error } = await authClient.signIn.social({ provider: 'google', idToken: { token } });
    if (error) throw new SignInError(error.message);
    return 'ok';
  } catch (e) {
    if (
      g.isErrorWithCode(e) &&
      (e.code === g.statusCodes.SIGN_IN_CANCELLED || e.code === g.statusCodes.IN_PROGRESS)
    ) {
      return 'cancelled';
    }
    throw e instanceof SignInError ? e : new SignInError();
  }
}

export async function appleAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await apple().isAvailableAsync();
  } catch {
    return false;
  }
}

export async function signInWithApple(): Promise<SignInOutcome> {
  const a = apple();
  const nonce = randomUUID();
  try {
    const cred = await a.signInAsync({
      requestedScopes: [a.AppleAuthenticationScope.FULL_NAME, a.AppleAuthenticationScope.EMAIL],
      nonce,
    });
    if (!cred.identityToken) throw new SignInError('Apple did not return an ID token');
    const given = cred.fullName?.givenName ?? undefined;
    const family = cred.fullName?.familyName ?? undefined;
    const { error } = await authClient.signIn.social({
      provider: 'apple',
      idToken: {
        token: cred.identityToken,
        nonce,
        // Apple only shares the name on the very first sign-in.
        ...(given || family
          ? {
              user: {
                name: { firstName: given, lastName: family },
                email: cred.email ?? undefined,
              },
            }
          : {}),
      },
    });
    if (error) throw new SignInError(error.message);
    return 'ok';
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'ERR_REQUEST_CANCELED') {
      return 'cancelled';
    }
    throw e instanceof SignInError ? e : new SignInError();
  }
}

export async function signOutGoogle(): Promise<void> {
  if (!googleReady) return;
  try {
    await google().GoogleSignin.signOut();
  } catch {
    // Not signed in with Google on this phone.
  }
}

export async function sendEmailCode(email: string): Promise<void> {
  const { error } = await authClient.emailOtp.sendVerificationOtp({
    email: email.trim().toLowerCase(),
    type: 'sign-in',
  });
  if (error) throw new SignInError(error.message);
}

export async function verifyEmailCode(email: string, otp: string): Promise<void> {
  const { error } = await authClient.signIn.emailOtp({
    email: email.trim().toLowerCase(),
    otp,
  });
  if (error) throw new SignInError(error.code ?? error.message);
}
