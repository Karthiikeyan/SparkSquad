# Decisions

Product-owner decisions (fixed). Append your own below with one line of reasoning each.

| # | Decision | Why |
|---|---|---|
| D1 | App name **SparkSquad**, a SparkTribe product. Bundle ID / package `com.sparktribe.sparksquad`, URL scheme `sparksquad://`. | Ties to the SparkTribe audience; no existing app with this name found in the stores (Oct 2026). |
| D2 | Backend: **Cloudflare Workers + D1 + R2 + Better Auth** (not Supabase). | ₹0 for longer, no egress fees, built-in point-in-time restore. Fallback only if a blocking issue appears: Supabase (record why here first). |
| D3 | Payments: build the full RevenueCat flow, ship the pilot with `PAYMENTS_ENABLED=false`. | Lets the pilot run without store products or RevenueCat setup; turning on payments is a config change, not a rebuild. |
| D4 | Admin: protected `/v1/admin/*` endpoints + a minimal static `/admin` page served by the Worker. No separate admin app. | Enough to meet the 24-hour report-review promise with almost no extra code. |
| D5 | Invite links: `sparksquad://join/CODE` plus `https://<api-domain>/join/CODE` redirect pages until a custom domain is bought; then add universal/app links. | Works on day one without buying a domain. |
| D6 | Dark theme is the default; light theme tokens exist but ship later. | Matches the reference designs; halves design QA for v1. |
| D7 | Users must be 18+. | Avoids DPDP verifiable-parental-consent obligations for minors. |

## Engineering decisions (append below)

| # | Decision | Why |
|---|---|---|
| E1 | Build kit moved from `sparksquad-build-kit/` to the repo root. | The kit's own instructions expect `docs/`, `design/`, `.github/` at the root; all doc paths assume it. |
| E2 | pnpm 12 with `nodeLinker: hoisted` (set in `pnpm-workspace.yaml`). | Metro and many React Native native modules still assume a flat `node_modules`. |
| E3 | TypeScript pinned to `~6.0` (not 7). | `typescript-eslint` supports `<6.1`; TS 7 (native port) would break linting. |
| E4 | Vitest 5 everywhere; Workers tests use `@cloudflare/vitest-plugin` (renamed from `@cloudflare/vitest-pool-workers`). | The old package is deprecated; the plugin is the same API. |
| E5 | NativeWind 4.2 + Tailwind 3.4 (not NativeWind 5 RC). | Latest stable; v5 is still a release candidate. |
| E6 | Expo Router routes live in `apps/mobile/app/` (not the template's `src/app/`). | Matches Architecture §2. |
| E7 | Colour tokens live in `apps/mobile/src/theme/colors.js` (CommonJS). | One source for both `tailwind.config.js` and typed `theme.ts`. |
| E8 | Prettier `endOfLine: auto`, `.gitattributes` normalises to LF in git. | Windows checkouts keep CRLF locally without failing the format check; the repo stays LF. |
| E9 | API tests call `app.request(path, init, env)` with `env` from `cloudflare:workers`. | Fully typed without generating `wrangler types`; still runs inside workerd. |
