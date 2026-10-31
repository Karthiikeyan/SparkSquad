import { expo } from '@better-auth/expo';
import { TEXT_LIMITS, ulid, wordFilter } from '@sparksquad/shared';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { emailOTP } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';
import { createDb } from './db/client';
import { account, session, user, verification } from './db/schema';
import type { Bindings } from './env';
import { sendOtpEmail } from './services/email';

const DEV_OTP_OUTBOX_MAX = 500;

/** Codes captured in tests so the sign-in flow can be exercised. Never populated outside APP_ENV=test. */
export const devOtpOutbox = new Map<string, string>();

/** Provider names are shown to squadmates, so they get the same cap and filter as display names. */
function safeName(name: unknown): string {
  const n = typeof name === 'string' ? name.trim().slice(0, TEXT_LIMITS.displayName) : '';
  return n && wordFilter.isAllowed(n) ? n : '';
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
      ...(env.APP_ENV === 'development' ? ['exp://', 'exp://**'] : []),
    ],
    session: {
      expiresIn: 60 * 60 * 24 * 90,
      updateAge: 60 * 60 * 24,
    },
    account: {
      // Social identities link to an existing account only when the provider says the email is verified.
      accountLinking: { enabled: true, trustedProviders: ['email-otp'] },
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
          if (env.APP_ENV === 'test') {
            if (devOtpOutbox.size >= DEV_OTP_OUTBOX_MAX) devOtpOutbox.clear();
            devOtpOutbox.set(email.toLowerCase(), otp);
          }
          const send = sendOtpEmail(env, email, otp);
          if (waitUntil) waitUntil(send);
          else await send;
        },
      }),
    ],
    databaseHooks: {
      user: {
        create: {
          before: async (u) => {
            const name = safeName(u.name);
            return { data: { ...u, name, displayName: name || null } };
          },
        },
        update: {
          before: async (u) =>
            'name' in u ? { data: { ...u, name: safeName(u.name) } } : undefined,
        },
      },
      session: {
        create: {
          // Suspended or deleted accounts cannot start new sessions on any auth route.
          before: async (s) => {
            const row = await db
              .select({ suspendedAt: user.suspendedAt, deletedAt: user.deletedAt })
              .from(user)
              .where(eq(user.id, s.userId))
              .get();
            if (row?.suspendedAt || row?.deletedAt) {
              throw new APIError('FORBIDDEN', { message: 'This account is suspended.' });
            }
            return undefined;
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
