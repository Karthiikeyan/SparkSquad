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

  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_IOS_CLIENT_ID?: string;
  GOOGLE_ANDROID_CLIENT_ID?: string;
  APPLE_CLIENT_ID?: string;
  APPLE_CLIENT_SECRET?: string;
  APPLE_APP_BUNDLE_IDENTIFIER?: string;
  RESEND_API_KEY?: string;
  REVENUECAT_WEBHOOK_SECRET?: string;
  EXPO_ACCESS_TOKEN?: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
}

export interface AppEnv {
  Bindings: Bindings;
}
