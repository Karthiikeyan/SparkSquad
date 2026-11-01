# Progress

## Phases

- [x] 0. Scaffold (pnpm + Turborepo monorepo, Expo app, Hono Worker, shared package, ESLint/Prettier, CI, env examples)
- [x] 1. packages/shared (schemas, limits, dates, scoring/streaks, word filter, plan module + tests)
- [x] 2. apps/api (Drizzle schema + migrations, Better Auth, all endpoints, sync, R2, webhooks, push, cron, moderation, admin, seeding, integration tests)
- [x] 3. apps/mobile foundation (tokens, fonts, components, navigation, API client, Query, SQLite + outbox, banners, toasts, i18n, analytics)
- [x] 4. Auth and onboarding A1–A10 + invite deep links
- [x] 5. Core loop B1–B8, reminders, push
- [x] 6. Squads C1–C15
- [x] 7. Create and join D1–D11, E1–E4
- [x] 8. You and settings F1–F16, weekly recap
- [x] 9. Polish and hardening
- [x] 10. Documentation (SETUP.md, README, final PROGRESS/DECISIONS)

## Log

### Phase 0 — done

- Build kit moved from `sparksquad-build-kit/` to the repo root (docs, design, .github, MASTER_PROMPT.md).
- pnpm 12 workspace (`nodeLinker: hoisted` for React Native), Turborepo tasks `dev/build/lint/typecheck/test`.
- `apps/mobile`: Expo SDK 58 from the official template, stripped to Expo Router at `app/`, NativeWind 4 + Tailwind 3 with design tokens in `src/theme/colors.js`, `app.config.ts` reading env, Jest (jest-expo).
- `apps/api`: Hono Worker, `wrangler.toml` with D1 (`DB`), R2 (`BUCKET`), rate limit bindings (`USER_LIMITER`, `IP_LIMITER`), hourly cron, static assets for `/admin`; Vitest with `@cloudflare/vitest-plugin`.
- `packages/shared`: TypeScript source package, Vitest with v8 coverage thresholds (90%).
- GitHub Actions CI: install, lint (ESLint + Prettier), typecheck, test.

### Phase 1 — done

- `packages/shared/src`: `limits.ts` (only place for tier numbers), `errors.ts` (stable codes), `ids.ts` (ULID, invite codes), `date.ts` (local dates, day numbers, check-in window ±14 h), `scoring.ts` (status, partial rule, consistency, leaderboard ranking), `streaks.ts` (streaks, freezes, badges), `wordFilter.ts`, `schemas.ts` (zod for every API payload), `types.ts` (wire DTOs incl. `SyncResponse`).
- Plan module `src/plan/`: schema, `extractJson`, `parsePlan` (fixes + stats, never throws), `parsePlanDay`, `exportPlan`, `mergeDayEdits`, `planHash` (pure SHA-256 over canonical JSON so phone and Worker match), `buildPrompt`, `buildRepairMessage`.
- Templates: `templates/build.mjs` generates `dsa-30`, `dsa-60`, `aptitude-21`, `sql-30`, `steps-10k`, `system-design-30`; a test asserts each parses with zero fixes and is in canonical export form.
- 127 tests, coverage 99% lines / 96% branches.

**Next:** Phase 2 — API.

**Known issues:** none.

### Phase 2 — done

- Drizzle schema for the full data model (`apps/api/src/db/schema.ts`) + migration `0000_init.sql`; Better Auth tables extended with profile columns.
- Better Auth (`src/auth.ts`): Expo plugin, Google + Apple ID-token sign-in (enabled only when keys exist), email OTP via Resend (hashed OTPs; codes captured in tests/dev without a key).
- Endpoints (Architecture §4): config, me (profile, username check, consent, plus-interest, export, delete), sync (cursor deltas), squads (CRUD, join by code/id, requests, roles, remove, rotate invite, announcement, transfer, members with consistency, history), discover/templates, challenges (create with server re-parse, plan with ETag, day edits locked for past/today, end, export, leaderboard), check-ins (idempotent upsert, window, personal targets, status, streaks, badges), reactions, comments (20/day, expiry), nudges (1/pair/day + immediate push), proof uploads (Plus/Pro only, presigned R2 or HMAC Worker URLs), push tokens, reports, blocks, integrations, notifications read, RevenueCat webhook, admin reports + `/admin` page, `/join/CODE` landing page.
- Rate limiting per IP and per user via Workers Rate Limiting bindings; stable error codes; word filter; 18+ consent gate on writes; `x-app-version` → `APP_UPDATE_REQUIRED`.
- Hourly cron: streak settlement + freeze notices (local 01:00), morning inbox digest (09:00), evening squad digest (18:00), max 2 digest pushes/user/day, challenge end roll-ups + "Challenge complete" badges, expiry of comments/notifications/counters/nudges/photo keys/old raw check-ins/sessions.
- `pnpm seed:templates [-- --remote]` uploads templates to R2 and upserts the `templates` table.
- 31 integration tests (auth guards, limits, check-in idempotency + window, streaks, reactions/comments caps, nudges, uploads, sync deltas, blocks, leaderboard maths, webhook, cron, pages).

**Next:** Phase 3 — mobile foundation.

**Known issues:** none.

**Notes for the next session:** design files read so far: Main, CheckIn, Welcome, Squad, Leaderboard, Plan. Read the rest (CreateSquad, ImportPlan, AIPrompt, AIBuild, Discover, Profile, Plus, Settings, ShareCard) before building those screens. The mobile app currently has only the Expo Router shell (`app/_layout.tsx`, `app/index.tsx`), NativeWind and colour tokens; Phase 3 adds everything else. API contract for the app: zod schemas in `packages/shared/src/schemas.ts`, response types in `packages/shared/src/types.ts`, routes in `apps/api/src/index.ts`.

### Phase 3 — done

- Theme: `src/theme/colors.js` (+ extra neutrals from the designs), typed `tokens.ts` (colours, avatar palette + id hash, radii, sizes, type scale, motion), `fonts.ts` (Bricolage Grotesque 500–700, Inter 400–600, per-weight imports).
- UI kit `src/components/ui` (barrel `index.ts`): Text, Pressable (0.98 press scale, reduced motion aware), Button (primary/secondary/soft/ghost/destructive × lg/md/sm), IconButton, Card, GroupedList/ListRow/SectionLabel/GroupFooter, SegmentedControl (tabs or radios, Settings tone), ChipToggle, Stepper, Switch, TextField/TextArea with counter, SearchField, Avatar (initials, ring, dimmed), AvatarRing (row/grid), TaskRow, DayStrip, ProgressBar, PhaseBar, StatTile, Heatmap, Badge, BottomSheet, TabBar, NavHeader, Toast (provider + `useToast`), EmptyState, ErrorState, Skeleton/SkeletonCard, OfflineBanner, Screen (safe area, large title, offline banner, pull-to-refresh, footer).
- Navigation: root Stack (`app/_layout.tsx`: fonts + splash + providers), `(tabs)` with the custom tab bar (centre Check-in button), `checkin/[challengeId]` transparent modal stub, tab roots with loading/empty/error/offline states reading the local store.
- Data: `lib/api` (fetch client with session cookie from the Better Auth Expo client, `x-app-version`, 20 s timeout, stable error codes → `ApiError`/`NetworkError`, friendly copy, paywall detection, typed endpoints), `lib/auth.ts` (Better Auth + Expo plugin + email OTP client, cookies in SecureStore), `lib/prefs.ts` (MMKV), `lib/env.ts`.
- Offline store: expo-sqlite + Drizzle schema (`lib/db/schema.ts`), migrations, write lock + transactions, `lib/sync` (delta-sync applier with removals, pending-row protection, blocks, pruning; single-flight engine with cursor), `lib/outbox` (FIFO queue with coalescing, backoff, permanent-failure revert; handlers for check-in, fire, comment, nudge), `lib/runtime.ts` (opens DB, refresh on foreground and reconnect, flush after writes).
- TanStack Query client (offline-first, retries only retryable errors), NetInfo/AppState managers, query keys, `useLocalQuery`.
- Force-update gate (G2) from `/v1/config` and `APP_UPDATE_REQUIRED`; runtime failure screen (G3); toasts (G4); offline banner (G1).
- i18n: `src/i18n/en.json` + typed `t()`; copy for every API error code.
- Analytics: PostHog + Sentry behind env flags with privacy scrubbing.
- 65 mobile tests (Jest + RNTL 14): API client/errors, i18n, analytics scrubbing, store (sync applier, engine, outbox, handlers on real SQLite), UI components and accessibility roles. `expo export --platform android` bundles cleanly.

**Next:** Phase 4 — auth and onboarding A1–A10 + invite deep links.

**Known issues:** none.

**Notes for the next session:** design files read so far: Main, CheckIn, Welcome, Squad, Leaderboard, Plan, Discover, Profile, Settings. Read the rest (CreateSquad, ImportPlan, AIPrompt, AIBuild, Plus, ShareCard) before building those screens. `app/index.tsx` currently redirects to Today; Phase 4 replaces it with session-aware routing (`authClient.useSession()`, consent/profile gating) and should handle `appEvents` `unauthorized` (sign out → `clearLocalData()` → welcome). `api` endpoints live in `src/lib/api/endpoints.ts`; add new ones there. Local reads go through `useLocalQuery` with keys under `qk.local`; writes go through `getRuntime().outbox.enqueue(...)` after an optimistic local write. Tab roots use `FoundationTab` until their phase replaces them.

### Phase 4 — done

- Session: `src/features/auth/SessionProvider.tsx` (Better Auth session + `me` query seeded from the local store, per-user onboarding flag, account-switch wipe, timezone sync, push-token registration, sign-out on 401, pending invite/route), `routing.ts` (pure `resolveRoute`, validation helpers), `signIn.ts` (native Google + Apple ID-token sign-in, email OTP send/verify).
- Navigation: `src/components/RootNavigator.tsx` with `Stack.Protected` groups; `app/index.tsx` is the single routing decision point (A1).
- Screens: A2 Welcome (squad ring, providers shown per config, 18+/terms line), A3 email, A4 code (6 boxes, paste/autofill, 30 s resend), A5 consent (two checkboxes, zero-tolerance note), A6 profile (name, username availability check, 12-colour picker, preview), A7 interests, A8 reminder time (native pickers), A9 notifications prime (permission + push token, settings fallback when denied), A10 join or create; E3 squad preview (join / request / pending / member), E4 join with code; F16 Terms and Privacy pages; D1 placeholder for "Start a squad".
- Invite deep links: `sparksquad://join/CODE` → stored while signed out → after onboarding (A9 skips A10) → `invite/[code]` preview.
- Native config plugins: Google Sign-In (iOS URL scheme from `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`), Apple authentication, notifications, datetimepicker.
- 91 mobile tests (routing, validation, OTP paste, consent gate, join-code flow, A9 invite skip, join actions, time helpers, prefs). Android bundle builds.

**Next:** Phase 5 — core loop B1–B8, reminders, push.

**Known issues:**
- Paywall routes (F9/F10) don't exist yet; limit errors (`LIMIT_SQUADS_JOINED`) show a toast until Phase 8.
- Native sign-in, push and pickers need a development build (`expo run:android` / EAS); they can't run in Expo Go.

**Notes for the next session:** design files read so far: Main, CheckIn, Welcome, Squad, Leaderboard, Plan, Discover, Profile, Settings. Read the rest (CreateSquad, ImportPlan, AIPrompt, AIBuild, Plus, ShareCard) before building those screens. Signed-in screens get the user from `useMe()` and session helpers from `useSession()`. Add routes for new signed-in screens inside the `ready` guard in `src/components/RootNavigator.tsx`. `api` endpoints live in `src/lib/api/endpoints.ts`. Local reads go through `useLocalQuery` with keys under `qk.local`; writes go through `getRuntime().outbox.enqueue(...)` after an optimistic local write (see `upsertCheckinRow(..., 1)`). Reminder time is in `me.reminderTime` and MMKV `reminderTime`; Phase 5 schedules the local notification (`src/lib/notifications.ts` already handles permission). Tab roots still use `FoundationTab` until their phase replaces them.

### Phase 5 — done

- Plans: `src/lib/plans.ts` caches plan JSON by hash after each sync and overlays day edits (`effectiveDay`).
- Today (B1–B3, B6, B7): `src/features/today/` — `model.ts` (pure `buildTodayCards`: active/upcoming/finished, plan loading, day number, effective day, squad ring, my check-in + sync state, steps variant, backfill offer, sort; `pendingCards`, `predictedStreak`), `source.ts` (one local read), `ChallengeCard.tsx` (tasks with draft ticks and "Check in (n of m done)", B3 collapsed card with time / edit / sync clock / squad progress, rest day, steps card, upcoming, backfill banner), `HeaderActions.tsx` (streak pill, bell with unread dot), `TodayScreen.tsx` (loading/empty/error/offline, freeze sheet).
- Check-in (B4, B5): `src/features/checkin/` — `CheckinSheet.tsx` (challenge picker when several are pending, steppers/switches, note with counter, device-only photo, honest miss, edits until midnight tomorrow, backfill title), `submit.ts` (optimistic pending row + outbox), `drafts.ts`, `localProof.ts`, `SuccessScreen.tsx` (animated squad ring, haptic, streak, badges, offline note).
- Inbox (B8): `src/features/notifications/` — copy per kind, Today/Earlier groups, unread dots, mark one/all read.
- Reminders: `src/features/reminders/` (pure 7-day planner + morning missed-day note, native scheduler); Push: `src/features/push/AppBackground.tsx` (foreground display, refresh on receive, tap routing, cold start).
- Routes: `checkin/[challengeId]` (sheet, `next` = first pending), `checkin/success`, `notifications`; the centre tab button opens the sheet.
- 124 mobile tests (card model, submit/drafts, plan cache, reminders planner, inbox copy/grouping/freeze notice, task text, card rendering for B1/B3/B7/upcoming). Android bundle builds.

**Next:** Phase 6 — Squads C1–C15.

**Known issues:**
- Share card button on the success screen arrives with C13 (Phase 6).
- Tapping a card header goes to the Squads tab until the squad board exists (Phase 6).
- Verified task labels and pre-filled values need integrations (Phase 8); steps are entered by hand until then.
- Plus photo upload (presigned R2) is deferred to the billing phase; free device-only proof works.
- Paywall routes (F9/F10) don't exist yet; limit errors show a toast until Phase 8.
- Native sign-in, push, pickers and photos need a development build.

**Notes for the next session:** read `design/Squad.dc.html`, `Leaderboard.dc.html`, `Plan.dc.html`, `ShareCard.dc.html` before Phase 6. Squad board data: local `members`, `checkins` (14 days of others), `nudges`, `announcements`; reactions/comments/nudges go through the outbox kinds that already exist (`fire`, `comment`, `nudge`). Update `notificationRoute`/`routeForNotification` and the Today card's `onOpenSquad` to the new `squad/[id]` route. Add the share card button to `SuccessScreen.tsx`.

### Phase 6 — done

- Data: `src/features/squads/` — `source.ts` (one local read per squad), `model.ts` (board, member grid order, still-to-check-in with nudge state, feed with tasks done, current runs, rest-day checker, plan strip with neutral `past`, phases, milestones, editable days), `actions.ts` (optimistic fire + nudge through the outbox, comment counts, sync after admin actions), `checkinContext.ts`.
- Screens (`src/features/squads/screens/`): C1 My squads (count rings, start/join, requests to review), C2–C4 squad screen with Board / Leaderboard / Plan segments, announcement banner, WhatsApp/Telegram button, share and settings icons; C5 Edit day (title, review day, tasks with type/target/unit/auto-check/link, reorder, add, remove); C6 Check-in detail (tasks, note, photo or "proof on their phone", fire, comments with delete/report, expiry note, offline queueing, report/block menu); C7 Members (roles, joined, consistency, make admin/member, remove, report, block); C8 Member profile; C9 Join requests (approve/decline/approve all); C10 Invite (code, copy, share, QR, rotate); C11 Squad settings (details form, manage rows, past challenges, transfer, end challenge, delete, leave, report) with C12 announcement sheet; C13 Share card (view-shot, share, save, copy link); C14 Past challenge summary; C15 Report sheet (`src/features/safety/ReportSheet.tsx`) + block confirm.
- Cross-links: Today card header → squad, success screen "Share card", inbox and push taps open squad / requests / history.
- New UI: `CountRing`; DayStrip `past` state and `columns` padding.
- 139 mobile tests (board, runs, strip, phases, fire/nudge on SQLite, member permissions, leaderboard ties, edit-day payloads, settings diff, share streak line, notification routes, board rendering). Android bundle builds.

**Next:** Phase 7 — Create and join D1–D11, E1–E4 (E3/E4 already built in Phase 4).

**Known issues:**
- `create/basics` is still a placeholder (Phase 7); owners of a squad without a challenge can't add one until then.
- Verified task labels/pre-fill need integrations (Phase 8); Plus photo upload and paywalls are Phase 8.
- Native features (sign-in, push, pickers, photos, share/save, QR) need a development build.

**Notes for the next session:** read `design/CreateSquad.dc.html`, `ImportPlan.dc.html`, `AIPrompt.dc.html`, `AIBuild.dc.html`, `Discover.dc.html` before Phase 7. Create flow: `POST /v1/squads` (createSquadSchema), then `POST /v1/squads/:id/challenges` `{plan, startDate, templateSlug?}`; templates via `GET /v1/templates` and `/v1/templates/:slug`; Discover via `GET /v1/discover`. Plan parsing/preview uses shared `parsePlan`, `planStats`, `buildPrompt`, `extractJson`. Reuse `SquadPreview` (E3) from Discover with `{ squadId }`. Add the "Set up a plan" entry point for squads with no challenge (Board empty state + settings).

### Phase 7 — done

- Create flow (`src/features/create/`): `flow.tsx` (draft context per `create/` stack, next-Monday default start, 90-day clamp, blank-plan builder, next-step routing), `components.tsx` (step header with 3-segment bar, start-date row with native pickers, plan preview card with stats / "n items were fixed" / first days / see all).
- Screens: D1 basics (name, description, category, privacy, member limit, chat link, own-limit check), D2 plan source (template / import / AI prompt (Free) / in-app builder (Plus) / blank), D3 templates grid, D4 template detail, D5/D6 import (paste, file picker, preview, error with copy-prompt), D7 build with your AI (goal, prompt preview, copy, ChatGPT / Gemini / Claude, paste reply), D8 in-app builder (BYOK chat, quick replies, progress, one repair round, daily cap, Plus and no-key states), D9 blank builder (length presets, days per week, default tasks), D10 review (creates squad, then challenge), D11 done (invite card).
- BYOK: `src/lib/aiKeys.ts` (secure store), `src/features/ai/` (provider requests, reply parsing, quick replies, daily cap); F6 Settings › AI (`settings/ai`).
- Discover: E1 (search entry, category chips, squads starting soon with Join → preview, templates grid, start a squad, load more) and E2 search (debounced, squads + templates, recent searches).
- Shared task editor (`src/features/plan/TaskEditor.tsx`) used by C5 and D9; "Set up a plan" entry for squads without a challenge (board + settings).
- Fixed 32 i18n strings whose punctuation had been mangled; added a regression test.
- 155 mobile tests (AI requests/errors/replies/cap, flow helpers, blank plans, discover sorting/meta/recent, import paste → preview → next step, import error, plan source options). Android bundle builds.

**Next:** Phase 8 — You and settings F1–F16 (F6 already done), weekly recap.

**Known issues:**
- Paywalls (F9/F10) still missing: Plus-gated and limit states explain the limit instead of opening a paywall.
- Verified task values and Plus photo upload are Phase 8.
- On-device AI (iOS Foundation Models) isn't wired; Settings › AI shows "Not on this phone".
- Native features need a development build.

**Notes for the next session:** read `design/Profile.dc.html`, `Settings.dc.html` (F5), `Plus.dc.html` before Phase 8. Profile stats: global streak in local `streaks`, my check-ins (kept locally without pruning) for the heatmap and "days shown up", `badges` table, `shared/streaks.ts` `badgeProgress`. Settings rows link to `settings/ai` (done), integrations, notifications (`me.notify*` via PATCH /v1/me, reminder time also MMKV), billing, blocked (`GET /v1/blocks`), export (`POST /v1/me/export`), delete (`DELETE /v1/me`), help, legal (`settings/legal/[doc]` exists). Paywall: `PAYMENTS_ENABLED=false` → "Plus is coming soon. Get notified" → `POST /v1/me/plus-interest`. Verification (Architecture §8) lives in `features/verify` and pre-fills the check-in sheet.

### Phase 8 — done

- You (`src/features/you/`): F1 profile (header with settings button, day streak / best streak / days shown up, 18-week heatmap, badges strip with "n days to go", plan row, weekly recap card, links), F2 edit profile (name, username check, colour), F3 badges (earned with date, locked with progress), F4 history (month calendar with heat levels, tap a day for its check-ins).
- Weekly recap: template from this week’s local stats; Plus + BYOK key can rewrite it with AI.
- Settings (`src/features/settings/`): F5 hub (AI key, reminders, squad updates switch, integrations, plan, blocked, export, delete, help, about, version, sign out), F7 integrations (GitHub / LeetCode / Codeforces handles checked by a live lookup, steps note), F8 notifications (reminder time, three switches, OS-permission banner), F12 blocked people, F13 export (download + share sheet), F14 delete account (type DELETE, owner warning), F15 help (FAQ, email, guidelines), F16 legal now includes licences and guidelines.
- Verification (`src/features/verify/`): on-device GitHub / LeetCode / Codeforces checks pre-fill the check-in sheet, show "Verified from your X activity" and send `verified` indices.
- Billing (`src/features/billing/`): F9 Plus paywall (Free vs Plus from limits, yearly/monthly, start, restore, Squad Pro link), F10 Squad Pro (pick an owned squad), F11 plan & billing (plan, renewal, manage in store, restore). Payments off: config prices and "Get notified" (`POST /v1/me/plus-interest`). Payments on: RevenueCat offerings, purchase (`squad_id` attribute for Pro), restore, `/v1/me` polling. Limit errors open the paywall.
- API: `/v1/config` returns display `prices` from `PRICE_*` vars.
- 191 mobile tests (heatmap/recap/badges/calendar, local profile source, verifiers with fake fetch, pre-fill and caching, verified indices on submit, paywall prices and comparison, paywall screen with payments off, delete and handle rules). Android bundle builds.

**Next:** Phase 9 — polish and hardening.

**Known issues:**
- Steps verification (Health Connect / HealthKit) isn’t wired; step tasks are entered by hand.
- Plus photo upload (presigned R2) isn’t wired; photos stay on the phone for everyone.
- On-device AI (iOS Foundation Models) isn’t wired; the recap rewrite needs a BYOK key.
- History and heatmap only cover check-ins on this phone (the first sync returns the last 7 days).
- RevenueCat purchases are untested against real store products (payments are off for the pilot).
- Native features need a development build.

**Notes for the next session:** Phase 9 candidates: Plus photo upload (`POST /v1/uploads/proof` presign, compress to ≤300 KB JPEG/WebP, upload in the check-in outbox handler before the upsert, send `photoKey`), steps via `react-native-health-connect` / `@kingstinct/react-native-healthkit` (config plugins in `app.config.ts`), on-device recap where available, an accessibility and empty/offline-state pass over every screen, a full history backfill endpoint or paging if needed, and a review of performance (UI kit import cost in tests is ~7 s).

### Phase 9 — done

- Plus / Squad Pro photo proof upload: on-device compression, presigned R2 PUT from the outbox, `photoKey` on the check-in; Free photos still never leave the phone.
- Steps verification: Health Connect (Android) and Apple Health (iOS), connected from Settings › Connected accounts, pre-filling step tasks with "Verified from your … activity".
- On-device AI (iOS Foundation Models) for the weekly recap rewrite, falling back to the BYOK key; Settings › AI shows its status.
- Light theme tokens wired (dark default, behind `EXPO_PUBLIC_LIGHT_THEME` per D6) with a contrast-checked light palette; pickers, status bar and native UI follow the theme.
- Accessibility pass: Switch respects reduced motion, chips grow with Dynamic Type (1.3×) and reach 44 pt touch targets, missing loading / error states added (member profile, integrations, billing).
- Performance: FlashList via a new `SectionedList` for the inbox and members.
- EAS config (`eas.json` with development / preview / production), `expo-updates`, runtime version and channels; brand placeholder icons and splash; Health Connect / HealthKit config plugins and usage text; unused media permissions blocked; Expo SDK patch updates applied.
- Security review against Architecture §10 (E108).
- 199 mobile tests (photo upload, outbox photo path, steps pre-fill, day bounds, theme resolution, sectioned list). Android and iOS bundles build; `expo install --check` clean.

**Next:** Phase 10 — documentation (SETUP.md, README, final PROGRESS/DECISIONS).

**Known issues:**
- Native features (sign-in, push, purchases, Health Connect / HealthKit, on-device AI, photo upload, share/save) need a development build and real devices to verify; none were run on hardware in this environment.
- History and heatmap only cover check-ins on this phone (the first sync returns the last 7 days).
- RevenueCat purchases are untested against real store products (payments are off for the pilot).
- Brand icons are placeholders.

**Notes for the next session:** SETUP.md must list every env var: mobile `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_PAYMENTS_ENABLED`, `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`, `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST`, `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_IOS_STORE_URL`, `EXPO_PUBLIC_LIGHT_THEME`, `EAS_PROJECT_ID`, `APP_VARIANT`; api vars and secrets from `apps/api/src/env.ts` and `wrangler.toml` (including `PRICE_*`, `REVENUECAT_WEBHOOK_SECRET`, `ADMIN_EMAILS`). RevenueCat names: offerings `plus` and `squad_pro` (annual + monthly packages), entitlements `plus` and `squad_pro`, subscriber attribute `squad_id`. Health: Play Console health permissions declaration for READ_STEPS; HealthKit capability. Follow the SETUP.md spec in the master prompt (sections 1–9), including the breach procedure (DPDP).

### Phase 10 — done

- `SETUP.md`: prerequisites with versions; every environment variable and secret (mobile, API vars, API secrets) with where to get it and where it goes; step-by-step Cloudflare (D1, R2 + lifecycle rules, R2 token, rate limiting, cron, secrets, deploy, optional domain), Better Auth, Google, Apple (including client-secret generation), Resend, Expo/EAS (FCM v1, APNs, channels), RevenueCat (Later), PostHog/Sentry, Health Connect/HealthKit; running locally; deploying the API, EAS builds and EAS Update; Play Console and App Store checklists; templates, admins and moderation; costs and when to move to Workers Paid; troubleshooting for the ten most likely errors; the DPDP breach procedure.
- `README.md` rewritten: what v1 does, repository layout, quick start, scripts, links to all docs.
- Analytics opt-out switch wired (E109).

## Status

All phases 0–10 are done. Typecheck, lint and tests are green; Android and iOS bundles build.

**Still needs you (accounts and devices):**
- Create the Cloudflare, Google, Apple, Resend, Expo and (later) RevenueCat accounts and fill in the variables in SETUP.md §2.
- Make development builds and test on real phones: sign-in, push, Health Connect/HealthKit, on-device AI, photo upload, purchases. None of these were run on hardware in the build environment.
- Replace the placeholder spark icon with final brand art before store submission.
- Optional: buy a domain for universal links (D5).

**Known limitations:**
- History and heatmap only cover check-ins stored on the phone (the first sync returns the last 7 days).
- Light theme is wired but hidden until `EXPO_PUBLIC_LIGHT_THEME=true` (D6).
- RevenueCat purchases are untested against real store products.

Final audit done: see `docs/AUDIT.md`.

### Final audit — done

Results in `docs/AUDIT.md`. Fixed the check-in sheet route (B4) that still rendered the Phase 3 placeholder, member profile streaks and badges (C8, new API fields), the edit-day lock (C5), a root error boundary (G3), permission-denied states with "Open settings" (G5), offline banners on paywalls / AI builder / check-in sheet, billing error state, an Android overlay permission, and the last undocumented env var. Added 23 server tests for product rules (API 54 tests). All checks green.

### Security audit and fixes — done

Ran Cloudflare's `security-audit` skill (github.com/cloudflare/security-audit-skill; installed copy verified byte-identical to upstream) in full-audit mode, standard profile: reconnaissance, 8 hunter waves over 41 coverage units, coverage critics to two clean passes, a fresh verifier per candidate, schema-validated `findings.json`, then fresh record verifiers. The audit itself was source-only (no OS sandbox on the Windows host), so results are `needs_validation` leads rather than confirmed findings; reports are in `~/security-audit-skill/sparksquad/run-1` (REPORT.md, NEEDS-VALIDATION.md).

Fixed all 37 leads (DECISIONS E129–E142): R2 file-token key reuse/expiry/key escape and safe `/files` responses; Better Auth endpoint allowlist, per-email OTP limits, verified-only account linking and admin, production `APP_ENV` default, session revocation on suspend; RevenueCat ordering/sandbox/transfer/Squad Pro binding; sync leaks (hidden squads, pending members, tombstones, blocked notifications); block checks on joins; tier limits on transfer, deletion and races; withdraw-request; body-size and per-day caps; chunked D1 lists; byte-bounded plan cache; linear fence parsing; local drafts/photos cleared on sign-out. New migration `0002_entitlement_ordering`.

Tests: `apps/api/test/security.test.ts` (29 tests) and `packages/shared/test/security.test.ts`; API 83 tests, mobile 199, shared green with 99% coverage. Typecheck and lint green.

**Still needs you:** keep `APP_ENV=development` only in local `.dev.vars` (it was added to yours); confirm the `IP_LIMITER`/`USER_LIMITER` bindings are active in production; in RevenueCat, keep sandbox events pointed at a staging Worker or leave `REVENUECAT_ALLOW_SANDBOX` unset. Pending migrations (`0001_notify_settings`, `0002_entitlement_ordering`) are applied automatically by the next `pnpm run deploy` (E143).

### Device pass (Android, Galaxy S25) — done

First run on real hardware. Fixed: NativeWind wrapper breaking pressed-state styles (invisible yellow buttons, missing check-in tab button, stacked back chevron), Pressable layout props ignored (unequal button rows, inset links), keyboard covering comment composer and form footers under edge-to-edge, content scrolling behind the status bar, empty check-in sheet taking the full screen and hiding Today behind it, truncated "days shown up" stat, read-only check-in detail saying "Tap to mark done", plurals ("1 members", "1 check-ins"), "Half the tasks count". Windows note: the SDK's ninja 1.10 can't create long paths; replace `cmake/3.22.1/bin/ninja.exe` with ninja 1.12+.

**Known:** Fast Refresh can leave the local store unreadable ("This squad isn't on your phone yet"); a full reload fixes it (dev only).

### Discover, Squads and Badges redesign — done

- Discover: All by default; scrolling category chips with icons (interests first); Popular now cards, Starting soon, templates rail, New squads; per-category sort (Popular / Starting soon / Newest) with paging; "Can't find the right one?" card. API `sort` param, full squads hidden (2 API tests).
- 13 categories across shared, API, app and docs; onboarding interests use them.
- Squads: rich squad cards (progress, today's avatars, my status / Check in), plan slot count, Find more squads suggestions.
- Badges: 12 badges with tiers and family icons; summary with Up next; grouped grids; profile strip always shows three.

### Notifications N1–N6 — done

Comments and grouped fires (inbox), streak at risk and challenge starting (local), new members and milestone days (inbox), and a Notifications screen split into "From this phone" and "From your squads" with a switch per type. Migration `0001_notify_settings` (applied automatically by `pnpm run deploy`, E143).

### Quick check-in, squad streaks, invite prompt, free BYOK builder — done

Long-press the centre button to mark everything done (confirm first); streak flame on squad cards; Invite friends on solo squads; AI builder open to Free with the user's key (tag "Your key").

### Brand, ease-of-use and growth pass — done

Logo, app icon, splash, loading screen and Welcome redesign; amber switches; animated tab bar that follows the phone's inset; swipe-down sheets; typed numbers; compact Discover filter; template list and detail redesign; minimal Connected accounts; email card in Help; settings import. Nudge everyone, Everyone showed up, Start the next challenge, app icon shortcuts, Groq and OpenRouter, 7 new templates, Android widget, weekly recap card, Add to calendar (DECISIONS E144–E155).

**Still needs you:** a new development build (new native modules); `pnpm run deploy` (next-challenge API change) and `pnpm seed:templates -- --remote` (new templates); Google sign-in setup (SETUP 3.3).

### Device feedback round — done

Swipe to close on native gestures, comeback flow, rating prompt, real app icon on Android, widget with tickable tasks and free resizing, flame badges and secret moments, minimal squad share (E163–E169).

**Not yet seen on a device:** all of the above. **Needs:** `pnpm run deploy` (migration 0003) and a new native build.
