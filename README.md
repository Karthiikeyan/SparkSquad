# SparkSquad

Show up daily, with your squad. A check-in app for small accountability squads (iOS + Android), a SparkTribe product.

| Part              | Path              | Stack                                                    |
| ----------------- | ----------------- | -------------------------------------------------------- |
| Mobile app        | `apps/mobile`     | Expo (React Native), Expo Router, NativeWind, TypeScript |
| API               | `apps/api`        | Hono on Cloudflare Workers, D1, R2, Better Auth, Drizzle |
| Shared logic      | `packages/shared` | zod schemas, plan parser, dates, scoring, limits         |
| Plan templates    | `templates`       | SparkSquad plan JSON files                               |
| Product/tech docs | `docs`, `design`  | Spec, design system, screens, architecture, plan format  |

## Quick start

Requirements: Node LTS (22+), pnpm 12 (`npm i -g pnpm`), Git. Full account setup is in `SETUP.md`.

```bash
pnpm install
cp apps/api/.dev.vars.example apps/api/.dev.vars      # fill BETTER_AUTH_SECRET at least
cp apps/mobile/.env.example apps/mobile/.env

pnpm --filter @sparksquad/api db:migrate:local        # local D1
pnpm --filter @sparksquad/api dev                     # API on http://localhost:8787
pnpm --filter @sparksquad/mobile dev                  # Expo dev server (needs a development build)
```

Checks (run before every commit):

```bash
pnpm typecheck && pnpm lint && pnpm test
```

## Docs

- Product rules: `docs/01_PRODUCT_SPEC.md`
- Design system: `docs/02_DESIGN_SYSTEM.md` and `design/*.dc.html`
- Screens: `docs/03_SCREENS.md`
- Architecture: `docs/04_ARCHITECTURE.md`
- Plan format: `docs/05_PLAN_FORMAT.md`
- Progress and decisions: `docs/PROGRESS.md`, `docs/DECISIONS.md`
