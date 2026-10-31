import { HARD_CAPS, isInviteCode, normalizeInviteCode } from '@sparksquad/shared';
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { verifyFileToken } from '../services/r2';

/** Public, unauthenticated routes: invite landing pages and HMAC-signed file access. */
export const publicRoutes = new Hono<AppEnv>();

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!,
  );
}

publicRoutes.get('/join/:code', (c) => {
  const code = normalizeInviteCode(c.req.param('code'));
  if (!isInviteCode(code)) return c.text('Invite not found', 404);
  const deep = `sparksquad://join/${code}`;
  const safe = escapeHtml(code);
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Join my squad on SparkSquad</title>
<meta property="og:title" content="Join my squad on SparkSquad">
<meta property="og:description" content="Show up daily, with your squad. Invite code ${safe}.">
<style>
body{margin:0;background:#000;color:#F5F5F7;font-family:Inter,system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center}
main{max-width:360px;padding:24px;text-align:center}
h1{font-size:28px;margin:0 0 8px}p{color:#A1A1A8;line-height:22px}
.code{font-size:40px;font-weight:700;letter-spacing:6px;color:#FFB224;margin:16px 0}
a.btn{display:block;height:52px;line-height:52px;border-radius:14px;background:#FFB224;color:#1A1200;font-weight:600;text-decoration:none;margin-top:12px}
a.sec{background:#1C1C1F;color:#F5F5F7}
</style></head>
<body><main>
<h1>Join my squad</h1>
<p>Open SparkSquad and enter this invite code, or tap the button below.</p>
<div class="code">${safe}</div>
<a class="btn" href="${deep}">Open SparkSquad</a>
<a class="btn sec" href="${escapeHtml(c.env.ANDROID_STORE_URL)}">Get it on Google Play</a>
<a class="btn sec" href="${escapeHtml(c.env.IOS_STORE_URL)}">Download on the App Store</a>
</main>
<script>setTimeout(function(){location.href=${JSON.stringify(deep)}},300);</script>
</body></html>`;
  c.header(
    'Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
  );
  return c.html(html);
});

function fileKey(path: string): string {
  return path
    .replace(/^\/files\//, '')
    .split('/')
    .map(decodeURIComponent)
    .join('/');
}

publicRoutes.put('/files/*', async (c) => {
  const key = fileKey(c.req.path);
  const exp = Number(c.req.query('exp'));
  const sig = c.req.query('sig') ?? '';
  const contentType = c.req.header('content-type') ?? '';
  if (!(await verifyFileToken(c.env, 'PUT', key, exp, sig, contentType)))
    return c.text('Forbidden', 403);
  if (!(HARD_CAPS.uploadContentTypes as readonly string[]).includes(contentType))
    return c.text('Unsupported type', 415);
  const length = Number(c.req.header('content-length') ?? '0');
  if (length > HARD_CAPS.uploadMaxBytes) return c.text('Too large', 413);
  const buf = await c.req.arrayBuffer();
  if (buf.byteLength > HARD_CAPS.uploadMaxBytes) return c.text('Too large', 413);
  await c.env.BUCKET.put(key, buf, { httpMetadata: { contentType } });
  return c.body(null, 200);
});

publicRoutes.get('/files/*', async (c) => {
  const key = fileKey(c.req.path);
  const exp = Number(c.req.query('exp'));
  const sig = c.req.query('sig') ?? '';
  if (!(await verifyFileToken(c.env, 'GET', key, exp, sig))) return c.text('Forbidden', 403);
  const obj = await c.env.BUCKET.get(key);
  if (!obj) return c.text('Not found', 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'private, max-age=3600');
  return new Response(obj.body, { headers });
});
