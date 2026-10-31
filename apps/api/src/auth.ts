import { expo } from '@better-auth/expo';
import { ulid } from '@sparksquad/shared';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins';
import { createDb } from './db/client';
import { account, session, user, verification } from './db/schema';
import type { Bindings } from './env';
import { sendOtpEmail } from './services/email';

/** Codes captured in tests (and local dev without Resend) so the flow can be exercised. */
export const devOtpOutbox = new Map<string, string>();

function isLocalEnv(env: Bindings): boolean {
  return env.APP_ENV === 'development' || env.APP_ENV === 'test';
}

export function createAuth(env: Bindings, waitUntil?: (p: Promise<unknown>) => void) {
  const db = createDb(env.DB);
  const googleClientIds = [
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_IOS_CLIENT_ID,
    env.GOOGLE_ANDROID_CLIENT_ID,
  ].filter((v): v is string => Boolean(v));

  return betterAuth({
    appName: 'SparkSquad',
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.PUBLIC_API_URL,
    basePath: '/api/auth',
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: { user, session, account, verification },
    }),
    trustedOrigins: [
      'sparksquad://',
      'sparksquad://*',
      'https://appleid.apple.com',
      ...(isLocalEnv(env) ? ['exp://', 'exp://**'] : []),
    ],
    session: {
      expiresIn: 60 * 60 * 24 * 90,
      updateAge: 60 * 60 * 24,
    },
    account: {
      accountLinking: { enabled: true, trustedProviders: ['google', 'apple', 'email-otp'] },
    },
    advanced: {
      database: { generateId: () => ulid() },
    },
    socialProviders: {
      ...(googleClientIds.length > 0
        ? {
            google: {
              clientId: googleClientIds,
              clientSecret: env.GOOGLE_CLIENT_SECRET ?? '',
            },
          }
        : {}),
      ...(env.APPLE_CLIENT_ID
        ? {
            apple: {
              clientId: env.APPLE_CLIENT_ID,
              clientSecret: env.APPLE_CLIENT_SECRET ?? '',
              ...(env.APPLE_APP_BUNDLE_IDENTIFIER
                ? { appBundleIdentifier: env.APPLE_APP_BUNDLE_IDENTIFIER }
                : {}),
            },
          }
        : {}),
    },
    plugins: [
      expo(),
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        allowedAttempts: 5,
        storeOTP: 'hashed',
        async sendVerificationOTP({ email, otp }) {
          if (isLocalEnv(env)) devOtpOutbox.set(email.toLowerCase(), otp);
          const send = sendOtpEmail(env, email, otp);
          if (waitUntil) waitUntil(send);
          else await send;
        },
      }),
    ],
    databaseHooks: {
      user: {
        create: {
          before: async (u) => ({
            data: { ...u, displayName: (u.name || '').slice(0, 40) || null },
          }),
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
