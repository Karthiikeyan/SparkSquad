/**
 * Legal text, shared so the app screens and the public web pages (which both stores require) can
 * never disagree. `{{email}}` is filled with the contact address. Paragraphs split on a blank line.
 */
export const LEGAL_UPDATED = 'November 2026';

export const LEGAL_DOCS = {
  terms: {
    title: 'Terms of Use',
    body: `SparkSquad is a SparkTribe product that helps adults keep daily commitments with a small group. By using SparkSquad you agree to these terms.

Who can use SparkSquad. You must be 18 or older. One account per person. Keep your sign-in secure; you are responsible for activity on your account.

Your content. You own the notes, comments, plans and photos you add. You give us permission to store them and show them to the members of your squads so the app can work. Remove content at any time; delete your account to remove everything.

Zero tolerance. Do not post harassment, hate, threats, sexual content, spam or anything illegal, and do not impersonate others. Any content that sexualises or endangers a child is banned and is reported to the authorities. Anyone can report content or block a person. We review reports within 24 hours and remove content and accounts that break these rules, without warning.

Squads. Owners and admins manage their squads and can remove members. Squad chat links point to WhatsApp or Telegram, which have their own terms.

AI and integrations. If you add your own AI key or public usernames, requests go from your phone to that provider under its terms. The app asks before it first sends anything to an AI provider. We never receive your AI key.

Health and wellbeing. SparkSquad is for motivation, not medical advice. Check with a doctor before starting a fitness or health plan. Plans in the app, including templates and AI plans, may not suit you; use your judgement.

Paid plans. Plus and Squad Pro are auto-renewing subscriptions billed by Apple or Google. The price and period are shown before you buy. A subscription renews unless you cancel at least 24 hours before the period ends. Manage or cancel in your store account. Deleting your account does not cancel a subscription.

Apple devices. If you got the app from the App Store, these terms are between you and us, not Apple. Apple has no duty to maintain or support the app, and is not responsible for claims about it. Apple and its subsidiaries are third-party beneficiaries of these terms and may enforce them. Apple's standard licence terms also apply where these terms don't cover something.

No guarantees. SparkSquad is provided as is. We work hard to keep it running and your data safe, but we can't promise it will always be available.

Changes. We may update these terms and will tell you in the app when we do.

Contact. Questions or complaints: {{email}}.`,
  },
  privacy: {
    title: 'Privacy Policy',
    body: `This policy covers the SparkSquad app, a SparkTribe product. We do not sell your data, we show no ads and we do not track you across other apps or websites.

What we collect. Your email, name, username, avatar colour, timezone, interests and reminder time; the squads you join; your check-ins, notes, reactions, comments and nudges; the public usernames you connect; and push notification tokens. We do not collect phone numbers or contacts.

Sign-in. If you use Google or Apple, they confirm your identity and give us your name and email. Apple can hide your real email from us.

What stays on your phone. Free plan photo proofs, your AI key, drafts and calendar choices stay on your phone. Plus photo proofs are uploaded so your squad can see them, and are deleted after 30 days (90 for Squad Pro).

Steps and health data. If you connect Health Connect or Apple Health, the app reads only your step count, on your phone, to fill in step tasks. Nothing is written to them. A step count leaves your phone only when you submit a check-in containing it; it is then stored with that check-in and your squad can see it. It is never used for advertising or sold, and you can disconnect at any time in Settings.

Third-party AI. The AI plan builder is optional. If you add your own key, the app asks your permission first, then sends what you type and your plan details straight from your phone to the provider you chose (Google Gemini, Groq, OpenRouter, OpenAI or Anthropic). We never see these requests. That provider handles them under its own privacy policy.

Connected accounts. If you add a GitHub, LeetCode or Codeforces username, your phone looks up that public profile on the site directly to tick off tasks. We store only the username.

How we use it. To run your squads, show your progress to your squad, send reminders and nudges, keep the service safe, and improve the app.

Who sees it. Members of your squads see your name, avatar, check-ins and comments. Public squad listings show the squad name, description and member count.

Service providers. Cloudflare (hosting and storage, servers worldwide), Resend (sign-in emails), Expo (push delivery), and PostHog (usage events linked to a random account ID, which you can turn off in Settings) and Sentry (crash reports) when enabled. Payments go through Apple or Google, and we never see your card.

Retention. Comments are deleted after 30 days (90 for paid squads), notifications after 30 days, exports after 1 day. Old check-ins are rolled up into summaries after a challenge ends.

Deleting your account. Delete it in Settings, or follow the steps at {{deleteUrl}}. We delete your profile, check-ins, comments, photos, streaks, badges, connected usernames and push tokens straight away, and any remaining copies in backups within 30 days. Squads you own pass to another member. Details of content reported as illegal may be kept where the law requires it.

Your rights. You can see, correct, export and delete your data from Settings, withdraw any permission, and name someone to act for you. If you are in India you can also complain to the Data Protection Board of India; in the EU or UK, to your data protection authority.

Children. SparkSquad is for adults aged 18 and over. If we learn an account belongs to someone younger, we delete it. See our child safety standards at {{childSafetyUrl}}.

Security. Data is encrypted in transit, your AI key is kept in your phone's secure storage, and access to our systems is restricted.

Grievances and contact. Email our grievance contact at {{email}}. We respond within 7 days.`,
  },
  guidelines: {
    title: 'Community guidelines',
    body: `SparkSquad works because squads are kind and honest.

Cheer people on. Reactions, comments and nudges are for encouragement.

Be honest about your check-ins. An honest miss beats a fake tick.

No harassment, hate, threats, sexual content, spam or impersonation. We remove it and the accounts behind it.

Keep children safe. SparkSquad is for adults, and anything that sexualises or endangers a child means an immediate ban and a report to the authorities.

Respect privacy. Don't share other people's details or photos without asking.

Report anything that breaks these rules. We review every report within 24 hours.`,
  },
  childSafety: {
    title: 'Child safety standards',
    body: `SparkSquad, a SparkTribe product, has zero tolerance for child sexual abuse and exploitation (CSAE), including child sexual abuse material (CSAM), grooming, sextortion and any content that sexualises a minor.

Adults only. SparkSquad is for people aged 18 and over. Everyone confirms their age before using the app, and we delete accounts that we learn belong to someone younger.

Prevention. Text is filtered before it is posted. Squads are small and show who is in them, and photos are visible only to squad members and are deleted automatically.

How to report. In the app, open the content or the person's profile, choose Report, then "Child safety". You can also email {{email}} at any time, with or without an account. Reports are private.

What we do. We review child safety reports first, and within 24 hours. When we learn of CSAM or CSAE we remove it, permanently ban the accounts involved, keep only what the law requires and report it to the relevant authorities, including India's National Cyber Crime Reporting Portal (cybercrime.gov.in) and the US National Center for Missing and Exploited Children where applicable.

If a child is in immediate danger, call your local emergency number first. In India, call 112 or the Childline on 1098.

Contact. Our child safety contact can be reached at {{email}}.`,
  },
} as const;

export type LegalDoc = keyof typeof LEGAL_DOCS;

export interface LegalVars {
  email: string;
  deleteUrl: string;
  childSafetyUrl: string;
}

export function legalParagraphs(doc: LegalDoc, vars: LegalVars): string[] {
  return LEGAL_DOCS[doc].body
    .replace(/\{\{email\}\}/g, vars.email)
    .replace(/\{\{deleteUrl\}\}/g, vars.deleteUrl)
    .replace(/\{\{childSafetyUrl\}\}/g, vars.childSafetyUrl)
    .split('\n\n');
}
