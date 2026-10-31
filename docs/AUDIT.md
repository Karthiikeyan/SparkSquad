# SparkSquad final audit

Date: 31 October 2026. Scope: the five checks in the master prompt's Prompt 3. Method: every row and rule was read against the code (two independent read-through passes plus direct verification of each finding), then gaps were fixed and re-tested.

## Summary

| Check | Result |
| --- | --- |
| 1. Screens (docs/03_SCREENS.md) | All ~70 rows exist. **One serious bug found and fixed:** the check-in route (B4) was still the Phase 3 placeholder. 8 smaller gaps fixed. |
| 2. Product rules (spec §3–§4) | Every rule and tier limit is enforced on the server. 23 rules had no server test; all now have one (new `apps/api/test/rules.test.ts`). |
| 3. Cost rules (arch §5) and security (arch §10) | All pass. One Android permission tightened. |
| 4. Tests, typecheck, lint, prebuild | Green. Shared 127 tests, API 54 (was 31), mobile 199. Android prebuild and bundle OK; iOS config verified by introspection (iOS prebuild needs macOS). |
| 5. SETUP.md and env vars | SETUP.md covers all nine required sections. Every env var read anywhere in code is in SETUP.md and an example file (one was missing, now added). |

---

## 1. Screens

All rows in `docs/03_SCREENS.md` have an implementation; screens built on the shared `Screen` component get the offline banner automatically, and list/data screens have skeleton, empty (one sentence + action), error (+ retry) and offline states.

**Fixed**

| Row | Problem | Fix |
| --- | --- | --- |
| B4 Check-in sheet | `app/checkin/[challengeId].tsx` still rendered the Phase 3 "coming soon" placeholder. In Phase 5 the real route was written to `[challengeId].tsx.new` and the rename silently failed (PowerShell treats `[...]` as a wildcard), so the core check-in flow never shipped in a build. Tests covered the sheet component, not the route file. | Route now re-exports `CheckinSheetScreen`; stray `.new` file and the unused `FoundationTab` placeholder removed. Checked every route for other leftovers: none. |
| C8 Member profile | Spec asks for "streaks in this squad, badges"; only consistency and a local run were shown. | `GET /v1/squads/:id/members` now returns `streak` (this squad's challenge) and `badges` per member (`SquadMemberStatsDTO`), with a test that no private fields leak. Screen shows consistency, day streak, best streak and earned badges. |
| C5 Edit day | Past days and today were locked only on the server; a deep link opened an editable form. | Locked state shown for today and past days (`canEditDay`). |
| G3 Server/app error | No React error boundary; a render crash showed a red box / white screen. | Root `ErrorBoundary` (Expo Router) renders a calm full screen with retry and reports to Sentry. |
| G5 Permission denied | Photos and Health showed only a toast. | Both explain and offer "Open settings" (photos: app settings; steps: Health Connect / Apple Health). Notifications already did. |
| Offline (own-root screens) | Paywalls, AI builder and check-in sheet didn't show the offline banner. | Banner added; Start/purchase buttons disabled offline. Check-in sheet keeps working offline (outbox) and says it will sync. |
| F11 Billing | No error state for the subscription lookup. | "Couldn't load your subscription" row with retry. |

**Accepted as is**

- C6 route is `checkins/[id]` instead of `checkin/[id]` to avoid clashing with the B4 route `checkin/[challengeId]` (DECISIONS E114).
- C4 Plan relies on the squad screen's loading/error states (it is a segment of that screen, E69).
- C13 Share card and D11 Squad created render and share on the device, so they work offline without a banner.

## 2. Product rules and tier limits (spec §3–§4)

Every rule is enforced on the server; the client only mirrors them. Tests now cover each one:

| Rule | Enforced in | Test |
| --- | --- | --- |
| Squads joined 3 / 10, owned 1 / 5, expired Plus → Free | `services/access.ts` | `limits.test.ts` |
| Member limit, 100 hard cap | `routes/squads.ts`, `createSquadSchema` | `limits.test.ts`, `rules.test.ts` "capped at 100 members" |
| Approve-all needs room for everyone | `squads.ts` `decide` | `rules.test.ts` |
| Public join instant; private needs code + approval | `squads.ts` join | `auth.test.ts` |
| Removed member can't rejoin a public squad | `squads.ts` join | `rules.test.ts` |
| Roles: admins approve/remove members, only owner removes admins, changes roles, rotates invite, edits settings, deletes | `squads.ts` | `rules.test.ts` "admins approve requests…", `auth.test.ts` |
| Announcements: owner/admin, ≤500 chars, word filter | `squads.ts` | `rules.test.ts` |
| Owner must transfer before leaving | `squads.ts` leave | `limits.test.ts` |
| One active challenge; created by owner/admin; plan valid | `routes/challenges.ts` | `rules.test.ts`, `limits.test.ts` |
| Only future days editable, by owner/admin | `challenges.ts` days | `rules.test.ts` |
| Check-in window today/yesterday (±14 h), inside the challenge | `routes/checkins.ts`, shared `date.ts` | `checkins.test.ts`, shared `date.test.ts` |
| One check-in per challenge per day (idempotent upsert) | `checkins.ts` + unique key | `checkins.test.ts` |
| Notes ≤280, filtered | `upsertCheckinSchema`, `assertClean` | `rules.test.ts`, `checkins.test.ts` |
| Honest miss | `checkins.ts` | `checkins.test.ts` |
| Partial counts only when the squad allows it | `checkins.ts` `countsAsDone` | `rules.test.ts` |
| Personal targets only when the squad allows them | `checkins.ts` | `rules.test.ts` |
| Streaks, backfill keeps the streak | `services/streaks.ts` | `checkins.test.ts` |
| Freezes: 1 per 7 days, banked 2 Free / 5 Plus | `streaks.ts` (`TIER_LIMITS.freezesBanked`) | `rules.test.ts` "banks freezes up to the tier cap" |
| Badges (first check-in, streaks, challenge complete) | `streaks.ts`, `cron/rollup.ts` | `rules.test.ts`, `cron.test.ts` |
| Leaderboard maths | `services/leaderboard.ts` | `sync.test.ts` |
| Comments ≤140, filtered, 20/day | `checkins.ts` | `rules.test.ts`, `checkins.test.ts` |
| Comment retention 30 Free / 90 Plus or Squad Pro | `checkins.ts`, `cron/hourly.ts` | `rules.test.ts`, `cron.test.ts` |
| Nudge once per pair per day, not after check-in | `routes/misc.ts` | `checkins.test.ts` |
| Photo upload Plus / Squad Pro only; 30 / 90-day prefixes; 300 KB cap | `misc.ts`, `routes/public.ts` | `checkins.test.ts`, `rules.test.ts` |
| Squad Pro per squad (webhook `squad_id`) | `routes/webhooks.ts` | `sync.test.ts` |
| 18+ and terms consent before use | `lib/http.ts`, `me.ts` | `auth.test.ts` |
| Plus interest recorded while payments are off | `me.ts` | `rules.test.ts` |
| Export (1-day link) and account deletion | `me.ts` | `rules.test.ts` |
| AI builder Plus-only | Client gate on the D8 screen (`limitsFor(plan).aiBuilder`): BYOK runs entirely on the phone, so the server has nothing to protect (E81) | Not server-testable by design |

## 3. Architecture §5 cost rules and §10 security

| Rule | Status |
| --- | --- |
| 5.1 No realtime sockets | Pass: no WebSocket / Durable Object code; board refreshes on open, pull, own actions and push. |
| 5.2 Delta sync with cursors | Pass (`sync.test.ts`). |
| 5.3 Reminders are local notifications | Pass (`features/reminders`). |
| 5.4 Server pushes ≤2 digests/user/day; nudges only immediate push | Pass, now tested (`rules.test.ts`). |
| 5.5 Photos: Free never uploads; Plus compresses (≤1080 px, ~100 KB) and uploads via presigned URL; R2 lifecycle | Pass (E98; lifecycle rules in SETUP.md §3.1). |
| 5.6 Images made on device | Pass (view-shot share card). |
| 5.7 Verification on the phone; server never polls third parties | Pass: the API's only outbound calls are Resend and Expo push. |
| 5.8 AI costs nothing (template → on-device → BYOK, daily cap) | Pass (E90, E100). |
| 5.9 Data expiry (comments, notifications, exports, roll-ups) | Pass (`cron.test.ts`, R2 lifecycle for exports). |
| 5.10 Hard caps and per-user/per-IP rate limits | Pass, all tested (rate limit now tested with a failing limiter → 429). |
| 10 Membership scoping | Pass (`requireMember`, `auth.test.ts`). |
| 10 Blocked users filtered | Pass: sync, members, Discover, comments (comments now tested). |
| 10 Word filter on names, notes, comments, announcements | Pass, all tested. |
| 10 PII minimum, 18+ timestamp | Pass. |
| 10 DPDP: export, delete, privacy notice, grievance contact, breach procedure | Pass (Help & contact; SETUP.md §10). |
| 10 Secrets only in Wrangler/EAS; `.env` ignored | Pass (`.gitignore` covers `.env`, `.dev.vars`; BYOK keys only in secure store; Sentry scrubs). |

Fixed: Android release manifest carried `SYSTEM_ALERT_WINDOW` (added by the React Native template); now blocked in `app.config.ts`. Verified with `expo prebuild` that it is removed along with audio/video media permissions.

## 4. Builds and checks

- `pnpm typecheck`, `pnpm lint` (ESLint + Prettier): clean.
- `pnpm test`: shared 9 files / 127 tests, API 6 files / 54 tests, mobile 32 suites / 199 tests.
- `npx expo prebuild --platform android --no-install`: succeeds; manifest has READ_STEPS, the Health Connect rationale activity, minSdk 26, `sparksquad` scheme; unused permissions removed. Generated folder deleted (it is git-ignored).
- iOS prebuild cannot run on Windows; `expo config --type introspect` confirms the HealthKit and Sign in with Apple entitlements and the HealthKit usage text.
- `expo install --check`: dependencies match SDK 58. `npx expo export` bundles Android (and iOS in Phase 9).
- `eas.json`: development, development-device, preview and production profiles with matching channels. `eas build` itself needs your Expo login (below).

## 5. SETUP.md and environment variables

- SETUP.md has all nine sections from the master prompt (prerequisites, full env table, account setup for every service including RevenueCat as "Later", local run, deploy, store checklists, templates/admins/moderation, costs, ten troubleshooting entries) plus the DPDP breach procedure.
- A script compared every `process.env.*` read in the mobile app, app config and scripts, and every field of the API `Bindings` type, against SETUP.md and the example files. All 42 names are covered. Fixed: `D1_DATABASE_NAME` (seed script override) was undocumented; `apps/api/.env.example` now lists every non-secret var.

---

## What still needs you

1. **Accounts and secrets**: Cloudflare, Google Cloud, Apple Developer, Resend, Expo, and later RevenueCat; fill in the variables in SETUP.md §2.
2. **Real-device testing** with development builds: sign-in (Google, Apple, email), push, the check-in flow end to end (B4 never ran in a build before this audit), Health Connect / HealthKit, on-device AI on a supported iPhone, Plus photo upload, share/save, and RevenueCat sandbox purchases.
3. **EAS**: `eas init` and a first `eas build` (needs your login); iOS prebuild on a Mac or in EAS.
4. **Brand art**: replace the placeholder spark icon and splash before store submission.
5. **Store paperwork**: Play closed test (12 testers / 14 days), data safety and health declarations; App Store privacy labels and review notes (SETUP.md §6).
6. **Optional**: a custom domain for universal links (D5); turning on the light theme (D6).
