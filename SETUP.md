# SparkSquad setup

This guide takes you from an empty machine to a running API, a development build on your phone, and store-ready builds. It assumes you have never used Cloudflare, Expo/EAS, RevenueCat or the Google/Apple developer consoles. Follow the sections in order; anything marked **Later** can wait until you need it.

Contents

1. [Prerequisites](#1-prerequisites)
2. [Environment variables and secrets](#2-environment-variables-and-secrets)
3. [Accounts and services](#3-accounts-and-services)
4. [Run locally](#4-run-locally)
5. [Deploy](#5-deploy)
6. [Store submission checklist](#6-store-submission-checklist)
7. [Templates, admins and moderation](#7-templates-admins-and-moderation)
8. [Costs and limits](#8-costs-and-limits)
9. [Troubleshooting](#9-troubleshooting)
10. [Security incidents and data breaches](#10-security-incidents-and-data-breaches)

---

## 1. Prerequisites

| Tool                      | Version                                                         | Install                                                                                                                                   |
| ------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js                   | 22 LTS or newer (the repo needs `>=22`)                         | https://nodejs.org (LTS installer) or `nvm install --lts`                                                                                 |
| pnpm                      | 12.16.1 (pinned in `package.json` `packageManager`)             | `npm i -g pnpm@12.16.1` or `corepack enable`                                                                                              |
| Git                       | any recent                                                      | https://git-scm.com                                                                                                                       |
| Wrangler (Cloudflare CLI) | 4.x, installed with the repo                                    | run it through `pnpm --filter @sparksquad/api exec wrangler ...` (no global install needed)                                               |
| EAS CLI                   | 16 or newer                                                     | `npm i -g eas-cli`                                                                                                                        |
| Android Studio            | latest stable                                                   | https://developer.android.com/studio. Install an emulator image with **Google Play** (API 34+) so Google sign-in and Health Connect work. |
| Xcode (macOS only)        | latest stable, iOS 18+ simulator                                | Mac App Store. Run `xcode-select --install` once. Without a Mac, build iOS in the cloud with EAS.                                         |
| A phone                   | Android 8+ (Health Connect needs Android 8+), iPhone on iOS 17+ | Push notifications, Health Connect/HealthKit and purchases only work on real devices.                                                     |

```bash
git clone <your repo url> sparksquad && cd sparksquad
pnpm install
pnpm typecheck && pnpm lint && pnpm test   # everything should be green
```

The mobile app uses native modules (Google sign-in, MMKV, SQLite, Health Connect, HealthKit, RevenueCat, on-device AI). It **does not run in Expo Go**; you need a development build (section 4).

---

## 2. Environment variables and secrets

Where values live:

- **Mobile, local:** `apps/mobile/.env` (copy from `apps/mobile/.env.example`). Only `EXPO_PUBLIC_*` values reach the app, and they are bundled into it, so **never put secrets there**.
- **Mobile, cloud builds:** EAS environment variables (`eas env:create`, or expo.dev > your project > Environment variables), one set per environment (development / preview / production).
- **API, non-secret:** `[vars]` in `apps/api/wrangler.toml`.
- **API, secrets, local:** `apps/api/.dev.vars` (copy from `.dev.vars.example`; git-ignored).
- **API, secrets, production:** `pnpm --filter @sparksquad/api exec wrangler secret put NAME`.

### Mobile (`apps/mobile`)

| Name                                 | Required                  | What it does                                                                                               | Where to get it                                                                                    | Example                                  | Put it in                                        |
| ------------------------------------ | ------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------ |
| `EXPO_PUBLIC_API_URL`                | Yes                       | Base URL of the API                                                                                        | Your Worker URL after deploy (`wrangler deploy` prints it); locally `http://<your PC LAN IP>:8787` | `https://sparksquad-api.you.workers.dev` | `.env`, EAS env                                  |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`   | For Google sign-in        | Web OAuth client; the token audience the API verifies                                                      | Google Cloud Console > APIs & Services > Credentials > OAuth client (Web application)              | `1234-abc.apps.googleusercontent.com`    | `.env`, EAS env                                  |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`   | For Google sign-in on iOS | iOS OAuth client; also builds the iOS URL scheme                                                           | Same page, OAuth client (iOS)                                                                      | `1234-ios.apps.googleusercontent.com`    | `.env`, EAS env                                  |
| `EXPO_PUBLIC_PAYMENTS_ENABLED`       | No (default `false`)      | Turns on real purchases (must match the API flag)                                                          | You decide                                                                                         | `false`                                  | `.env`, EAS env                                  |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY`     | Only with payments        | RevenueCat public SDK key, Apple app                                                                       | RevenueCat > Project > API keys > App specific (iOS)                                               | `appl_xxx`                               | EAS env                                          |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | Only with payments        | RevenueCat public SDK key, Google app                                                                      | RevenueCat > Project > API keys (Android)                                                          | `goog_xxx`                               | EAS env                                          |
| `EXPO_PUBLIC_POSTHOG_KEY`            | No                        | Anonymous product analytics (off when empty)                                                               | PostHog > Project settings > Project API key                                                       | `phc_xxx`                                | `.env`, EAS env                                  |
| `EXPO_PUBLIC_POSTHOG_HOST`           | No                        | PostHog region host                                                                                        | PostHog project settings                                                                           | `https://eu.i.posthog.com`               | `.env`, EAS env                                  |
| `EXPO_PUBLIC_SENTRY_DSN`             | No                        | Crash reports (off when empty)                                                                             | Sentry > Project > Settings > Client Keys (DSN)                                                    | `https://abc@o1.ingest.sentry.io/2`      | `.env`, EAS env                                  |
| `EXPO_PUBLIC_IOS_STORE_URL`          | Before iOS launch         | App Store page used by the force-update screen                                                             | App Store Connect > your app > App Store link                                                      | `https://apps.apple.com/app/id123`       | EAS env                                          |
| `EXPO_PUBLIC_LIGHT_THEME`            | No (default `false`)      | Shows Settings > Appearance (light theme, see DECISIONS D6/E101)                                           | You decide                                                                                         | `false`                                  | `.env`, EAS env                                  |
| `EAS_PROJECT_ID`                     | Yes for builds and push   | Links the app to your EAS project; push tokens and EAS Update use it                                       | `eas init` prints it; expo.dev > project > Project ID                                              | `0f0e...` (UUID)                         | `.env`, EAS env                                  |
| `APP_VARIANT`                        | Set by `eas.json`         | `development` / `preview` / `production`: changes the app id and name so the variants install side by side | `eas.json` profiles set it                                                                         | `development`                            | `eas.json` (do not set by hand for cloud builds) |

App ids per variant: `com.sparktribe.sparksquad.dev`, `com.sparktribe.sparksquad.preview`, `com.sparktribe.sparksquad`. Register each one you build in Google/Apple consoles.

### API (`apps/api`): non-secret `[vars]` in `wrangler.toml`

| Name                                                                                           | Required          | What it does                                                                                     | Example                                  |
| ---------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| `APP_ENV`                                                                                      | Yes               | `development` logs OTP codes locally and allows `exp://` origins; use `production` when deployed | `production`                             |
| `PAYMENTS_ENABLED`                                                                             | Yes               | `true` turns on RevenueCat purchases; `false` shows "coming soon" paywalls                       | `false`                                  |
| `MIN_APP_VERSION`                                                                              | Yes               | Older app versions see the force-update screen                                                   | `1.0.0`                                  |
| `PUBLIC_API_URL`                                                                               | Yes               | Public base URL of this Worker (auth callbacks, file URLs, invite links)                         | `https://sparksquad-api.you.workers.dev` |
| `ADMIN_EMAILS`                                                                                 | Yes in production | Comma-separated emails allowed into `/admin`                                                     | `you@example.com`                        |
| `EMAIL_FROM`                                                                                   | Yes               | Sender of sign-in codes; must be on a verified Resend domain in production                       | `SparkSquad <hello@yourdomain.com>`      |
| `ANDROID_STORE_URL` / `IOS_STORE_URL`                                                          | Yes               | Store buttons on invite landing pages and force update                                           | Play / App Store links                   |
| `CONTACT_EMAIL`                                                                                | Yes               | Help & contact and grievance address shown in the app                                            | `support@yourdomain.com`                 |
| `R2_BUCKET_NAME`                                                                               | Yes               | R2 bucket for plans, photos and exports (must match `[[r2_buckets]]`)                            | `sparksquad`                             |
| `PRICE_PLUS_MONTHLY`, `PRICE_PLUS_YEARLY`, `PRICE_SQUAD_PRO_MONTHLY`, `PRICE_SQUAD_PRO_YEARLY` | No                | Display prices on the pilot paywall while payments are off; empty shows "Price at launch"        | `₹99`, `₹799`                            |

Bindings (also in `wrangler.toml`, names must not change): `DB` (D1), `BUCKET` (R2), `ASSETS` (admin page), `USER_LIMITER` and `IP_LIMITER` (rate limiting), hourly cron `0 * * * *`.

### API secrets (`.dev.vars` locally, `wrangler secret put` in production)

| Name                                        | Required              | What it does                                                                                      | Where to get it                                                                                                        | Example                               |
| ------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `BETTER_AUTH_SECRET`                        | **Yes**               | Signs sessions                                                                                    | Generate: `openssl rand -base64 32` (or `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`) | 44 random characters                  |
| `GOOGLE_CLIENT_ID`                          | For Google            | Web OAuth client id (same as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`)                                  | Google Cloud > Credentials                                                                                             | `1234-abc.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET`                      | For Google            | Web client secret                                                                                 | Same OAuth client > Client secret                                                                                      | `GOCSPX-...`                          |
| `GOOGLE_IOS_CLIENT_ID`                      | For Google on iOS     | Accepts tokens from the iOS client                                                                | Google Cloud > Credentials (iOS client)                                                                                | `1234-ios.apps...`                    |
| `GOOGLE_ANDROID_CLIENT_ID`                  | For Google on Android | Accepts tokens from the Android client                                                            | Google Cloud > Credentials (Android client)                                                                            | `1234-and.apps...`                    |
| `APPLE_CLIENT_ID`                           | For Apple             | Services ID (identifier)                                                                          | Apple Developer > Identifiers > Services IDs                                                                           | `com.sparktribe.sparksquad.signin`    |
| `APPLE_CLIENT_SECRET`                       | For Apple             | JWT signed with your Sign in with Apple key (expires after at most 6 months; see 3.4)             | Generated by you                                                                                                       | `eyJhbGciOiJFUzI1NiIs...`             |
| `APPLE_APP_BUNDLE_IDENTIFIER`               | For Apple             | Bundle id the native iOS tokens are issued for                                                    | Your app id                                                                                                            | `com.sparktribe.sparksquad`           |
| `RESEND_API_KEY`                            | Yes in production     | Sends email sign-in codes. Without it, codes only appear in the local log (`APP_ENV=development`) | resend.com > API Keys                                                                                                  | `re_...`                              |
| `REVENUECAT_WEBHOOK_SECRET`                 | Only with payments    | Must equal the Authorization header RevenueCat sends                                              | You choose a long random string                                                                                        | `openssl rand -hex 32`                |
| `EXPO_ACCESS_TOKEN`                         | Optional              | Needed only if you turn on "Enhanced push security" in Expo                                       | expo.dev > Account settings > Access tokens                                                                            | `...`                                 |
| `R2_ACCOUNT_ID`                             | Recommended           | Presigned R2 URLs (uploads go straight to R2)                                                     | Cloudflare dashboard > R2 > Account ID (right column)                                                                  | 32 hex chars                          |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Recommended           | R2 S3 API token for presigning                                                                    | R2 > Manage R2 API Tokens > Create token (Object Read & Write, this bucket only)                                       | `...`                                 |

Without the three R2 credentials the API falls back to HMAC-signed URLs served by the Worker (`/files/...`). That works, but every photo byte passes through the Worker and counts against your request quota.

---

## 3. Accounts and services

### 3.1 Cloudflare (API, database, storage)

1. Create a free account at https://dash.cloudflare.com.
2. Log in from the repo: `pnpm --filter @sparksquad/api exec wrangler login`.
3. **D1 database**
   ```bash
   cd apps/api
   pnpm exec wrangler d1 create sparksquad
   ```
   Copy the printed `database_id` into `wrangler.toml` (`[[d1_databases]]`). Then apply migrations:
   ```bash
   pnpm db:migrate:local    # local SQLite used by wrangler dev
   pnpm db:migrate:remote   # your Cloudflare database
   ```
4. **R2 bucket**: dashboard > R2 > enable R2 (free tier needs a payment method on file but stays free inside the limits) > Create bucket `sparksquad`. Or `pnpm exec wrangler r2 bucket create sparksquad`.
5. **R2 lifecycle rules** (bucket > Settings > Object lifecycle rules > Add rule), one rule per prefix:
   | Rule                                                | Prefix       | Delete objects after |
   | --------------------------------------------------- | ------------ | -------------------- |
   | Plus photos                                         | `proof-30d/` | 30 days              |
   | Squad Pro photos                                    | `proof-90d/` | 90 days              |
   | Exports                                             | `exports/`   | 1 day                |
   | Do **not** add a rule for `plans/` or `templates/`. |
6. **R2 API token** (for presigned URLs): R2 > Manage R2 API Tokens > Create API token > permission _Object Read & Write_, scope _Apply to specific buckets only: sparksquad_. Save the Access Key ID and Secret as `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`, and the account id as `R2_ACCOUNT_ID`.
7. **Rate limiting** is the `[[ratelimits]]` binding in `wrangler.toml` (120 requests/min per user, 300/min per IP). Nothing to click; it deploys with the Worker.
8. **Cron**: `[triggers] crons = ["0 * * * *"]` deploys with the Worker (hourly digests, streak settling, challenge roll-ups, expiry). Check it under Workers > sparksquad-api > Settings > Triggers.
9. **Secrets**: for every secret in section 2 run `pnpm exec wrangler secret put NAME` and paste the value.
10. **Deploy**: `pnpm run deploy` (from `apps/api`; plain `pnpm deploy` is a different, built-in pnpm command). Note the `https://sparksquad-api.<you>.workers.dev` URL and set it as `PUBLIC_API_URL` (wrangler.toml) and `EXPO_PUBLIC_API_URL` (mobile), then deploy again.
11. **Custom domain (optional, Later)**: Workers > sparksquad-api > Settings > Domains & Routes > Add custom domain. Update `PUBLIC_API_URL` and `EXPO_PUBLIC_API_URL`. With a domain you can add iOS universal links and Android App Links for `https://<domain>/join/CODE` (DECISIONS D5); until then invite links open a landing page that hands off to `sparksquad://join/CODE`.

### 3.2 Better Auth

No account needed. Generate `BETTER_AUTH_SECRET` (section 2) and set it in `.dev.vars` and with `wrangler secret put`. Changing it signs everyone out.

### 3.3 Google sign-in (Google Cloud Console)

1. https://console.cloud.google.com > create project "SparkSquad".
2. APIs & Services > **OAuth consent screen**: External, app name, support email, logo (optional), authorised domain (your API domain if you have one), scopes `email`, `profile`, `openid`. Add yourself as a test user while in Testing; Publish when you launch.
3. Credentials > Create credentials > OAuth client ID, three times:
   - **Web application** (no redirect URIs needed for native sign-in). Client id → `GOOGLE_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`; secret → `GOOGLE_CLIENT_SECRET`.
   - **Android**: package `com.sparktribe.sparksquad` (one client per variant you build, e.g. `.dev`), SHA-1 from `eas credentials -p android` > select the build profile > _Keystore_ (shows SHA-1). After your first Play upload, add a second Android client with the **App signing key SHA-1** from Play Console > Setup > App signing. Client id → `GOOGLE_ANDROID_CLIENT_ID`.
   - **iOS**: bundle id `com.sparktribe.sparksquad`. Client id → `GOOGLE_IOS_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`. The app config turns it into the reversed URL scheme automatically.
4. Rebuild the app after changing `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (it changes native config).

### 3.4 Sign in with Apple (Apple Developer, US$99/year)

1. https://developer.apple.com > Certificates, Identifiers & Profiles > **Identifiers** > App IDs > your bundle id (EAS creates it on first build, or add it) > enable **Sign In with Apple** and **HealthKit**.
2. Identifiers > **Services IDs** > new, e.g. `com.sparktribe.sparksquad.signin`, enable Sign In with Apple, primary App ID = your app, domain = your API host, return URL = `<PUBLIC_API_URL>/api/auth/callback/apple`. This is `APPLE_CLIENT_ID`.
3. **Keys** > new key, enable Sign In with Apple, download the `.p8` (only once), note the **Key ID** and your **Team ID** (top right).
4. Generate `APPLE_CLIENT_SECRET` (valid up to 6 months; set a calendar reminder to renew):
   ```bash
   node -e "
   const c=require('crypto'),fs=require('fs');
   const [team,key,svc,p8]=process.argv.slice(1);
   const b=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
   const now=Math.floor(Date.now()/1000);
   const h=b({alg:'ES256',kid:key}), p=b({iss:team,iat:now,exp:now+180*86400,aud:'https://appleid.apple.com',sub:svc});
   const s=c.sign('sha256',Buffer.from(h+'.'+p),{key:fs.readFileSync(p8),dsaEncoding:'ieee-p1363'}).toString('base64url');
   console.log(h+'.'+p+'.'+s)" TEAMID KEYID com.sparktribe.sparksquad.signin ./AuthKey_KEYID.p8
   ```
5. Set `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`, `APPLE_APP_BUNDLE_IDENTIFIER` as secrets. The iOS app signs in natively (identity token for the bundle id); the Services ID covers web/admin flows.

### 3.5 Resend (email sign-in codes)

1. https://resend.com > sign up > **API Keys** > create (Sending access) → `RESEND_API_KEY`.
2. For testing, `onboarding@resend.dev` can only send to your own Resend account email. For real users: **Domains** > add your domain, add the DNS records it shows (SPF, DKIM), wait for _Verified_, then set `EMAIL_FROM` to `SparkSquad <hello@yourdomain.com>`.

### 3.6 Expo / EAS (builds, push, updates)

1. Create an account at https://expo.dev, then `eas login`.
2. From `apps/mobile`: `eas init` → copy the project id into `EAS_PROJECT_ID` (`.env` and EAS env).
3. Set the mobile `EXPO_PUBLIC_*` values for each environment: `eas env:create --environment production --name EXPO_PUBLIC_API_URL --value https://... --visibility plaintext` (repeat per variable and environment).
4. **Android push (FCM v1)**: Firebase console > add project > add Android app with your package > Project settings > Service accounts > _Generate new private key_ (JSON). Then `eas credentials -p android` > profile > _Google Service Account_ > _Manage your Google Service Account Key for Push Notifications (FCM V1)_ > upload the JSON.
5. **iOS push (APNs)**: `eas credentials -p ios` > profile > _Push Notifications_ > let EAS create the APNs key (or upload one from Apple Developer > Keys with APNs enabled).
6. Credentials for signing are created on the first `eas build`; let EAS manage them.
7. Channels match the profiles in `eas.json`: `development`, `preview`, `production`.

### 3.7 RevenueCat (**Later: when you turn on payments**)

1. Store side:
   - Play Console > your app > Monetize > Subscriptions: create `sparksquad_plus` (base plans `monthly`, `yearly`) and `sparksquad_squad_pro` (same).
   - App Store Connect > your app > Subscriptions: a group "SparkSquad", products `sparksquad_plus_monthly`, `sparksquad_plus_yearly`, `sparksquad_squad_pro_monthly`, `sparksquad_squad_pro_yearly`.
   - Set prices there; the app never hard-codes prices.
2. https://app.revenuecat.com > new project > add the Play Store app (upload a Google service account JSON with Play Console access, see RevenueCat docs) and the App Store app (App Store Connect API key + In-App Purchase key).
3. **Entitlements** (names must match the code exactly): `plus` and `squad_pro`. Attach the Plus products to `plus` and the Squad Pro products to `squad_pro`.
4. **Offerings**: `plus` (packages _Annual_ `$rc_annual` and _Monthly_ `$rc_monthly` with the Plus products) and `squad_pro` (same with Squad Pro products). Make `plus` the current offering.
5. **Webhook**: Project > Integrations > Webhooks > URL `<PUBLIC_API_URL>/webhooks/revenuecat`, Authorization header value = your `REVENUECAT_WEBHOOK_SECRET` (with or without `Bearer `). Send a test event; the API answers 200.
6. API keys: Project > API keys → `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`.
7. Squad Pro purchases set the subscriber attribute `squad_id`; nothing to configure.
8. Switch on: `PAYMENTS_ENABLED = "true"` in `wrangler.toml` (deploy) **and** `EXPO_PUBLIC_PAYMENTS_ENABLED=true` in EAS env (new build). Payments only go live when both are on and the key is present.

### 3.8 PostHog and Sentry (optional)

- PostHog: https://posthog.com > project > copy the Project API key and host. Events carry no personal data; users can opt out in the app.
- Sentry: https://sentry.io > new project (React Native) > copy the DSN. The app strips headers, bodies, network breadcrumbs and anything key-like before sending.

### 3.9 Health Connect and HealthKit (steps)

- The config plugins add `android.permission.health.READ_STEPS`, the Health Connect rationale activity, `minSdkVersion 26`, the HealthKit entitlement and `NSHealthShareUsageDescription`. Nothing to change in code.
- Android: users need the Health Connect app (built into Android 14+, Play Store on 8–13). Play Console requires a **Health apps declaration** (App content > Health apps): declare read access to _Steps_ for "fitness tracking", link the privacy policy.
- iOS: enable **HealthKit** on the App ID (3.4 step 1). In App Store Connect privacy labels declare _Health & Fitness_ data used for app functionality, not linked to identity, not tracking (steps never leave the phone).

---

## 4. Run locally

### API

```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars   # set BETTER_AUTH_SECRET at least
cd apps/api
pnpm db:migrate:local
pnpm seed:templates           # loads templates/*.sparksquad.json into local D1 + R2
pnpm dev                      # http://localhost:8787 (wrangler dev, local D1/R2)
```

Check: `curl http://localhost:8787/v1/config` returns limits and features. Without `RESEND_API_KEY`, sign-in codes are printed in the `wrangler dev` log (development only).

### Mobile (development build)

```bash
cp apps/mobile/.env.example apps/mobile/.env
# EXPO_PUBLIC_API_URL=http://<your PC LAN IP>:8787   (not localhost on a phone; emulator can use http://10.0.2.2:8787)
cd apps/mobile
pnpm android        # builds and installs the dev client on an emulator/device (Android Studio required)
pnpm ios            # macOS + Xcode, iOS simulator
pnpm dev            # later: just start Metro and open the installed dev client
```

No Mac? `eas build --profile development --platform ios` (simulator build) or `--profile development-device` (real iPhone, needs the device registered with `eas device:create`).

### Test accounts

Use email sign-in with any address; in development the code is in the API log. Create two or three accounts (for example on an emulator and a phone) to test squads, nudges and comments. Add your email to `ADMIN_EMAILS` to use `/admin`.

---

## 5. Deploy

**API**

```bash
cd apps/api
pnpm db:migrate:remote        # every time a new migration is added
pnpm run deploy
pnpm seed:templates -- --remote   # first deploy, and whenever templates change
```

**Mobile (EAS Build, internal testing)**

```bash
cd apps/mobile
eas build --profile preview --platform android      # APK you can share with testers
eas build --profile preview --platform ios          # ad hoc; register devices with `eas device:create`
eas build --profile production --platform all       # store builds (AAB / IPA)
eas submit --profile production --platform android  # uploads to Play internal testing
eas submit --profile production --platform ios      # uploads to TestFlight
```

**Over-the-air updates (EAS Update)**: JavaScript-only fixes can ship without a store release:

```bash
eas update --channel production --message "Fix board refresh"
```

Updates reach builds with the same app version (`runtimeVersion` policy `appVersion`). Bump `version` in `app.config.ts` whenever native code or config changes, and also raise `MIN_APP_VERSION` if old builds must update.

---

## 6. Store submission checklist

### Google Play Console

- [ ] Developer account (US$25 one-time). **New personal accounts must run a closed test with at least 12 testers for 14 days** before production access.
- [ ] App content > **Data safety**: collects email, name, user IDs, app interactions, user-generated content (check-ins, comments, photos for Plus), optional crash logs and analytics; encrypted in transit; users can request deletion (in app and by email). Steps: collected on device, not shared.
- [ ] App content > **Health apps** declaration for READ_STEPS (3.9).
- [ ] App content > **Target audience**: 18+ only. Content rating questionnaire (user-generated content, users interact).
- [ ] App content > Privacy policy URL (host the in-app policy text, e.g. on your domain).
- [ ] Account deletion URL / instructions (Settings > Delete account; also by email to `CONTACT_EMAIL`).
- [ ] App signing SHA-1 added to Google OAuth (3.3).
- [ ] Store listing: icon (replace the placeholder spark), feature graphic, screenshots.

### App Store Connect

- [ ] **Privacy nutrition labels**: Contact info (email), User content, Identifiers (user ID), Usage data and Diagnostics (only if PostHog/Sentry are on); Health & Fitness used on device only.
- [ ] **Sign in with Apple** is offered (required because Google sign-in exists).
- [ ] **Account deletion** in app (Settings > Delete account) - required.
- [ ] **UGC guideline 1.2**: terms acceptance at sign-up (18+ and Terms consent), report content and report users, block users, `/admin` moderation queue, contact email in Help.
- [ ] Age rating 17+/18+ (unrestricted user-generated content).
- [ ] HealthKit usage explained in review notes.
- [ ] **Review notes**: a demo account (create it on production, put the email in notes; since sign-in uses email codes, either give the reviewer access to that inbox or temporarily allow an extra sign-in method), how to join a squad (invite code), and that payments are off ("Plus is coming soon") if `PAYMENTS_ENABLED=false`.
- [ ] Subscriptions submitted with the first build if payments are on.

---

## 7. Templates, admins and moderation

- **Templates** live in `templates/*.sparksquad.json` (same format as user plans, `docs/05_PLAN_FORMAT.md`). Edit or add a file, run `pnpm templates:build` (validates and formats), then `pnpm seed:templates` (local) or `pnpm seed:templates -- --remote`.
- **First admin**: put your email in `ADMIN_EMAILS` (`wrangler.toml` `[vars]`, comma-separated) and deploy. Open `<PUBLIC_API_URL>/admin`, sign in with an email code.
- **Moderating reports**: the admin page lists open reports (check-ins, comments, users, squads). Actions: _Hide_ (removes the content), _Suspend_ (blocks the user's account), _Dismiss_. Respond to user complaints sent to `CONTACT_EMAIL` within 7 days (the privacy policy promises this).

---

## 8. Costs and limits

Free users are designed to cost about nothing: no sockets, delta sync, local reminders, photos never uploaded on Free, AI only on device or with the user's own key.

| Service            | Free tier                                                            | Watch                                                                                    |
| ------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Cloudflare Workers | 100,000 requests/day, 10 ms CPU per request                          | Requests/day in the Workers dashboard. A daily active user makes roughly 10-30 requests. |
| D1                 | 500 MB per database (free plan), 5 M rows read/day                   | Database size (Workers & Pages > D1). Check-ins are rolled up after challenges end.      |
| R2                 | 10 GB storage, 1 M Class A / 10 M Class B ops per month, free egress | Storage (Plus photos; lifecycle rules delete them).                                      |
| Resend             | 3,000 emails/month (100/day)                                         | Sign-in volume; upgrade if launch traffic is high.                                       |
| Expo push          | Free                                                                 | -                                                                                        |
| EAS Build          | Limited free builds per month (queue)                                | Paid plan only if you need faster/more builds.                                           |
| RevenueCat         | Free up to a revenue threshold                                       | -                                                                                        |

**Move to Workers Paid (US$5/month)** when you regularly pass ~70% of 100k requests/day, need more CPU time per request (large syncs), or D1 approaches 500 MB (paid raises limits to 10 GB per database).

---

## 9. Troubleshooting

1. **Google: `DEVELOPER_ERROR` / "redirect_uri_mismatch" / sign-in sheet closes.** The Android client's SHA-1 doesn't match the build's signing key, or the package name differs (`.dev`/`.preview` variants need their own client). Get the SHA-1 from `eas credentials -p android` (and Play App Signing for store builds). Make sure the API has the client id in `GOOGLE_*_CLIENT_ID` and the app uses the **Web** client id for `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
2. **Google on iOS crashes or opens nothing.** `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` was missing when the build was made (the URL scheme is generated at build time). Set it and rebuild.
3. **No push notifications.** Push needs a real device and a development/preview build (not a simulator, not Expo Go). Check `EAS_PROJECT_ID` is set, FCM v1 key (Android) and APNs key (iOS) are uploaded in `eas credentials`, and the user allowed notifications (Settings > Notifications shows a banner otherwise).
4. **`D1_ERROR: no such table` or "Couldn't find a D1 DB with the name or binding 'DB'".** Run `pnpm db:migrate:local` / `db:migrate:remote`, and keep the binding name `DB` and `database_id` in `wrangler.toml` correct.
5. **App can't reach the API locally ("Network request failed").** A phone can't use `localhost`; set `EXPO_PUBLIC_API_URL` to your PC's LAN IP (`http://192.168.x.x:8787`), allow port 8787 through the firewall, or use `http://10.0.2.2:8787` on the Android emulator. Restart Metro after editing `.env`. (CORS doesn't apply to the native app; for the `/admin` page use the same origin as the API.)
6. **Invite links open the browser, not the app.** `sparksquad://join/CODE` works once the app is installed; the `https://.../join/CODE` page hands off to it. True universal/App Links need a custom domain (3.1 step 11).
7. **Steps: "Install or update Health Connect".** On Android 8-13 install Health Connect from the Play Store; emulators need a Google Play image. On iOS, HealthKit never reports a denied read: if steps stay at 0, check Health > Sharing > Apps > SparkSquad.
8. **RevenueCat: "Plans aren't available right now" / no products.** Use a sandbox tester (App Store) or a license tester (Play Console > Setup > License testing); products must be _Active_ and attached to the offerings `plus` / `squad_pro` with Annual/Monthly packages; the build must use the right `EXPO_PUBLIC_REVENUECAT_*` key; both payments flags must be on. After buying, Plus appears once the webhook reaches the API: check the RevenueCat webhook log for 401 (secret mismatch).
9. **Check-in rejected with `CHECKIN_WINDOW_CLOSED` or days look shifted.** The phone's timezone differs from the profile timezone. The app updates the timezone on launch; check the device's automatic time zone setting. Check-ins are accepted for today and yesterday only.
10. **EAS build fails.** Run `pnpm install` at the repo root and commit `pnpm-lock.yaml`; make sure `eas.json` pnpm version matches `packageManager`; run `npx expo install --check` in `apps/mobile`; for iOS "provisioning profile doesn't include capability", re-run `eas credentials -p ios` after enabling HealthKit / Sign in with Apple on the App ID.

---

## 10. Security incidents and data breaches

SparkSquad stores personal data of users in India, so the Digital Personal Data Protection Act (DPDP) applies. If you suspect a breach (leaked secret, unexpected data access, lost device with admin access):

1. **Contain**: rotate the affected secrets now (`wrangler secret put BETTER_AUTH_SECRET` signs everyone out; rotate R2, Resend, RevenueCat, Google/Apple secrets as relevant), revoke leaked R2 tokens, and redeploy.
2. **Assess**: what data, which users, since when. Use Cloudflare Workers logs (observability is on) and D1 queries.
3. **Notify**: inform the Data Protection Board of India and affected users without delay, in the form the DPDP Rules require (what happened, likely impact, what you did, what users should do, contact person: `CONTACT_EMAIL`).
4. **Record**: keep a written log of the incident, decisions and notifications.
5. **Fix and review**: patch the cause, add a test, and note it in `docs/DECISIONS.md`.
