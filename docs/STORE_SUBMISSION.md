# Store submission pack

Everything to paste into Google Play Console and App Store Connect. Replace `<API>` with your production API URL, currently `https://sparksquad-api.sparksquad-api.workers.dev`. A custom domain looks more trustworthy to reviewers and users.

Policies checked November 2026. They change, so recheck each console's warnings when you submit. This is not legal advice; have a lawyer read the Terms and Privacy Policy before a public launch, and add your registered business name if you have one.

## URLs (deploy the API first)

| Purpose | URL |
| ------------------------------ | --------------------- |
| Privacy policy | `<API>/privacy` |
| Terms of use / EULA | `<API>/terms` |
| Account deletion | `<API>/delete-account` |
| Child safety standards (CSAE) | `<API>/child-safety` |
| Support | `<API>/support` |

## Reviewer sign-in

Reviewers can't read an inbox, so give them a fixed code on one demo account.

1. Run `pnpm exec wrangler secret put REVIEW_ACCOUNT` in `apps/api`, with a value like `review@yourdomain.com:482913`. Use a random code and an address only you control. The code works for that one address only.
2. In the app, sign in as that address and accept the terms. Create a squad with a template, invite code on, and make one check-in.
3. Put the address, code and invite code in the review notes below.
4. After approval, keep the secret: updates are reviewed too. Keep real data off this account.

## Review notes (both stores)

```
SparkSquad is a daily accountability app for adults: small squads follow a plan and check in every day.

Sign in: tap "Use my email instead", enter <EMAIL>, then enter code <CODE>.
The account already has a squad. To test joining, use invite code <INVITE>.

Moderation: open any check-in or member to Report or Block. Reports go to our admin queue and are reviewed within 24 hours. Text is filtered when posted.
Deleting an account: You > Settings > Delete account.
Steps: read on the device only to fill in step tasks, and included only in check-ins the user submits. Optional.
AI plan builder: optional, uses the user's own API key from the phone, and asks permission before sending anything.
Subscriptions: <"Plus is not on sale yet; buttons show interest only." or the product details>.
```

## Google Play

**Before production:** new personal accounts need a closed test with at least 12 testers for 14 days.

**App content**

| Section | Answer |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| Privacy policy | `<API>/privacy` |
| Ads | No ads |
| App access | Restricted: give the reviewer sign-in above |
| Content rating | Social or communication category; users interact, share content and location is not shared |
| Target audience | 18 and over only |
| News, government, financial features | No |
| Health apps | Yes. Activity and fitness: step counts fill in step tasks. Not a medical app. |
| Health Connect data | Steps (read only). Justification: "Fills in the user's daily step tasks automatically. Read only when connected, and only sent in a check-in the user submits." |
| Child safety standards | URL `<API>/child-safety`; in-app reporting: yes (Report > Child safety, and email); name yourself as the contact |
| Account deletion | Yes. URL `<API>/delete-account` |

**Data safety**

- Encrypted in transit: yes. Users can request deletion: yes. Data sold: no.
- Shared with third parties: no. Service providers acting for you don't count as sharing. AI requests go directly from the user's phone with their own key and with permission.

| Data | Collected | Optional? | Purpose |
| ---------------------------------------- | --------- | --------- | --------------------------- |
| Email address, name | Yes | Required | Account management |
| User IDs (username, account ID) | Yes | Required | Account management |
| Health and fitness: fitness info (steps) | Yes | Optional | App functionality |
| Photos (Plus only) | Yes | Optional | App functionality |
| Other user-generated content (notes, comments, plans) | Yes | Required | App functionality |
| App interactions | Yes | Optional (only if PostHog is on) | Analytics |
| Crash logs, diagnostics | Yes | Optional (only if Sentry is on) | Analytics |
| Device or other IDs (push token) | Yes | Required | App functionality |

If PostHog and Sentry stay off in the build, leave out their two rows.

**Listing**

- Title: `SparkSquad: Daily Squad Habits`
- Short description: `Follow a plan with your squad. Check in daily, keep your streak, show up together.`
- Full description:

```
Goals are easier when your squad can see you show up.

SparkSquad puts you in a small group that follows one plan. Check in every day, see who showed up, cheer each other on and keep your streak alive.

• Start from ready-made plans: DSA, aptitude, SQL, reading, meditation, gym, spoken English, exam revision, no-spend and more
• Build your own plan, or let AI draft one with your own key
• One tap check-ins, with reminders and streak freezes
• Board, leaderboard, reactions, comments and nudges
• Home-screen widget and weekly recap cards to share
• Works offline and syncs later

Free to use. For adults aged 18 and over.
```

- Graphics: `apps/mobile/assets/store/play-icon-512.png`, `play-feature-1024x500.png`. Take at least 2 phone screenshots from a real device.

## App Store

Needs an Apple Developer account (US$99/year). Build with Xcode 26 or later; EAS does this.

**Sign in with Apple is required** because Google sign-in exists (guideline 4.8). Turn it on (`SETUP.md` 3.4) before submitting. Until `features.apple` is on, the app hides Google on iPhone so it can't be rejected for this. Set `APPLE_APP_BUNDLE_IDENTIFIER` and `APPLE_CLIENT_SECRET` so deleting an account revokes Apple's tokens.

| Field | Answer |
| ------------------- | ----------------------------------------------------------------------------- |
| Category | Health & Fitness (or Productivity); secondary Social Networking |
| Age rating | Answer the current questionnaire: user-generated content yes, messaging yes. Expect 18+ if you state the app is restricted to adults |
| Privacy policy URL | `<API>/privacy` |
| Support URL | `<API>/support` |
| Licence agreement | Use the standard Apple EULA; your Terms add to it |
| EU trader status | Required to sell in the EU under the Digital Services Act: declare it in App Store Connect |
| Encryption | Already declared in the build (HTTPS only) |

**App privacy (nutrition labels).** None of this is used for tracking.

| Data | Linked to user | Purpose |
| ---------------------------------- | -------------- | ----------------- |
| Email address, name | Yes | App functionality |
| User ID | Yes | App functionality |
| Other user content, photos | Yes | App functionality |
| Health & Fitness (steps in check-ins) | Yes | App functionality |
| Product interaction, crash data (only if PostHog or Sentry are on) | Yes | Analytics |

**Metadata.** Subtitle: `Show up daily, with your squad`. Keywords: `habit,streak,accountability,group,challenge,goals,study,fitness,routine,daily`. Screenshots: 6.9-inch iPhone at minimum.

## Before you switch payments on

- Every purchase screen must show the price, period, what you get, and Terms and Privacy links. The links are in; check the prices display.
- Restore purchases is in.
- Plus photos are shared with the squad but aren't scanned, so text filtering doesn't cover them. Before launching Plus, add an image check (Cloudflare Workers AI has a free allowance) or keep review of reported photos under 24 hours.

## Your ongoing duties

- Check the `/admin` report queue daily. Both stores and your own Terms promise 24-hour review.
- Read child safety reports first. Act on them and report to the authorities as `/child-safety` says.
- Answer deletion requests sent by email within 7 days. Use the admin tools, or sign in to that account.
- Update `LEGAL_UPDATED` in `packages/shared/src/legal.ts` whenever you change legal text.
