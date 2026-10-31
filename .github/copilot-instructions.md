# Copilot instructions — SparkSquad

These rules apply to every task in this repository.

## Source of truth
- Product rules: `docs/01_PRODUCT_SPEC.md`
- Look and feel: `docs/02_DESIGN_SYSTEM.md` + reference screens in `design/*.dc.html` (match them exactly)
- Screens and routes: `docs/03_SCREENS.md`
- Stack, data model, API, cost rules: `docs/04_ARCHITECTURE.md`
- Plan JSON format, AI prompt, parser rules: `docs/05_PLAN_FORMAT.md`
- Progress and decisions: `docs/PROGRESS.md`, `docs/DECISIONS.md` (update both as you work)

If the docs conflict, the order above wins (product spec first). If something is missing, make the most reasonable choice, implement it, and record it in `docs/DECISIONS.md` with one line of reasoning. Do not stop to ask unless an action is destructive or needs a paid account.

## Non-negotiables
- TypeScript strict everywhere. No `any` without a comment explaining why.
- Free users must cost ~₹0: no realtime sockets, delta sync only, reminders as local notifications, photos never uploaded for free users, AI never called with our own keys.
- Never hard-code secrets, prices or free-tier numbers. Secrets via env/Wrangler/EAS; prices from RevenueCat; limits from `packages/shared/src/limits.ts`.
- Enforce limits and permissions on the server. The client only mirrors them for UX.
- BYOK API keys live only in `expo-secure-store` on the phone. Never send them to our API, never log them, never put them in analytics or crash reports.
- Every user-facing string goes through `apps/mobile/src/i18n/en.json`.
- Every screen handles loading, empty, error and offline states.
- Accessibility: labels on icon buttons, roles on switches/tabs/radios, 44×44 touch targets, contrast ≥ 4.5:1, never colour-only meaning.
- Missed days are neutral grey, never red. Red is only for destructive actions.
- No emoji in the UI. Icons: lucide-react-native, 1.8 stroke.

## Working style
- Small, focused commits with clear messages (`feat(api): check-in upsert endpoint`).
- Write tests with the code (Vitest for `packages/shared` and `apps/api`, RNTL for mobile logic and key components). Keep `pnpm -w typecheck && pnpm -w lint && pnpm -w test` green before moving on.
- Prefer well-maintained libraries already chosen in the architecture doc; justify any new dependency in `docs/DECISIONS.md`.
- Keep files small and named by feature. Shared logic (dates, scoring, plan parsing, limits) belongs in `packages/shared`.
- When you finish a phase, update `docs/PROGRESS.md` (done, next, known issues).
