# SparkSquad — Master prompt for GitHub Copilot (Agent mode)

## How to use this kit

1. Create an empty folder `sparksquad/`, put **everything from this kit** in it (keep the folder structure: `docs/`, `design/`, `.github/`), and open it in VS Code.
2. `git init` and make a first commit ("Add build kit").
3. Open Copilot Chat → switch to **Agent** mode → choose **Claude Opus 5.5** (or the strongest Claude Opus model in your model picker).
4. Paste **Prompt 1** below. Let it run; approve terminal commands when asked.
5. When the session ends or the context fills up, start a **new chat** and paste **Prompt 2 (continue)**. Repeat until `docs/PROGRESS.md` says all phases are done.
6. Finally, paste **Prompt 3 (final audit)**.

Model tips: use Opus for Phase 0–3 and any phase that touches architecture, sync, auth or payments. You can switch to **Sonnet 5.5** for screen-by-screen UI work and small fixes to save premium requests. One phase per chat session works best.

---

## Prompt 1 — build (paste this first)

```
You are the lead engineer building "SparkSquad", a check-in app for small accountability squads, for iOS and Android with React Native (Expo) and a Cloudflare Workers backend. Build the complete v1 end to end, production quality, in this repository.

READ FIRST, fully, before writing code:
- .github/copilot-instructions.md (rules for every task)
- docs/01_PRODUCT_SPEC.md (what to build, tiers, rules)
- docs/02_DESIGN_SYSTEM.md (tokens, typography, components)
- design/README.md and every design/*.dc.html file (15 reference screens; match them exactly)
- docs/03_SCREENS.md (all ~70 screens and states, routes; build every one marked for v1, not only the 15 designed)
- docs/04_ARCHITECTURE.md (stack, repo layout, data model, API, sync, cost rules, verification, BYOK AI, security)
- docs/05_PLAN_FORMAT.md (plan JSON format, extractJson/parsePlan rules, AI prompt, tests, templates)

Then read docs/DECISIONS.md (decisions already made by the product owner; follow them and append your own), create docs/PROGRESS.md with the phase checklist below, and work through the phases in order. After each phase: run typecheck, lint and tests, fix everything, commit, update PROGRESS.md (done / next / known issues), then continue to the next phase without waiting for me. Make reasonable decisions when something is unspecified and log them in DECISIONS.md. Only stop and ask me if an action would delete data, needs a paid account, or needs credentials only I have — in that case use placeholders and env variables and keep going.

PHASES
0. Scaffold: pnpm workspace monorepo exactly as in Architecture §2 (apps/mobile Expo + Expo Router + TypeScript strict + NativeWind; apps/api Hono on Cloudflare Workers with wrangler.toml for D1, R2, cron, rate limiting; packages/shared). ESLint, Prettier, Turborepo tasks (dev, build, lint, typecheck, test), GitHub Actions CI, .env.example files for mobile and api, .gitignore. Root README with quick start.
1. packages/shared: types and zod schemas for every API payload; tier limits config; local-date helpers; scoring, streak and freeze logic; word filter; the complete plan module (schema, extractJson, parsePlan with fixes and stats, buildPrompt, exportPlan, planHash) with ALL tests listed in Plan Format §6. Aim for >90% coverage of this package.
2. apps/api: Drizzle schema + migrations for the full data model (Architecture §3); Better Auth (Google, Apple native ID token, email OTP via Resend) with the Expo plugin; every endpoint in Architecture §4 with zod validation, membership checks, limits, rate limits, stable error codes; delta sync with cursors; R2 plan storage and presigned photo uploads; RevenueCat webhook entitlements; Expo push sender; hourly cron (digest pushes max 2/user/day, streak freezes, challenge end roll-ups, comment/notification expiry); moderation (reports, blocks, word filter) and the minimal /admin page; template seeding script for /templates. Integration tests for auth guards, limits, check-in idempotency and date window, sync, leaderboard maths, webhook.
3. apps/mobile foundation: theme tokens + fonts (Bricolage Grotesque, Inter), every component in Design System "Components", navigation structure for all routes (tabs with centre Check-in button), API client with auth, TanStack Query, expo-sqlite + Drizzle local store, outbox with idempotent flush, offline banner, toasts, error boundary, i18n (en.json), analytics/Sentry wrappers that no-op without keys.
4. Auth and onboarding screens A1–A10 (Google and Apple sign-in, email OTP, 18+ consent, profile, interests, reminder time, notification prime, join-or-create), deep links for invites (sparksquad://join/CODE and universal links).
5. Core loop: Today (B1–B8) incl. check-in sheet, success moment, honest miss, freeze notice, backfill, notifications inbox; local daily reminders; push registration and handling.
6. Squads: C1–C15 (board, leaderboard, plan with day strip, owner day editor, check-in detail and comments, members, requests, invite with QR, settings, announcement, share card via react-native-view-shot, history, report).
7. Create and join: D1–D11 and E1–E4 (templates, JSON import with preview/fixes using the shared parser, copy-prompt AI screen with ChatGPT/Gemini/Claude links, BYOK in-app builder with interview + one repair round, blank builder, review, created screen), Discover and search, squad preview, join with code.
8. You and settings: F1–F16 (profile with heatmap, edit, badges, history calendar, settings, AI key setup with test call and daily cap, integrations + on-device verification for GitHub/LeetCode/Codeforces and Health Connect/HealthKit steps, notification settings, RevenueCat paywalls for Plus and Squad Pro, billing, blocked users, export, delete account, help, legal pages). Weekly recap: template, iOS on-device model via @react-native-ai/apple when available, BYOK otherwise.
9. Polish and hardening: every screen's loading/empty/error/offline state; accessibility pass; reduced motion; Dynamic Type check; performance (FlashList for long lists, memoisation); light-theme tokens wired (dark default); app icon + splash placeholders in the brand colours; EAS config (development, preview, production profiles) and app.config.ts reading env; security review against Architecture §10; all tests green.
10. Documentation: write SETUP.md (spec below), update README.md, finish PROGRESS.md and DECISIONS.md.

QUALITY BAR
- Screens must look like the reference designs: same tokens, spacing, radii, type scale, copy tone. New screens must look like they belong to the same app.
- No placeholder "TODO" screens in the final result. If a feature needs credentials, it must still be fully coded and degrade gracefully with a clear message when the key is missing.
- Cost rules in Architecture §5 are requirements, not suggestions.

SETUP.md (write it at the end, for a developer who has never used these services)
1. Prerequisites with versions (Node LTS, pnpm, Git, Xcode/Android Studio notes, EAS CLI, Wrangler) and install commands.
2. A table of EVERY environment variable and secret, for mobile and api: name, required/optional, what it does, where exactly to get it (console + menu path), example format, and where to put it (.env, wrangler secret, EAS secret).
3. Step-by-step account setup with exact commands and console clicks: Cloudflare (wrangler login, D1 create + migrations local and remote, R2 bucket + lifecycle rules for proof-30d/proof-90d/exports, rate-limit binding, cron, custom domain optional, deploy); Better Auth secret generation; Google OAuth clients (Web, Android with SHA-1 from EAS credentials, iOS); Sign in with Apple (App ID capability, Services ID, key); Resend (domain or test sender); Expo/EAS (project, credentials, FCM v1 service account for Android push, APNs key for iOS); RevenueCat — marked "Later: when you turn on payments" — (project, Play and App Store apps, products/entitlements/offerings named exactly as in code, webhook URL + secret, then set PAYMENTS_ENABLED=true); PostHog and Sentry (optional); Health Connect and HealthKit permissions and store declarations.
4. Run locally: api (wrangler dev with local D1/R2 + seed), mobile (development build on Android device/emulator and iOS simulator, pointing at local API), test accounts.
5. Deploy: api to Workers, mobile via EAS Build (internal testing), EAS Update channels.
6. Store submission checklist: Play Console (closed testing 12 testers / 14 days for new personal accounts, data safety form, health permissions declaration, content rating, 18+ target audience), App Store Connect (privacy nutrition labels, Sign in with Apple, account deletion, UGC guideline 1.2 items, review notes with demo account).
7. Seeding templates, creating the first admin (ADMIN_EMAILS), moderating reports.
8. Costs: what is free, which limits to watch (D1 500 MB per free database, Workers 100k requests/day, R2 10 GB), and when to move to Workers Paid (US$5/month).
9. Troubleshooting for the 10 most likely setup errors (OAuth redirect mismatch, SHA-1, push credentials, D1 binding names, CORS, deep links, Health Connect missing, RevenueCat sandbox, timezone, EAS build failures).

Start now with reading the docs, then Phase 0.
```

---

## Prompt 2 — continue (new chat each time)

```
Continue building SparkSquad. Read .github/copilot-instructions.md, docs/PROGRESS.md and docs/DECISIONS.md first, then the docs relevant to the next unfinished phase (docs/01–05, design/*.dc.html for any UI). Check the repo state with git log and run typecheck, lint and tests. Fix anything broken, then continue with the next unfinished phase from PROGRESS.md, following the same rules: commit after each phase, update PROGRESS.md and DECISIONS.md, keep going without waiting for me unless an action deletes data or needs my credentials.
```

---

## Prompt 3 — final audit (after all phases)

```
Do a final audit of SparkSquad against the docs. 1) Go through docs/03_SCREENS.md row by row and confirm each screen exists, matches the design system, and has loading/empty/error/offline states; build anything missing. 2) Go through docs/01_PRODUCT_SPEC.md §3–§4 and confirm every rule and tier limit is enforced on the server with a test. 3) Check docs/04_ARCHITECTURE.md §5 cost rules and §10 security one by one. 4) Run the full test suite, typecheck and lint, and an Expo prebuild/EAS config check. 5) Make sure SETUP.md is complete per the spec in MASTER_PROMPT.md and that every env var used anywhere in the code appears in SETUP.md and the .env.example files. Write the results to docs/AUDIT.md (what passed, what you fixed, what still needs me), commit, and give me a short summary.
```
