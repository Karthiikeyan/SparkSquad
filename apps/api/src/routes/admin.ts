import { adminActionSchema } from '@sparksquad/shared';
import { and, asc, eq, gt, or } from 'drizzle-orm';
import { Hono, type MiddlewareHandler } from 'hono';
import { checkins, comments, reports, session, squads, user } from '../db/schema';
import type { AppEnv } from '../env';
import { errors } from '../lib/errors';
import { body, db, nowIso } from '../lib/http';
import { isAdmin } from '../services/dto';
import { deleteTokensForUser } from '../services/notify';

export const adminRoutes = new Hono<AppEnv>();

const REPORTS_PAGE = 100;

const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const row = await db(c)
    .select({ email: user.email, emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.id, c.get('user').id))
    .get();
  if (!row || !isAdmin(c.env.ADMIN_EMAILS, row)) throw errors.forbidden('Admins only.');
  await next();
};

adminRoutes.use('*', requireAdmin);

async function targetPreview(
  d: ReturnType<typeof db>,
  type: string,
  id: string,
): Promise<Record<string, unknown> | null> {
  switch (type) {
    case 'user': {
      const u = await d.select().from(user).where(eq(user.id, id)).get();
      return u
        ? {
            name: u.displayName || u.name,
            username: u.username,
            email: u.email,
            suspendedAt: u.suspendedAt,
          }
        : null;
    }
    case 'checkin': {
      const r = await d.select().from(checkins).where(eq(checkins.id, id)).get();
      return r
        ? { userId: r.userId, note: r.note, localDate: r.localDate, hiddenAt: r.hiddenAt }
        : null;
    }
    case 'comment': {
      const r = await d.select().from(comments).where(eq(comments.id, id)).get();
      return r ? { userId: r.userId, body: r.body, hiddenAt: r.hiddenAt } : null;
    }
    case 'squad': {
      const r = await d.select().from(squads).where(eq(squads.id, id)).get();
      return r
        ? { ownerId: r.ownerId, name: r.name, description: r.description, hiddenAt: r.hiddenAt }
        : null;
    }
    default:
      return null;
  }
}

adminRoutes.get('/reports', async (c) => {
  const d = db(c);
  const status = c.req.query('status') === 'all' ? undefined : 'open';
  // Keyset cursor "createdAt|id" so a flood of reports cannot hide later ones.
  const [afterAt, afterId] = (c.req.query('cursor') ?? '').split('|');
  const rows = await d
    .select()
    .from(reports)
    .where(
      and(
        status ? eq(reports.status, status) : undefined,
        afterAt && afterId
          ? or(
              gt(reports.createdAt, afterAt),
              and(eq(reports.createdAt, afterAt), gt(reports.id, afterId)),
            )
          : undefined,
      ),
    )
    .orderBy(asc(reports.createdAt), asc(reports.id))
    .limit(REPORTS_PAGE)
    .all();
  const out = [];
  for (const r of rows)
    out.push({ ...r, target: await targetPreview(d, r.targetType, r.targetId) });
  const last = rows[rows.length - 1];
  const nextCursor = rows.length === REPORTS_PAGE && last ? `${last.createdAt}|${last.id}` : null;
  return c.json({ reports: out, nextCursor });
});

/** Owner of the reported content (for "suspend"). */
async function ownerOf(d: ReturnType<typeof db>, type: string, id: string): Promise<string | null> {
  if (type === 'user') return id;
  if (type === 'checkin')
    return (
      (await d.select({ u: checkins.userId }).from(checkins).where(eq(checkins.id, id)).get())?.u ??
      null
    );
  if (type === 'comment')
    return (
      (await d.select({ u: comments.userId }).from(comments).where(eq(comments.id, id)).get())?.u ??
      null
    );
  if (type === 'squad')
    return (
      (await d.select({ u: squads.ownerId }).from(squads).where(eq(squads.id, id)).get())?.u ?? null
    );
  return null;
}

adminRoutes.post('/reports/:id', async (c) => {
  const { action } = await body(c, adminActionSchema);
  const d = db(c);
  const report = await d
    .select()
    .from(reports)
    .where(eq(reports.id, c.req.param('id')))
    .get();
  if (!report) throw errors.notFound('That report');
  const ts = nowIso();
  if (action === 'hide') {
    if (report.targetType === 'checkin')
      await d
        .update(checkins)
        .set({ hiddenAt: ts, updatedAt: ts })
        .where(eq(checkins.id, report.targetId))
        .run();
    if (report.targetType === 'comment')
      await d.update(comments).set({ hiddenAt: ts }).where(eq(comments.id, report.targetId)).run();
    if (report.targetType === 'squad')
      await d
        .update(squads)
        .set({ hiddenAt: ts, updatedAt: ts })
        .where(eq(squads.id, report.targetId))
        .run();
  }
  if (action === 'suspend') {
    const target = await ownerOf(d, report.targetType, report.targetId);
    if (target) {
      await d
        .update(user)
        .set({ suspendedAt: ts, updatedAt: new Date() })
        .where(eq(user.id, target))
        .run();
      await deleteTokensForUser(d, target);
      // Revoke every Better Auth session so /api/auth/* is closed too, not just /v1.
      await d.delete(session).where(eq(session.userId, target)).run();
    }
  }
  const status = action === 'hide' ? 'hidden' : action === 'suspend' ? 'suspended' : 'dismissed';
  // Resolve every open report about the same target.
  await d
    .update(reports)
    .set({ status, resolvedAt: ts })
    .where(
      and(
        eq(reports.targetType, report.targetType),
        eq(reports.targetId, report.targetId),
        eq(reports.status, 'open'),
      ),
    )
    .run();
  return c.json({ ok: true, status });
});
