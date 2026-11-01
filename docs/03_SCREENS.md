# SparkSquad — Screen Inventory (all v1 screens)

Legend: **[D]** = a reference design exists in `design/` (match it exactly). Everything else must be designed in the same language (see `02_DESIGN_SYSTEM.md`) and reuse the same components. Every list/data screen needs four states: **loading** (skeleton), **empty** (one sentence + one CTA), **error** (what happened + retry), **offline** (cached data + banner).

Routes use Expo Router (`apps/mobile/app/`). Tab bar on the 4 tab roots only; the centre button opens the check-in sheet.

## A. Launch, auth and onboarding  `(auth)/`
| # | Screen | Route | Notes |
|---|---|---|---|
| A1 | Splash | native splash | Black bg, amber ring mark. Restore session, then route. |
| A2 | Welcome **[D] Welcome** | `(auth)/welcome` | Ring of 12 avatars "8/12 checked in today". Google, Apple, "Use my email instead". 18+ and terms line. |
| A3 | Email sign-in | `(auth)/email` | Email field, "Send code". |
| A4 | Email code | `(auth)/verify` | 6-digit OTP boxes, resend timer (30 s), paste support. |
| A5 | Confirm age & terms | `(onboarding)/consent` | "I'm 18 or older" checkbox + Terms/Privacy links + zero-tolerance line. Blocks until checked. |
| A6 | Your profile | `(onboarding)/profile` | Display name, username (availability check), avatar colour/initials picker. |
| A7 | What are you working on? | `(onboarding)/interests` | Category chips (multi; every category except Other), used to order Discover and Squads suggestions. |
| A8 | Reminder time | `(onboarding)/reminder` | Time wheel, default 8:00 PM. Explains reminders run on the phone. |
| A9 | Notifications prime | `(onboarding)/notifications` | Why we ask, then system prompt. "Not now" allowed. |
| A10 | Join or create | `(onboarding)/start` | Three choices: Join with a code, Browse public squads, Start a squad. Deep-link invite skips here straight to Squad preview. |

## B. Today (tab 1)  `(tabs)/today`
| # | Screen | Route | Notes |
|---|---|---|---|
| B1 | Today **[D] Main** | `(tabs)/today` | One card per active challenge: title, squad, "Day 12 of 60", avatar ring + "6 of 9 checked in", task rows with tick circles, primary Check in button. Streak pill + bell in header. Steps card variant shows synced number + progress bar. |
| B2 | Today — empty | same | No squads: EmptyState "Your squads' daily tasks show up here" + Join / Start buttons. |
| B3 | Today — all done | same | Card collapses to "Checked in at 7:42 AM", edit link, squad progress. |
| B4 | Check-in sheet **[D] CheckIn** | modal `checkin/[challengeId]` | Steppers for count/minutes, switch for check tasks, verified label, note (280), "Add a photo as proof" (Free: device only copy), Check in button, edit-until note. "I couldn't today" secondary link → honest miss. Challenge picker at top if user has >1 challenge pending. |
| B5 | Check-in success | modal `checkin/success` | Peak moment: ring animates to full, "Day 12 done. 12-day streak.", squad count, buttons: Share card, Back to Today. Badge unlock variant. |
| B6 | Streak freeze used | sheet | "You missed yesterday. A streak freeze kept your 12-day streak." (shown once next morning). |
| B7 | Backfill yesterday | sheet | From missed-day banner: check in for yesterday until midnight today. |
| B8 | Notifications inbox | `notifications` | Nudges, approvals, announcements, milestone days, comments and grouped fires on my check-ins, new members in squads I run, badges; grouped Today / Earlier; mark all read. |

## C. Squads (tab 2)  `(tabs)/squads`
| # | Screen | Route | Notes |
|---|---|---|---|
| C1 | My squads | `(tabs)/squads` | Large title; one card per squad (category icon, name, role, challenge and day, challenge progress, today's avatars and count, my status or a Check in button; squads waiting on me first); "n of limit squads on your plan"; Start a squad + Join with code; pending requests; "Find more squads" suggestions while there's room. |
| C2 | Squad board **[D] Squad** | `squad/[id]` | Back, share icon, name, meta, segmented Board / Leaderboard / Plan, "6/9 showed up today" + member grid, Still to check in + Nudge, Today's check-ins feed with fire reaction + Comment, pinned announcement banner at top if any, WhatsApp/Telegram button. |
| C3 | Leaderboard **[D] Leaderboard** | `squad/[id]/leaderboard` (segment) | Chips This challenge / This week, explainer line, ranked rows, "You" highlighted with accentSoft. |
| C4 | Plan **[D] Plan** | `squad/[id]/plan` (segment) | Phase name + "Phase 1 of 4", phase bar, 7-day strip (swipe for more), selected day card with typed task tiles, milestone row, owner buttons Edit this day / Export plan. Members see read-only. |
| C5 | Edit day (owner/admin) | `squad/[id]/plan/day/[n]` | Title, tasks list (reorder, edit type/target/unit/verify/link, delete, add), mark as review day. Past days locked. |
| C6 | Check-in detail & comments | `checkin/[id]` | Full check-in (tasks, note, photo if Plus), reactions, comments list (140 chars, expiry note), composer, report/block in menu. |
| C7 | Members | `squad/[id]/members` | Roles (Owner/Admin/Member), joined date, consistency %. Owner/admin actions: make admin, remove. Everyone: report, block. |
| C8 | Member profile (public) | `user/[id]` | Name, avatar, streaks in this squad, badges. Report/block. No private data. |
| C9 | Join requests | `squad/[id]/requests` | Approve / Decline per request, approve all. |
| C10 | Invite | `squad/[id]/invite` | Invite code (big), copy link, share sheet, QR code, rotate code (owner). |
| C11 | Squad settings | `squad/[id]/settings` | Name, description, rules, category, privacy, WhatsApp/Telegram URL, allow personal targets, partial counts as done, announcement composer, transfer ownership, end challenge, delete squad (confirm), leave squad. |
| C12 | Pin announcement | sheet | Text ≤500, pin/unpin. |
| C13 | Share card **[D] ShareCard** | modal `squad/[id]/share` | 9:16 card rendered on device (view-shot): squad, day, big "6/9", avatar grid, longest streaks, wordmark, invite code. Share to WhatsApp, Save image, Copy invite link. |
| C14 | Past challenge summary | `squad/[id]/history/[challengeId]` | Final consistency per member, completion %, rolled-up stats. |
| C15 | Report sheet | sheet | Reasons list + optional text, submit → toast "Report sent. We review reports within 24 hours." |

## D. Create squad flow  `create/`
| # | Screen | Route | Notes |
|---|---|---|---|
| D1 | Squad basics | `create/basics` | Step 1 of 3: name, description, category chips, privacy (Public/Private), member limit (default 100), WhatsApp URL optional. Enforce Free owns-1 limit → paywall. |
| D2 | Set up the plan **[D] CreateSquad** | `create/plan` | Step 2 of 3: Use a template / Import a plan file / Build it with your AI (Free) / Generate in the app (BYOK, Plus) / Start blank. |
| D3 | Templates | `create/templates` | Cards with icon, title, one line on what it's for, days and tasks/day; category filter row. |
| D4 | Template detail | `create/templates/[id]` | Hero with goal and stats, phases, what a day looks like, milestones, day list; start date and Use this plan pinned at the bottom. |
| D5 | Import plan **[D] ImportPlan** | `create/import` | Pasted text preview, Paste again / Choose a file, result card (title, goal), stats (days, tasks, review days, phases), "N items were fixed" disclosure, first days preview, See all days, Start date row, Import plan. |
| D6 | Import error | same | "This isn't a SparkSquad plan" with exact reason, buttons Copy the prompt again / Paste again. Partial-parse errors listed per day. |
| D7 | Build with your AI **[D] AIPrompt** | `create/ai-prompt` | 1 goal field, 2 prompt preview + Copy prompt, 3 open ChatGPT / Gemini / Claude (deep links/URLs), 4 Paste the AI's reply → D5. |
| D8 | In-app plan builder **[D] AIBuild** | `create/ai-build` | BYOK chat: progress "Question 4 of about 6", bubbles (AI left surface, user right accent), quick-reply chips, input bar, privacy line. When AI confirms summary → generating state → validated plan → D5 preview. No key → link to Settings › AI. Plus-gated. |
| D9 | Blank challenge builder | `create/blank` | Title, duration preset (7/21/30/60/90/custom), days per week, default daily tasks (applied to every day), then optional per-day edits via C5. |
| D10 | Review & create | `create/review` | Step 3 of 3: summary card (squad + challenge + start date), Create squad. |
| D11 | Squad created | `create/done` | "Placement Squad 7 is ready" + invite card (code, Share to WhatsApp, Copy link) + Go to squad. |

## E. Discover (tab 3)  `(tabs)/discover`
| # | Screen | Route | Notes |
|---|---|---|---|
| E1 | Discover **[D] Discover** | `(tabs)/discover` | Search; one-row category filter (All, three categories with my interests first, filter button opening every category and the sort); All shows Popular now (cards), Starting soon, Plan templates rail, New squads; a category or sort choice shows the paged list and its templates; Start a squad card. Full squads are hidden. |
| E2 | Search results | `discover/search` | Squads and templates sections; recent searches when empty. |
| E3 | Squad preview | `squad/[id]/preview` | Public info before joining: description, rules, plan summary, members count, start date, Join / Request to join. Also the landing for invite deep links (`sparksquad://join/CODE`; https invite links on the API domain `/join/CODE` that redirect to the store if the app is missing, upgradeable to universal links once a custom domain exists). |
| E4 | Join with code | `join` | 6-char code input → E3. |

## F. You (tab 4)  `(tabs)/you`
| # | Screen | Route | Notes |
|---|---|---|---|
| F1 | Profile **[D] Profile** | `(tabs)/you` | Avatar, name, "In 2 squads since October", settings button, stat tiles (day streak, best streak, days shown up %), 18-week heatmap with legend, badges, plan row (Free: "In 2 of 3 squads" + See Plus). |
| F2 | Edit profile | `you/edit` | Name, username, avatar colour. |
| F3 | Badges | `you/badges` | Summary (earned of total, progress) with Up next; 3-column grids for Streaks, Check-ins and Milestones; locked tiles show progress. |
| F4 | History | `you/history` | Month calendar of check-ins, tap day → list of that day's check-ins. |
| F5 | Settings **[D] Settings** | `settings` | Sections: AI plan builder, Reminders, Integrations, Plan & billing, Your data, Help, About. |
| F6 | AI key setup | `settings/ai` | Provider segmented (Gemini/OpenAI/Claude), key field (paste, masked), Test, daily limit stepper, on-device AI status, how-to-get-a-key links per provider, Remove key. |
| F7 | Integrations | `settings/integrations` | GitHub username, LeetCode username, Codeforces handle (public handles only, validated by a test fetch), Health Connect / HealthKit connect (steps permission). |
| F8 | Notifications | `settings/notifications` | From this phone: daily reminder time, missed-day note, streak at risk, challenge starting. From your squads: nudges, squad updates (digest), comments and fires, new members, milestones. |
| F9 | Plus paywall **[D] Plus** | modal `paywall/plus` | Free vs Plus table, Yearly (default, "save 33%") / Monthly, Start Plus, Restore, Squad Pro link, cancel note. Prices from RevenueCat offerings, never hard-coded. With `PAYMENTS_ENABLED=false`: same layout, prices shown from config, button "Plus is coming soon. Get notified". |
| F10 | Squad Pro paywall | modal `paywall/squad-pro` | For owners; pick squad; feature list. |
| F11 | Plan & billing | `settings/billing` | Current plan, renewal date, manage subscription (opens store), restore. |
| F12 | Blocked users | `settings/blocked` | List + Unblock. |
| F13 | Export my data | `settings/export` | Generates JSON on server, share sheet to save. |
| F14 | Delete account | `settings/delete` | Explains what is deleted, type DELETE to confirm, owner-transfer warning for owned squads. |
| F15 | Help & contact | `settings/help` | FAQ items, contact email, community guidelines. |
| F16 | Terms / Privacy / Licences | `settings/legal/[doc]` | In-app markdown pages. |

## G. System
| # | Screen | Notes |
|---|---|---|
| G1 | Offline banner | Thin bar under header: "Offline. Check-ins will sync when you're back." Pending check-ins show a small clock icon. |
| G2 | Force update | Blocking screen when API reports min supported version > current. |
| G3 | Maintenance / server error | Friendly full screen with retry. |
| G4 | Toasts | Success/info/error, bottom above tab bar, 3 s. |
| G5 | Permission denied states | Notifications, photos, health — explain + open settings. |

## H. Admin (internal, minimal)
No admin app in v1. Provide protected API endpoints (`/v1/admin/*`, allowed by `ADMIN_EMAILS`) plus a tiny static HTML page served by the Worker at `/admin` (vanilla JS, uses the admin session) to: list open reports, view target, hide content, suspend user, resolve report.
