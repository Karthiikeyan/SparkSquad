# Reference designs

15 screens at iPhone size (390 × 844), dark theme. They are the visual source of truth: copy colours, font sizes, weights, spacing, radii, icon choices and copy from these files when building the React Native screens.

| File | Screen | Route (see docs/03_SCREENS.md) |
|---|---|---|
| Main.dc.html | Today | `(tabs)/today` |
| CheckIn.dc.html | Check-in sheet | modal `checkin/[challengeId]` |
| Squad.dc.html | Squad board | `squad/[id]` |
| Leaderboard.dc.html | Leaderboard | `squad/[id]/leaderboard` |
| ShareCard.dc.html | Daily share card | `squad/[id]/share` |
| Plan.dc.html | Squad plan, day by day | `squad/[id]/plan` |
| CreateSquad.dc.html | Create squad: set up the plan | `create/plan` |
| ImportPlan.dc.html | Import plan (JSON) | `create/import` |
| AIPrompt.dc.html | Build with your AI (copy prompt) | `create/ai-prompt` |
| AIBuild.dc.html | In-app plan builder (BYOK) | `create/ai-build` |
| Welcome.dc.html | Welcome | `(auth)/welcome` |
| Discover.dc.html | Discover | `(tabs)/discover` |
| Profile.dc.html | You | `(tabs)/you` |
| Plus.dc.html | SparkSquad Plus paywall | modal `paywall/plus` |
| Settings.dc.html | Settings | `settings` |

## How to read these files
They are HTML with inline styles plus a small template layer from the design tool:
- Everything inside `<x-dc>` is the screen. Inline `style="…"` values are the exact design values (px → React Native density-independent units 1:1).
- `{{name}}` is a value computed in the `<script type="text/x-dc">` block at the bottom (`renderVals()`); read that script to see the data and per-item styles (for example avatar ring styles, day-strip states).
- `<sc-for list="{{items}}" as="item">` repeats its children for each item; `<sc-if value="{{cond}}">` shows children conditionally.
- `<a href="Other.dc.html">` marks navigation between screens.
- `<helmet>` holds the Google Fonts link (Bricolage Grotesque + Inter) and base CSS.
- Ignore the `support.js` script tag; it belongs to the design tool.

Names, numbers and dates are realistic placeholders; real data comes from the API.
