# Progress

## Phases

- [x] 0. Scaffold (pnpm + Turborepo monorepo, Expo app, Hono Worker, shared package, ESLint/Prettier, CI, env examples)
- [x] 1. packages/shared (schemas, limits, dates, scoring/streaks, word filter, plan module + tests)
- [ ] 2. apps/api (Drizzle schema + migrations, Better Auth, all endpoints, sync, R2, webhooks, push, cron, moderation, admin, seeding, integration tests)
- [ ] 3. apps/mobile foundation (tokens, fonts, components, navigation, API client, Query, SQLite + outbox, banners, toasts, i18n, analytics)
- [ ] 4. Auth and onboarding A1–A10 + invite deep links
- [ ] 5. Core loop B1–B8, reminders, push
- [ ] 6. Squads C1–C15
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

**Notes for the next session:** design files read so far: Main, CheckIn, Welcome, Squad, Leaderboard, Plan. Read the rest (CreateSquad, ImportPlan, AIPrompt, AIBuild, Discover, Profile, Plus, Settings, ShareCard) before building those screens.
