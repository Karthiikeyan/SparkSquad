# Progress

## Phases

- [x] 0. Scaffold (pnpm + Turborepo monorepo, Expo app, Hono Worker, shared package, ESLint/Prettier, CI, env examples)
- [x] 1. packages/shared (schemas, limits, dates, scoring/streaks, word filter, plan module + tests)
- [x] 2. apps/api (Drizzle schema + migrations, Better Auth, all endpoints, sync, R2, webhooks, push, cron, moderation, admin, seeding, integration tests)
- [x] 3. apps/mobile foundation (tokens, fonts, components, navigation, API client, Query, SQLite + outbox, banners, toasts, i18n, analytics)
- [x] 4. Auth and onboarding A1–A10 + invite deep links
- [x] 5. Core loop B1–B8, reminders, push
- [x] 6. Squads C1–C15
- [ ] 7. Create and join D1–D11, E1–E4
- [ ] 8. You and settings F1–F16, weekly recap
- [ ] 9. Polish and hardening
- [ ] 10. Documentation (SETUP.md, README, final PROGRESS/DECISIONS)

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

### Phase 5 � done

- Plans: `src/lib/plans.ts` caches plan JSON by hash after each sync and overlays day edits (`effectiveDay`).
- Today (B1�B3, B6, B7): `src/features/today/` � `model.ts` (pure `buildTodayCards`: active/upcoming/finished, plan loading, day number, effective day, squad ring, my check-in + sync state, steps variant, backfill offer, sort; `pendingCards`, `predictedStreak`), `source.ts` (one local read), `ChallengeCard.tsx` (tasks with draft ticks and "Check in (n of m done)", B3 collapsed card with time / edit / sync clock / squad progress, rest day, steps card, upcoming, backfill banner), `HeaderActions.tsx` (streak pill, bell with unread dot), `TodayScreen.tsx` (loading/empty/error/offline, freeze sheet).
- Check-in (B4, B5): `src/features/checkin/` � `CheckinSheet.tsx` (challenge picker when several are pending, steppers/switches, note with counter, device-only photo, honest miss, edits until midnight tomorrow, backfill title), `submit.ts` (optimistic pending row + outbox), `drafts.ts`, `localProof.ts`, `SuccessScreen.tsx` (animated squad ring, haptic, streak, badges, offline note).
- Inbox (B8): `src/features/notifications/` � copy per kind, Today/Earlier groups, unread dots, mark one/all read.
- Reminders: `src/features/reminders/` (pure 7-day planner + morning missed-day note, native scheduler); Push: `src/features/push/AppBackground.tsx` (foreground display, refresh on receive, tap routing, cold start).
- Routes: `checkin/[challengeId]` (sheet, `next` = first pending), `checkin/success`, `notifications`; the centre tab button opens the sheet.
- 124 mobile tests (card model, submit/drafts, plan cache, reminders planner, inbox copy/grouping/freeze notice, task text, card rendering for B1/B3/B7/upcoming). Android bundle builds.

**Next:** Phase 6 � Squads C1�C15.

**Known issues:**
- Share card button on the success screen arrives with C13 (Phase 6).
- Tapping a card header goes to the Squads tab until the squad board exists (Phase 6).
- Verified task labels and pre-filled values need integrations (Phase 8); steps are entered by hand until then.
- Plus photo upload (presigned R2) is deferred to the billing phase; free device-only proof works.
- Paywall routes (F9/F10) don't exist yet; limit errors show a toast until Phase 8.
- Native sign-in, push, pickers and photos need a development build.

**Notes for the next session:** read `design/Squad.dc.html`, `Leaderboard.dc.html`, `Plan.dc.html`, `ShareCard.dc.html` before Phase 6. Squad board data: local `members`, `checkins` (14 days of others), `nudges`, `announcements`; reactions/comments/nudges go through the outbox kinds that already exist (`fire`, `comment`, `nudge`). Update `notificationRoute`/`routeForNotification` and the Today card's `onOpenSquad` to the new `squad/[id]` route. Add the share card button to `SuccessScreen.tsx`.

### Phase 6 � done

- Data: `src/features/squads/` � `source.ts` (one local read per squad), `model.ts` (board, member grid order, still-to-check-in with nudge state, feed with tasks done, current runs, rest-day checker, plan strip with neutral `past`, phases, milestones, editable days), `actions.ts` (optimistic fire + nudge through the outbox, comment counts, sync after admin actions), `checkinContext.ts`.
- Screens (`src/features/squads/screens/`): C1 My squads (count rings, start/join, requests to review), C2�C4 squad screen with Board / Leaderboard / Plan segments, announcement banner, WhatsApp/Telegram button, share and settings icons; C5 Edit day (title, review day, tasks with type/target/unit/auto-check/link, reorder, add, remove); C6 Check-in detail (tasks, note, photo or "proof on their phone", fire, comments with delete/report, expiry note, offline queueing, report/block menu); C7 Members (roles, joined, consistency, make admin/member, remove, report, block); C8 Member profile; C9 Join requests (approve/decline/approve all); C10 Invite (code, copy, share, QR, rotate); C11 Squad settings (details form, manage rows, past challenges, transfer, end challenge, delete, leave, report) with C12 announcement sheet; C13 Share card (view-shot, share, save, copy link); C14 Past challenge summary; C15 Report sheet (`src/features/safety/ReportSheet.tsx`) + block confirm.
- Cross-links: Today card header ? squad, success screen "Share card", inbox and push taps open squad / requests / history.
- New UI: `CountRing`; DayStrip `past` state and `columns` padding.
- 139 mobile tests (board, runs, strip, phases, fire/nudge on SQLite, member permissions, leaderboard ties, edit-day payloads, settings diff, share streak line, notification routes, board rendering). Android bundle builds.

**Next:** Phase 7 � Create and join D1�D11, E1�E4 (E3/E4 already built in Phase 4).

**Known issues:**
- `create/basics` is still a placeholder (Phase 7); owners of a squad without a challenge can't add one until then.
- Verified task labels/pre-fill need integrations (Phase 8); Plus photo upload and paywalls are Phase 8.
- Native features (sign-in, push, pickers, photos, share/save, QR) need a development build.

**Notes for the next session:** read `design/CreateSquad.dc.html`, `ImportPlan.dc.html`, `AIPrompt.dc.html`, `AIBuild.dc.html`, `Discover.dc.html` before Phase 7. Create flow: `POST /v1/squads` (createSquadSchema), then `POST /v1/squads/:id/challenges` `{plan, startDate, templateSlug?}`; templates via `GET /v1/templates` and `/v1/templates/:slug`; Discover via `GET /v1/discover`. Plan parsing/preview uses shared `parsePlan`, `planStats`, `buildPrompt`, `extractJson`. Reuse `SquadPreview` (E3) from Discover with `{ squadId }`. Add the "Set up a plan" entry point for squads with no challenge (Board empty state + settings).
