import { HARD_CAPS } from '@sparksquad/shared';
import { Hono, type MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';
import { runHourly } from './cron/hourly';
import type { AppEnv } from './env';
import { authGate } from './lib/authGate';
import { ApiError } from './lib/errors';
import { ipRateLimit, requireAuth, requireConsent } from './lib/http';
import { adminRoutes } from './routes/admin';
import { challengeRoutes, createChallenge } from './routes/challenges';
import { checkinRoutes, commentRoutes } from './routes/checkins';
import { configRoutes } from './routes/config';
import { meRoutes } from './routes/me';
import {
  discoverRoutes,
  integrationRoutes,
  notificationRoutes,
  nudgeRoutes,
  pushRoutes,
  safetyRoutes,
  uploadRoutes,
} from './routes/misc';
import { legalPages } from './routes/legalPages';
import { publicRoutes } from './routes/public';
import { squadRoutes } from './routes/squads';
import { syncRoutes } from './routes/sync';
import { webhookRoutes } from './routes/webhooks';

const app = new Hono<AppEnv>();

export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

const requireAppVersion: MiddlewareHandler<AppEnv> = async (c, next) => {
  const v = c.req.header('x-app-version');
  if (v && compareVersions(v, c.env.MIN_APP_VERSION) < 0) {
    throw new ApiError(426, 'APP_UPDATE_REQUIRED', 'Please update SparkSquad to keep using it.');
  }
  await next();
};

const consentForWrites: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.req.method === 'GET') return next();
  return requireConsent(c, next);
};

app.use('*', secureHeaders({ crossOriginResourcePolicy: false }));

app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      err.status,
    );
  }
  if (err instanceof HTTPException) {
    return c.json({ error: { code: 'BAD_REQUEST', message: err.message } }, err.status);
  }
  console.error('unhandled', err instanceof Error ? `${err.name}: ${err.message}` : 'unknown');
  return c.json(
    { error: { code: 'INTERNAL', message: 'Something went wrong on our side. Try again.' } },
    500,
  );
});

app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Not found.' } }, 404));

app.get('/health', (c) => c.json({ ok: true }));

app.use('/api/auth/*', ipRateLimit);
app.on(['GET', 'POST'], '/api/auth/*', authGate);

/** Rejects oversized bodies before anything buffers or parses them. */
const v1BodyLimit: MiddlewareHandler<AppEnv> = (c, next) =>
  bodyLimit({
    maxSize:
      c.req.method === 'POST' && /^\/v1\/squads\/[^/]+\/challenges$/.test(c.req.path)
        ? HARD_CAPS.planRequestMaxBytes
        : HARD_CAPS.requestBodyMaxBytes,
    onError: (ctx) =>
      ctx.json({ error: { code: 'BAD_REQUEST', message: 'That request is too large.' } }, 413),
  })(c, next);

app.use('/webhooks/*', bodyLimit({ maxSize: HARD_CAPS.requestBodyMaxBytes }));
app.route('/webhooks', webhookRoutes);
app.route('/', publicRoutes);
app.route('/', legalPages);
app.get('/admin', async (c) => {
  const asset = await c.env.ASSETS.fetch(new Request(new URL('/admin/index.html', c.req.url)));
  // Copy so middleware can set security headers (asset responses are immutable).
  return new Response(asset.body, { status: asset.status, headers: new Headers(asset.headers) });
});

const v1 = new Hono<AppEnv>();
v1.use('*', ipRateLimit, requireAppVersion, v1BodyLimit);
v1.route('/config', configRoutes);
v1.use('*', requireAuth);
v1.route('/me', meRoutes);
v1.route('/sync', syncRoutes);
v1.use('/squads/*', consentForWrites);
v1.post('/squads/:id/challenges', createChallenge);
v1.route('/squads', squadRoutes);
v1.route('/', discoverRoutes);
v1.use('/challenges/*', consentForWrites);
v1.route('/challenges', challengeRoutes);
v1.use('/checkins/*', consentForWrites);
v1.route('/checkins', checkinRoutes);
v1.route('/comments', commentRoutes);
v1.use('/nudges/*', consentForWrites);
v1.route('/nudges', nudgeRoutes);
v1.use('/uploads/*', consentForWrites);
v1.route('/uploads', uploadRoutes);
v1.route('/push-tokens', pushRoutes);
v1.route('/', safetyRoutes);
v1.route('/integrations', integrationRoutes);
v1.route('/notifications', notificationRoutes);
v1.route('/admin', adminRoutes);
app.route('/v1', v1);

export default {
  fetch: app.fetch,
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runHourly(env, new Date(controller.scheduledTime)));
  },
} satisfies ExportedHandler<AppEnv['Bindings']>;

export { app };
