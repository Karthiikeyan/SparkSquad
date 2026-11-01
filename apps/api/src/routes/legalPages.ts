import { LEGAL_DOCS, LEGAL_UPDATED, legalParagraphs, type LegalDoc } from '@sparksquad/shared';
import { Hono, type Context } from 'hono';
import type { AppEnv } from '../env';

/**
 * Public pages the stores require at a stable URL with no login: privacy policy, terms, account
 * deletion, child safety standards and support. Static text, so no script is allowed to run.
 */
export const legalPages = new Hono<AppEnv>();

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!,
  );
}

function page(c: Context<AppEnv>, title: string, bodyHtml: string) {
  c.header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
  c.header('Cache-Control', 'public, max-age=3600');
  return c.html(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} | SparkSquad</title>
<style>
body{margin:0;background:#000;color:#F5F5F7;font:16px/1.6 Inter,system-ui,sans-serif}
main{max-width:680px;margin:0 auto;padding:32px 20px 64px}
h1{font-size:30px;line-height:1.2;margin:0 0 4px}h2{font-size:18px;margin:28px 0 4px}
.muted{color:#A1A1A8}a{color:#FFB224}
nav{margin-top:40px;padding-top:16px;border-top:1px solid #2A2A2E;font-size:14px}
nav a{margin-right:14px;display:inline-block}
</style></head>
<body><main>
<p class="muted">SparkSquad by SparkTribe</p>
<h1>${escapeHtml(title)}</h1>
${bodyHtml}
<nav>
<a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/guidelines">Guidelines</a><a href="/child-safety">Child safety</a><a href="/delete-account">Delete account</a><a href="/support">Support</a>
</nav>
</main></body></html>`);
}

function legalDoc(c: Context<AppEnv>, doc: LegalDoc) {
  const origin = new URL(c.req.url).origin;
  const paragraphs = legalParagraphs(doc, {
    email: c.env.CONTACT_EMAIL,
    deleteUrl: `${origin}/delete-account`,
    childSafetyUrl: `${origin}/child-safety`,
  });
  return page(
    c,
    LEGAL_DOCS[doc].title,
    `<p class="muted">Last updated ${LEGAL_UPDATED}.</p>${paragraphs
      .map((p) => `<p>${escapeHtml(p)}</p>`)
      .join('')}`,
  );
}

legalPages.get('/privacy', (c) => legalDoc(c, 'privacy'));
legalPages.get('/terms', (c) => legalDoc(c, 'terms'));
legalPages.get('/guidelines', (c) => legalDoc(c, 'guidelines'));
legalPages.get('/child-safety', (c) => legalDoc(c, 'childSafety'));

legalPages.get('/delete-account', (c) => {
  const email = escapeHtml(c.env.CONTACT_EMAIL);
  const subject = encodeURIComponent('Delete my SparkSquad account');
  return page(
    c,
    'Delete your SparkSquad account',
    `<h2>In the app</h2>
<p>Open SparkSquad, go to You, then Settings, then Delete account. Type DELETE to confirm. Your account is deleted straight away.</p>
<h2>Without the app</h2>
<p>You don't need to reinstall anything. <a href="mailto:${email}?subject=${subject}">Email ${email}</a> from the address you sign in with and ask us to delete your account. We reply to confirm it is you, then delete it within 7 days.</p>
<h2>What is deleted</h2>
<p>Your profile, check-ins, comments, reactions, photos, streaks, badges, connected usernames, notifications and push tokens. Any remaining copies in backups are gone within 30 days. Squads you own pass to another member, or are deleted if nobody else is in them.</p>
<h2>What may be kept</h2>
<p>Details of content reported as illegal, where the law requires it. Apple and Google keep their own payment records.</p>
<h2>If you have a subscription</h2>
<p>Deleting your account does not cancel it. Cancel Plus or Squad Pro first in your Apple or Google Play subscriptions.</p>`,
  );
});

legalPages.get('/support', (c) => {
  const email = escapeHtml(c.env.CONTACT_EMAIL);
  return page(
    c,
    'Support',
    `<p>Need help with SparkSquad, or want to report a problem? <a href="mailto:${email}">Email ${email}</a>. We respond within 7 days, and within 24 hours for safety reports.</p>
<h2>In the app</h2>
<p>Go to You, then Settings, then Help &amp; contact. To report a person or content, open it and choose Report.</p>
<h2>Subscriptions</h2>
<p>Plus and Squad Pro are billed by Apple or Google. Manage or cancel them in your store account.</p>`,
  );
});
