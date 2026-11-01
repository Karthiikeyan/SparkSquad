export interface Bindings {
  DB: D1Database;
  BUCKET: R2Bucket;
  ASSETS: Fetcher;
  USER_LIMITER: RateLimit;
  IP_LIMITER: RateLimit;

  APP_ENV: string;
  PAYMENTS_ENABLED: string;
  MIN_APP_VERSION: string;
  PUBLIC_API_URL: string;
  ADMIN_EMAILS: string;
  EMAIL_FROM: string;
  ANDROID_STORE_URL: string;
  IOS_STORE_URL: string;
  CONTACT_EMAIL: string;
  /** Display prices for the pilot paywall when payments are off (e.g. "₹99"); empty hides them. */
  PRICE_PLUS_MONTHLY?: string;
  PRICE_PLUS_YEARLY?: string;
  PRICE_SQUAD_PRO_MONTHLY?: string;
  PRICE_SQUAD_PRO_YEARLY?: string;

  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_IOS_CLIENT_ID?: string;
  GOOGLE_ANDROID_CLIENT_ID?: string;
  APPLE_CLIENT_ID?: string;
  APPLE_CLIENT_SECRET?: string;
  APPLE_APP_BUNDLE_IDENTIFIER?: string;
  /** `email:123456`. Fixed sign-in code for the one account store reviewers use. Unset = off. */
  REVIEW_ACCOUNT?: string;
  RESEND_API_KEY?: string;
  REVENUECAT_WEBHOOK_SECRET?: string;
  /** "true" lets RevenueCat SANDBOX events grant entitlements when APP_ENV=production (staging only). */
  REVENUECAT_ALLOW_SANDBOX?: string;
  EXPO_ACCESS_TOKEN?: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
}

export interface AuthedUser {
  id: string;
  email: string;
  name: string;
}

export interface Variables {
  user: AuthedUser;
  requestId: string;
}

export interface AppEnv {
  Bindings: Bindings;
  Variables: Variables;
}
