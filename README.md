# SparkSquad

Show up daily, with your squad. SparkSquad is a check-in app for small accountability squads (iOS and Android), a SparkTribe product. A squad follows a day-by-day plan together; everyone checks in once a day, sees who showed up, reacts, nudges and keeps streaks going.

Free users cost about nothing to run: no realtime sockets, delta sync, local reminders, photos that stay on the phone, and AI only on device or with the user's own key.

## What's in v1

- Sign in with Google, Apple or an email code; 18+ consent; onboarding with interests and a reminder time.
- Squads: create, invite (code, link, QR), join or request, roles, announcements, members, settings, history, share cards.
- Challenges from templates, JSON import, a copy-paste AI prompt, an in-app AI builder (bring your own key) or a blank builder; owners can edit future days.
- Daily check-ins that work offline, honest misses, backfill for yesterday, reactions, comments, nudges, leaderboards, streaks with freezes, badges.
- Verification on the phone: GitHub, LeetCode and Codeforces activity, and steps from Health Connect / Apple Health.
- Profile with an 18-week heatmap, history calendar, weekly recap (template, on-device AI on iOS, or your own key).
- Plus and Squad Pro through RevenueCat behind a payments switch (off for the pilot: "coming soon" paywalls record interest).
- Safety and privacy: reports, blocks, word filter, admin moderation page, data export, account deletion.

## Repository

| Part           | Path              | Stack                                                                                       |
| -------------- | ----------------- | ------------------------------------------------------------------------------------------- |
| Mobile app     | `apps/mobile`     | Expo SDK 58 (React Native), Expo Router, TypeScript, SQLite + Drizzle, TanStack Query, MMKV |
| API            | `apps/api`        | Hono on Cloudflare Workers, D1, R2, Better Auth, Drizzle, cron, rate limiting               |
| Shared logic   | `packages/shared` | zod schemas, plan parser, dates, scoring and streaks, tier limits, word filter              |
| Plan templates | `templates`       | SparkSquad plan JSON files, seeded into R2 and D1                                           |
| Docs           | `docs`, `design`  | Spec, design system, screens, architecture, plan format, reference designs                  |

## Quick start

Requirements: Node 22+, pnpm 12 (`corepack enable` or `npm i -g pnpm@12.16.1`), Git, and Android Studio and/or Xcode for a development build. **Full setup for every service is in [SETUP.md](./SETUP.md).**

```bash
pnpm install
cp apps/api/.dev.vars.example apps/api/.dev.vars      # set BETTER_AUTH_SECRET at least
cp apps/mobile/.env.example apps/mobile/.env          # EXPO_PUBLIC_API_URL = your PC's LAN IP on a phone

pnpm --filter @sparksquad/api db:migrate:local        # local D1
pnpm seed:templates                                   # plan templates into local D1 + R2
pnpm --filter @sparksquad/api dev                     # API on http://localhost:8787
pnpm --filter @sparksquad/mobile android              # build + install the dev client (or: ios)
```

The app uses native modules, so it needs a development build; it does not run in Expo Go. Without `RESEND_API_KEY`, email sign-in codes are printed in the API log during development.

## Scripts

| Command                                          | What it does                                             |
| ------------------------------------------------ | -------------------------------------------------------- |
| `pnpm typecheck`                                 | TypeScript strict in every package                       |
| `pnpm lint`                                      | ESLint in every package, then Prettier check             |
| `pnpm test`                                      | Vitest (shared, api) and Jest + Testing Library (mobile) |
| `pnpm format`                                    | Prettier write                                           |
| `pnpm templates:build`                           | Validate and format `templates/*.sparksquad.json`        |
| `pnpm seed:templates`                            | Load templates locally (`-- --remote` for Cloudflare)    |
| `pnpm --filter @sparksquad/api run deploy`       | Deploy the Worker                                        |
| `eas build --profile preview` (in `apps/mobile`) | Internal test build                                      |

Run `pnpm typecheck && pnpm lint && pnpm test` before every commit; CI runs the same on pushes to `main` and on every pull request.

## Docs

- Setup, deploy, store checklist, costs, troubleshooting: [SETUP.md](./SETUP.md)
- Product rules: [docs/01_PRODUCT_SPEC.md](./docs/01_PRODUCT_SPEC.md)
- Design system: [docs/02_DESIGN_SYSTEM.md](./docs/02_DESIGN_SYSTEM.md) and `design/*.dc.html`
- Screens: [docs/03_SCREENS.md](./docs/03_SCREENS.md)
- Architecture: [docs/04_ARCHITECTURE.md](./docs/04_ARCHITECTURE.md)
- Plan format: [docs/05_PLAN_FORMAT.md](./docs/05_PLAN_FORMAT.md)
- Progress and decisions: [docs/PROGRESS.md](./docs/PROGRESS.md), [docs/DECISIONS.md](./docs/DECISIONS.md)
