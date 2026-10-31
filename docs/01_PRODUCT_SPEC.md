# SparkSquad — Product Spec (v1)

App name: **SparkSquad** (a SparkTribe product). Tagline: *Show up daily, with your squad.*
App identifiers: iOS bundle ID and Android package `com.sparktribe.sparksquad`; URL scheme `sparksquad://`.
Platforms: iOS and Android from one React Native (Expo) codebase. Web later.
Audience at launch: Indian college students and early-career engineers doing placement / career prep (SparkTribe community). Other categories (fitness, learning) are open but not marketed. **Users must be 18+.**

## 1. The product in one paragraph

SparkSquad is a check-in app for small accountability **squads** (max 100 members). A squad follows one **challenge** at a time, built from a day-by-day **plan**. Every member checks in daily (one tap, or a few numbers), sees the squad's progress on a shared **board**, keeps a **streak**, and gets nudged by friends. It is deliberately **not** a chat app or social network: chat stays in WhatsApp/Telegram for free users. Text check-ins are tiny; photos and chat are the expensive things and sit behind the paywall or stay on the phone.

**Design rule behind every decision:** a free user must cost us close to ₹0, so the free tier can stay generous forever.

**Product philosophy:** encourage without shaming. Missed days are shown in neutral grey, never red. Competition is friendly and scoped to the squad.

## 2. Core loop

Join or create a squad → challenge with a day-by-day plan → daily check-in (tasks done, numbers, optional note, optional photo on device) → squad board updates (who has / hasn't checked in) → reactions, comments, nudges → streaks, badges, leaderboard → reminders bring the user back tomorrow.

## 3. Concepts and rules

### Squad
- Fields: name, description, rules (short text), category (`career` | `fitness` | `learning` | `other`), privacy (`public` | `private`), member limit (default and max 100 in v1), optional WhatsApp/Telegram group URL, invite code (6 chars, rotatable).
- Privacy: **public** = anyone can join from Discover; **private** = join by invite link/code, owner/admin approves.
- Roles: **Owner**, **Admin**, **Member**. Owner can do everything incl. delete squad and transfer ownership. Admin can approve requests, remove members, pin announcement, edit plan days. Member can check in, react, comment, nudge, leave.
- One active challenge per squad in v1. Past challenges remain viewable (summary only).
- One pinned announcement per squad (owner/admin), max 500 chars.

### Challenge and plan
- A challenge is created from a **plan** in the SparkSquad plan format (see `05_PLAN_FORMAT.md`). Sources: template, JSON import, AI prompt (copy/paste), in-app BYOK AI, blank builder.
- Duration 1–120 days. Start date chosen by owner (default next Monday). Day number for a member = days since start date in **that member's local timezone**, +1.
- "Shared challenge, personal target": every member sees the same tasks; owner can allow members to adjust their own numeric targets (setting `allowPersonalTargets`, default true).
- Owner/admin can edit any future day after import. Past days are frozen.
- Owner can export the plan JSON to share with another squad.

### Tasks
- Types: `check` (done/not), `count` (number + unit, target), `minutes` (target minutes).
- Optional `verify`: `leetcode` | `github` | `codeforces` | `steps` → auto-checked from the phone (see Architecture §Verification). Verified tasks show a mint "Verified" label.
- Optional `link` (resource URL).

### Check-in
- One check-in per user per challenge per local date (unique key). Re-submitting the same day **updates** it.
- Contains: per-task values, optional note (≤280 chars), optional photo flag.
- Status: `done` (all tasks met), `partial` (some), `honest_miss` (user taps "I couldn't today" — counts as showing up for engagement, does NOT count as a done day, does not break streak if a freeze is available).
- Editable/backfillable until the end of the **next** local day. Stores an `edited` flag (no full audit log).
- Free users: photo saved on device only; others see "added proof" indicator. Plus: photo uploaded (compressed ~100 KB WebP/JPEG), visible to squad, auto-deleted after 30 days (Squad Pro: 90 days).

### Board, reactions, comments, nudges
- Board shows: count "6/9 showed up today", avatar row with amber ring for checked-in members, "Still to check in" list with **Nudge** buttons, today's check-ins feed.
- Reactions: one kind in v1 (`fire`), toggle, counted.
- Comments: ≤140 chars, on a check-in, deleted after 30 days (90 for Plus/Pro squads). Max 20 comments per user per day.
- Nudge: one per sender → recipient → day. Sends a push "Divya nudged you: DSA 60 is waiting".

### Streaks, freezes, badges, score
- Streak per challenge and a global profile streak (any check-in counts).
- A day is **done** when status = `done`. Partial counts as done if the squad setting `partialCounts` is true (default true for ≥50% tasks).
- **Streak freeze**: earn 1 per 7-day streak; bank max 2 (Free) / 5 (Plus). Auto-applied on a missed day.
- Badges v1: 7-day, 21-day, 30-day streak; "First check-in"; "Challenge complete".
- **Consistency score** = done days ÷ days elapsed (as %). Ties broken by tasks completed. Leaderboard views: "This challenge" and "This week". No squad-vs-squad rankings in v1.

### Notifications
- **Local** (scheduled on device, free): daily reminder at user's chosen time; "missed yesterday" gentle note in the morning.
- **Push** (server, batched, max 2/user/day): squad digest ("6 of 9 checked in, you're next"), nudges, join requests (owners), announcement pinned, milestone reached.

### Moderation & safety (app-store required)
- Word filter on notes, comments, squad names/descriptions (server + client).
- Report (user, check-in, comment, squad) with reason; block user (hides their content everywhere for the blocker).
- Terms with zero-tolerance clause accepted at signup; contact email in app.
- In-app account deletion (removes rows, photos, tokens) and data export (JSON).
- Admin: protected endpoints for reports queue (ADMIN_EMAILS env).

## 4. Tiers and limits (enforced server-side)

| | Free | Plus (₹99/mo, ₹799/yr) | Squad Pro (₹299/mo or ₹2,499/yr per squad, bought by owner) |
|---|---|---|---|
| Squads you're in | 3 | 10 | — |
| Squads you own | 1 | 5 | that squad counts as Pro |
| Members per squad | 100 | 100 | 100 (300 later) |
| Check-ins, streaks, leaderboards, reminders, verification | ✓ | ✓ | ✓ |
| Photo proof | on phone only | shared, 30-day expiry | shared, 90-day expiry |
| Comment history | 30 days | 90 days | 90 days |
| Streak freezes banked | 2 | 5 | — |
| Weekly recap | template | AI (on-device or BYOK) | AI squad summary for owner |
| In-app AI plan builder (BYOK) | — (copy-prompt flow is free) | ✓ | ✓ |
| Owner tools | basic | basic | analytics, CSV export, challenge series, custom branding |
| Chat | link to WhatsApp/Telegram | same | in-app squad chat (**v2, do not build in v1**) |

Prices are configurable (RevenueCat products); keep them out of code. Free-tier numbers live in one config file in `packages/shared`.

**Payments switch:** the full RevenueCat purchase flow is built in v1 but controlled by `PAYMENTS_ENABLED` (env, default `false` for the pilot). When off: free limits still apply, paywalls show the plans with a "Plus is coming soon. Get notified" button that records interest (`POST /v1/me/plus-interest`), and no RevenueCat keys are needed. When on: real purchases, restore, and webhook entitlements.

## 5. Scope

### Build in v1 (everything in `03_SCREENS.md` marked v1)
Auth (Google, Apple, email OTP), 18+ gate, onboarding, squads (create/join/invite/approve/roles/leave/delete), challenges from templates / JSON import / AI copy-prompt / BYOK AI builder / blank builder, check-ins, board, reactions, comments, nudges, leaderboards, streaks/freezes/badges, plan view and owner day editing, share card, Discover, profile with heatmap, settings, integrations (GitHub, LeetCode, Codeforces usernames; Health Connect / HealthKit steps), local + push notifications, Plus & Squad Pro purchase via RevenueCat, moderation, data export, account deletion, offline check-ins with sync, weekly template recap, on-device AI recap on iOS where available.

### Do NOT build in v1
In-app chat, money stakes, phone OTP, moderator role, buddy system, squad-vs-squad rankings, web app, Tamil UI (but keep all strings in an i18n file so it's easy later), sponsored challenges, Android Gemini Nano (template fallback instead).

## 6. Success metrics to instrument (privacy-friendly analytics)
D1/D7/D30 retention, check-ins per active member, challenge completion rate, active squads, invite conversion (invite opened → joined), share-card shares, % returning after inactivity, free→Plus conversion. Use PostHog (self-describing events, no PII in properties).

## 7. Copy & tone
Plain, warm, sentence case. Active verbs on buttons ("Check in", "Import plan", "Nudge"). Errors say what happened and how to fix it. Never shame missed days ("You can still check in for yesterday until midnight").
