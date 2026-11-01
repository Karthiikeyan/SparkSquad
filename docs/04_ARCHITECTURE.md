# SparkSquad — Architecture

Goal: **₹0/month infrastructure until ~10,000 monthly users, ~US$7/month at 100,000.** The server stores only small text rows; the phone does everything else. All TypeScript.

## 1. Stack

| Layer | Choice |
|---|---|
| Monorepo | pnpm workspaces (+ Turborepo for task running). Node LTS. |
| Mobile | React Native + **Expo** (latest stable SDK), **Expo Router**, TypeScript strict, **development builds** (not Expo Go — native modules needed). |
| Styling | React Native `StyleSheet` with the tokens from `02_DESIGN_SYSTEM.md` in `src/theme/colors.js` and a typed `src/theme/tokens.ts` (NativeWind removed, see DECISIONS E117). |
| Data on phone | TanStack Query (server cache) + **expo-sqlite** with Drizzle ORM for the offline store (boards, my check-ins, outbox queue). MMKV for small prefs. |
| Secure storage | expo-secure-store (BYOK API keys, auth tokens). |
| API | **Hono** on **Cloudflare Workers**, zod validation (schemas shared from `packages/shared`). |
| Database | **Cloudflare D1** (SQLite) + **Drizzle ORM** + drizzle-kit migrations. |
| Auth | **Better Auth** on Workers + D1 (Drizzle adapter) with the Expo plugin: Google, Apple, email OTP. Email via **Resend** (free tier). |
| Files | **Cloudflare R2**: plan JSON files, Plus photo proofs (lifecycle rules: `proof-30d/` 30 days, `proof-90d/` 90 days), data exports (1-day expiry). Uploads via presigned PUT URLs. |
| Scheduled jobs | Workers **Cron Triggers** (hourly). |
| Push | **Expo push service** (wraps FCM + APNs), sent from the Worker with `fetch` in batches of 100. |
| Payments | **RevenueCat** (`react-native-purchases`) + Play Billing / App Store IAP. Server trusts RevenueCat **webhooks** for entitlements. Behind the `PAYMENTS_ENABLED` flag (default off for the pilot; see Product Spec §4). |
| Analytics / errors | PostHog (React Native SDK, free tier) and Sentry (`@sentry/react-native`, free tier). Both behind env flags; app runs without them. |
| Builds / OTA | EAS Build (free tier) + EAS Update. |
| Testing | Vitest (shared + API, using `@cloudflare/vitest-pool-workers`), Jest + React Native Testing Library (mobile units), optional Maestro flows. |
| CI | GitHub Actions: install, lint (ESLint + Prettier), typecheck, test on every PR. |

## 2. Repository layout

```
sparksquad/
  apps/
    mobile/                 Expo app
      app/                  Expo Router routes (see 03_SCREENS.md)
      src/
        components/ui/      design-system components
        components/         feature components (TaskRow, AvatarRing, DayStrip, ShareCard...)
        features/           auth, today, checkin, squads, plan, create, discover, profile, settings, ai, verify, billing
        lib/                api client, query keys, db (sqlite+drizzle), outbox, notifications, analytics
        theme/              tokens, fonts
        i18n/               en.json (every user-facing string)
      app.config.ts         reads env, config plugins
    api/                    Cloudflare Worker
      src/
        routes/             one file per resource
        db/schema.ts        Drizzle schema
        db/migrations/
        auth.ts             Better Auth config
        services/           limits, scoring, push, r2, moderation, revenuecat
        cron/               hourly job
        admin/              /admin static page + routes
      wrangler.toml
  packages/
    shared/                 types, zod schemas, plan-format parser & validator, scoring/streak logic,
                            tier limits config, date helpers (local-date math), word filter, i18n keys
  templates/                plan templates as SparkSquad plan JSON (dsa-30, aptitude-21, sql-30, steps-10k, ...)
  docs/                     this kit (keep it updated) + DECISIONS.md
  .github/workflows/ci.yml
  SETUP.md                  generated at the end (see master prompt)
```

## 3. Data model (D1 / SQLite, Drizzle)

IDs are ULIDs (text). Times are UTC ISO strings; **local dates** are `YYYY-MM-DD` strings computed with the member's IANA timezone. Better Auth owns `user`, `session`, `account`, `verification` (extend `user` with profile columns).

```
user            (+ username UNIQUE, displayName, avatarColor, timezone, interests JSON,
                   ageConfirmedAt, termsAcceptedAt, reminderTime, plan 'free'|'plus', planExpiresAt,
                   suspendedAt, deletedAt)
squads          id, name, description, rules, category, privacy, ownerId, inviteCode UNIQUE,
                chatUrl, memberLimit, isPro, proExpiresAt, allowPersonalTargets, partialCounts,
                createdAt, updatedAt, archivedAt
squad_members   squadId, userId, role, status 'active'|'pending'|'removed'|'left', joinedAt,
                mutedAt, updatedAt         PK(squadId,userId)
announcements   squadId PK, body, authorId, updatedAt
challenges      id, squadId, title, planKey (R2), planHash, planVersion, durationDays, daysPerWeek,
                startDate (local date), status 'active'|'ended', createdBy, createdAt, endedAt, updatedAt
plan_day_edits  challengeId, dayNumber, dayJson, editedBy, updatedAt   PK(challengeId,dayNumber)
                (owner edits overlay the R2 plan; phones merge them)
checkins        id (client ULID, idempotent), challengeId, userId, localDate, dayNumber,
                status 'done'|'partial'|'honest_miss', values JSON [{t:index, v:number|bool}],
                note, hasPhoto, photoKey, verified JSON, reactionCount, commentCount, edited,
                createdAt, updatedAt         UNIQUE(challengeId,userId,localDate)
reactions       checkinId, userId, kind, createdAt   PK(checkinId,userId,kind)
comments        id, checkinId, userId, body, createdAt, expiresAt, hiddenAt
nudges          challengeId, fromUserId, toUserId, localDate, createdAt   PK(all four except createdAt)
streaks         userId, scope ('global' | challengeId), current, best, freezes, lastDoneDate, updatedAt
member_summary  challengeId, userId, daysDone, daysElapsed, tasksDone, bestStreak, updatedAt
                (roll-up written when a challenge ends; raw check-ins older than 60 days after
                 challenge end are deleted for free squads after export window)
badges          userId, badge, earnedAt     PK(userId,badge)
push_tokens     token PK, userId, platform, updatedAt
notifications   id, userId, kind, payload JSON, readAt, createdAt   (inbox; delete after 30 days)
integrations    userId, provider 'github'|'leetcode'|'codeforces', handle   PK(userId,provider)
entitlements    id, userId, product, squadId NULL, status, expiresAt, rcEventId, updatedAt
reports         id, reporterId, targetType, targetId, reason, details, status, createdAt, resolvedAt
blocks          blockerId, blockedId, createdAt   PK(blockerId,blockedId)
usage_counters  userId, day, kind, count   PK(userId,day,kind)   (comments/day, nudges, AI calls)
templates       id, slug, title, category, durationDays, tasksPerDay, planKey, published
```

Indexes on every foreign key and on `(challengeId, localDate)`, `(userId, updatedAt)`, `squads.inviteCode`, `squads.privacy, category`.

## 4. API (Hono, `/v1`, JSON, zod-validated, auth required unless noted)

- Auth: Better Auth mounted at `/api/auth/*` (Google, Apple ID-token sign-in from native, email OTP).
- `GET /v1/config` (public) → `{ minAppVersion, limits, features }`.
- Me: `GET/PATCH /v1/me`, `POST /v1/me/consent`, `POST /v1/me/plus-interest` (pilot waitlist when payments are off), `DELETE /v1/me`, `POST /v1/me/export` → R2 signed URL.
- **Sync:** `GET /v1/sync?since=<cursor>` → everything that changed for my squads since the cursor: squads, members, challenges (+ plan hash), plan_day_edits, announcements, today's and recent check-ins, reaction/comment counts, my streaks/badges, notifications. Returns `nextCursor`. **This is the main read path**; screens render from the local SQLite store.
- Squads: `POST /v1/squads`, `GET/PATCH/DELETE /v1/squads/:id`, `GET /v1/squads/:id/preview` (public-safe), `POST /v1/squads/join` `{code}` or `{squadId}`, `POST /v1/squads/:id/leave`, `GET /v1/squads/:id/requests`, `POST /v1/squads/:id/requests/:userId` `{approve}`, `PATCH /v1/squads/:id/members/:userId` `{role}`, `DELETE /v1/squads/:id/members/:userId`, `POST /v1/squads/:id/invite/rotate`, `PUT /v1/squads/:id/announcement`, `POST /v1/squads/:id/transfer`.
- Discover: `GET /v1/discover?category=&q=&cursor=`, `GET /v1/templates`, `GET /v1/templates/:slug` (plan JSON).
- Challenges: `POST /v1/squads/:id/challenges` `{plan, startDate}` (server re-validates with the shared parser, stores plan in R2), `GET /v1/challenges/:id/plan` (ETag; phones cache by planHash), `PUT /v1/challenges/:id/days/:n`, `POST /v1/challenges/:id/end`, `GET /v1/challenges/:id/export`.
- Check-ins: `PUT /v1/checkins/:id` (idempotent upsert keyed by client ULID; validates local date window), `GET /v1/checkins/:id`, reactions `PUT/DELETE /v1/checkins/:id/reactions/fire`, comments `GET/POST /v1/checkins/:id/comments`, `DELETE /v1/comments/:id`.
- `POST /v1/nudges` `{challengeId, toUserId}`.
- `GET /v1/challenges/:id/leaderboard?range=challenge|week`.
- `POST /v1/uploads/proof` → signed PUT URL to the Worker's `/files/*` proxy (Plus or Pro squad only; max 300 KB; image/jpeg|webp; the Worker enforces type and size, see DECISIONS E130).
- `PUT /v1/push-tokens`, `DELETE /v1/push-tokens/:token`.
- Safety: `POST /v1/reports`, `PUT/DELETE /v1/blocks/:userId`, `GET /v1/blocks`.
- Integrations: `PUT/DELETE /v1/integrations/:provider` (stores public handle only).
- `POST /webhooks/revenuecat` (no session; `Authorization` must equal `REVENUECAT_WEBHOOK_SECRET`; idempotent by event id).
- Admin: `GET /v1/admin/reports`, `POST /v1/admin/reports/:id` `{action: hide|suspend|dismiss}`; `/admin` static page.

Errors: `{ error: { code, message } }` with stable codes (`LIMIT_SQUADS_JOINED`, `LIMIT_SQUADS_OWNED`, `PLAN_INVALID`, `CHECKIN_WINDOW_CLOSED`, `RATE_LIMITED`, `FORBIDDEN`, ...). The app maps codes to friendly copy and to the paywall where relevant.

## 5. Cost & abuse rules (must be implemented)

1. **No realtime sockets** for free users. Board refreshes on app open, pull-to-refresh, after own actions, and when a push arrives. (Paid chat in v2 = Durable Objects with WebSocket hibernation — not now.)
2. **Delta sync** with cursors; phones never refetch whole boards.
3. **Reminders are local notifications** (expo-notifications scheduled on device): daily reminder, missed-day note (8 AM), streak at risk (10 PM, or 11 PM after a late reminder; streak of 3+), challenge starting (7 PM the day before, 8 AM on the day).
4. **Server pushes batched**: cron builds at most 2 digest pushes per user per day; nudges are the only immediate push.
5. **Photos**: Free never uploads. Plus compresses on device (expo-image-manipulator, max 1080 px, ~100 KB) and uploads through a short-lived signed Worker URL that enforces type and size (reads may use R2 presigned URLs); R2 lifecycle deletes.
6. **Images made on device** (share card, commitment card) with react-native-view-shot.
7. **Verification runs on the phone** using the user's public handles; the server never polls third-party APIs.
8. **AI costs SparkSquad nothing**: template recap → on-device (iOS Foundation Models via `@react-native-ai/apple` when available) → BYOK (phone calls provider directly; key in secure store; daily cap in settings).
9. **Data expiry**: comments 30/90 days, notifications 30 days, exports 1 day, roll-ups at challenge end.
10. **Hard caps**: 1 check-in per challenge per day, 20 comments/user/day, 1 nudge per pair per day, 100 members, 300 KB uploads, request rate limit per user and per IP (Workers Rate Limiting binding), plus the abuse caps in `HARD_CAPS` (sign-in codes per email, request body sizes, challenges/reports per user per day, announcements per squad per day, notifications per sync).

## 6. Offline & sync (mobile)
- Local SQLite mirrors what the user needs: my squads, members (light), active challenges, cached plan JSON by hash, check-ins for today/last 7 days, my history.
- **Outbox**: every write (check-in, reaction, comment, nudge) goes to an outbox table first with a client ULID, applied optimistically to the UI, then flushed (on connectivity, app foreground, after write). Server endpoints are idempotent.
- Conflict rule: last write wins per check-in; server returns the canonical row.

## 7. Time & dates
- Store the user's IANA timezone (from `expo-localization`), update on change.
- `localDate` computed on device; server accepts a check-in for `today` or `yesterday` in the user's timezone (±14 h tolerance for travel), rejects otherwise (`CHECKIN_WINDOW_CLOSED`).
- Day number = `localDate − challenge.startDate + 1`, clamped to 1..durationDays.
- All date math in `packages/shared/date.ts` with unit tests (DST-free IST, plus a DST zone test).

## 8. Verification (on device, `features/verify`)
- **GitHub**: `GET https://api.github.com/users/{handle}/events/public` → count PushEvent / contribution events for local date. Unauthenticated (60 req/h/IP is enough per phone).
- **LeetCode**: public GraphQL `https://leetcode.com/graphql` `recentAcSubmissionList(username, limit: 20)` → accepted submissions with timestamps on local date. **Unofficial; wrap in try/catch, cache, and fall back to manual** with a "Couldn't verify, mark manually" message.
- **Codeforces**: `https://codeforces.com/api/user.status?handle=…&from=1&count=50` → verdict OK on local date.
- **Steps**: Android `react-native-health-connect` (READ_STEPS permission, Health Connect app required), iOS HealthKit (`@kingstinct/react-native-healthkit`, stepCount). Config plugins + usage descriptions in `app.config.ts`.
- Verified values pre-fill the check-in sheet and set `verified` on submit. Never block a manual check-in.

## 9. BYOK AI (on device, `features/ai`)
- Providers: Gemini, OpenAI, Anthropic — plain `fetch` to each official REST API from the phone. Key in `expo-secure-store`, never sent to our server, never logged, never in analytics.
- Plan builder pipeline (mirrors openGym's coach): system prompt (from `05_PLAN_FORMAT.md`) → interview turns → when the model outputs a JSON block → `extractJson` → shared `parsePlan` → if invalid, send errors back **once** ("repair round") → if still invalid, show errors and offer the copy-prompt flow.
- Daily request cap (default 20) counted on device.
- Weekly recap: build a short stats summary locally; on-device model (iOS, if available) or BYOK rewrites it in 3 sentences; otherwise show the template text.

## 10. Security & privacy
- Every query scoped by membership (helper `requireMember(squadId, roles?)`). Never trust client role or limits.
- Blocked users: filter their check-ins/comments for the blocker in sync responses.
- Word filter (shared list, extendable) on names, notes, comments, announcements; reject with `CONTENT_NOT_ALLOWED`.
- PII minimum: email, name, username, timezone. No phone numbers. 18+ confirmation timestamp stored.
- DPDP readiness: export + delete, privacy notice, grievance contact in settings, breach procedure noted in SETUP.md.
- Secrets only in Wrangler secrets / EAS secrets; `.env.example` files committed, real `.env` ignored.
- Only the Better Auth endpoints the app uses are reachable (`lib/authGate.ts`); file URLs are signed with a key derived from, never equal to, `BETTER_AUTH_SECRET`; admin access needs a verified email; suspension revokes all sessions.
