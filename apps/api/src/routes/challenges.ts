import {
  HARD_CAPS,
  addDays,
  createChallengeSchema,
  editDaySchema,
  endDate,
  exportPlan,
  leaderboardQuerySchema,
  localDateInZone,
  parsePlan,
  parsePlanDay,
  planFileName,
  rawDayNumber,
  ulid,
  type LeaderboardResponse,
} from '@sparksquad/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { challenges, planDayEdits, squads, user } from '../db/schema';
import type { AppEnv } from '../env';
import { ApiError, errors } from '../lib/errors';
import { body, db, nowIso, query } from '../lib/http';
import { assertClean, blockedByMe, requireMember, takeUsage } from '../services/access';
import { toChallenge, toPublicUser } from '../services/dto';
import { leaderboard } from '../services/leaderboard';
import { dayEdits, effectivePlanFor, loadPlan, planShape, storePlan } from '../services/plans';
import { activeChallenge } from '../services/squads';
import { finishChallenge } from '../cron/rollup';

export const challengeRoutes = new Hono<AppEnv>();

async function myTimezone(c: Parameters<typeof db>[0]): Promise<string> {
  const row = await db(c)
    .select({ tz: user.timezone })
    .from(user)
    .where(eq(user.id, c.get('user').id))
    .get();
  return row?.tz ?? 'UTC';
}

async function loadChallenge(
  c: Parameters<typeof db>[0],
  roles?: ('owner' | 'admin' | 'member')[],
) {
  const d = db(c);
  const ch = await d
    .select()
    .from(challenges)
    .where(eq(challenges.id, c.req.param('id')!))
    .get();
  if (!ch) throw errors.notFound('That challenge');
  const access = await requireMember(d, ch.squadId, c.get('user').id, roles);
  return { d, ch, ...access };
}

/** POST /v1/squads/:id/challenges */
export async function createChallenge(c: Parameters<typeof db>[0]) {
  const input = await body(c, createChallengeSchema);
  const d = db(c);
  const me = c.get('user');
  const { squad } = await requireMember(d, c.req.param('id')!, me.id, ['owner', 'admin']);
  const running = await activeChallenge(d, squad.id);
  // The nightly job keeps a finished challenge open two extra days for late check-ins; an owner
  // starting the next one closes it straight away.
  const owner = running ? await d.select().from(user).where(eq(user.id, me.id)).get() : undefined;
  const finished =
    running &&
    owner &&
    endDate(running.startDate, running.durationDays) < localDateInZone(new Date(), owner.timezone);
  if (running && finished) await finishChallenge(c.env, d, running);
  else if (running) {
    throw errors.conflict(
      'CHALLENGE_ALREADY_ACTIVE',
      'This squad already has a challenge running. End it first.',
    );
  }
  const parsed = parsePlan(input.plan);
  if (!parsed.ok)
    throw new ApiError(
      422,
      'PLAN_INVALID',
      parsed.errors[0] ?? 'That plan isn’t valid.',
      parsed.errors,
    );
  const plan = parsed.plan;
  assertClean(
    plan.title,
    plan.goal,
    ...plan.days.flatMap((day) => [day.title, ...day.tasks.map((t) => t.title)]),
  );

  const today = localDateInZone(new Date(), await myTimezone(c));
  if (input.startDate < addDays(today, -7) || input.startDate > addDays(today, 90)) {
    throw errors.badRequest('Pick a start date within the next 90 days.');
  }
  // Every challenge writes a permanent plan object to R2; cap creations per user per day.
  if (
    !(await takeUsage(
      d,
      me.id,
      new Date().toISOString().slice(0, 10),
      'challenge_create',
      HARD_CAPS.challengesCreatedPerUserPerDay,
    ))
  ) {
    throw errors.rateLimited();
  }
  const id = ulid();
  const { key, hash } = await storePlan(c.env, id, plan);
  const shape = planShape(plan);
  const ts = nowIso();
  await d
    .insert(challenges)
    .values({
      id,
      squadId: squad.id,
      title: plan.title,
      planKey: key,
      planHash: hash,
      planVersion: plan.sparksquad_plan,
      durationDays: plan.duration_days,
      daysPerWeek: plan.days_per_week,
      restDays: JSON.stringify(shape.restDays),
      taskCounts: JSON.stringify(shape.taskCounts),
      startDate: input.startDate,
      createdBy: me.id,
      createdAt: ts,
      updatedAt: ts,
    })
    .run();
  await d.update(squads).set({ updatedAt: ts }).where(eq(squads.id, squad.id)).run();
  const row = await d.select().from(challenges).where(eq(challenges.id, id)).get();
  return c.json({ challenge: toChallenge(row!), fixes: parsed.fixes, stats: parsed.stats }, 201);
}

challengeRoutes.get('/:id/plan', async (c) => {
  const { ch } = await loadChallenge(c);
  const etag = `"${ch.planHash}"`;
  if (c.req.header('if-none-match') === etag) return c.body(null, 304);
  const plan = await loadPlan(c.env, ch.planKey);
  c.header('ETag', etag);
  c.header('Cache-Control', 'private, max-age=31536000, immutable');
  return c.json(plan);
});

challengeRoutes.put('/:id/days/:n', async (c) => {
  const input = await body(c, editDaySchema);
  const { d, ch } = await loadChallenge(c, ['owner', 'admin']);
  const n = Number(c.req.param('n'));
  if (!Number.isInteger(n) || n < 1 || n > ch.durationDays) throw errors.notFound('That day');
  if (ch.status !== 'active')
    throw errors.conflict('CHALLENGE_NOT_ACTIVE', 'This challenge has ended.');
  const today = localDateInZone(new Date(), await myTimezone(c));
  if (n <= rawDayNumber(today, ch.startDate)) {
    throw errors.conflict(
      'DAY_LOCKED',
      'Past days and today are locked. You can edit days from tomorrow on.',
    );
  }
  const parsed = parsePlanDay(input, n);
  if (!parsed.ok) throw new ApiError(422, 'PLAN_INVALID', parsed.errors[0]!, parsed.errors);
  assertClean(parsed.day.title, ...parsed.day.tasks.map((t) => t.title));
  const ts = nowIso();
  await d
    .insert(planDayEdits)
    .values({
      challengeId: ch.id,
      dayNumber: n,
      dayJson: JSON.stringify(parsed.day),
      editedBy: c.get('user').id,
      updatedAt: ts,
    })
    .onConflictDoUpdate({
      target: [planDayEdits.challengeId, planDayEdits.dayNumber],
      set: { dayJson: JSON.stringify(parsed.day), editedBy: c.get('user').id, updatedAt: ts },
    })
    .run();
  const shape = planShape(await effectivePlanFor(c.env, d, ch));
  await d
    .update(challenges)
    .set({
      restDays: JSON.stringify(shape.restDays),
      taskCounts: JSON.stringify(shape.taskCounts),
      updatedAt: ts,
    })
    .where(eq(challenges.id, ch.id))
    .run();
  return c.json({ day: parsed.day, fixes: parsed.fixes });
});

challengeRoutes.post('/:id/end', async (c) => {
  const { d, ch } = await loadChallenge(c, ['owner']);
  if (ch.status !== 'active')
    throw errors.conflict('CHALLENGE_NOT_ACTIVE', 'This challenge has already ended.');
  await finishChallenge(c.env, d, ch);
  const row = await d.select().from(challenges).where(eq(challenges.id, ch.id)).get();
  return c.json(toChallenge(row!));
});

challengeRoutes.get('/:id/export', async (c) => {
  const { d, ch } = await loadChallenge(c);
  const plan = await loadPlan(c.env, ch.planKey);
  const text = exportPlan(plan, await dayEdits(d, ch.id));
  c.header('Content-Type', 'application/json; charset=utf-8');
  c.header('Content-Disposition', `attachment; filename="${planFileName(plan.title)}"`);
  return c.body(text);
});

challengeRoutes.get('/:id/leaderboard', async (c) => {
  const { range } = query(c, leaderboardQuerySchema);
  const { d, ch } = await loadChallenge(c);
  const me = c.get('user');
  const exclude = new Set(await blockedByMe(d, me.id));
  const result = await leaderboard(d, ch, range, await myTimezone(c), exclude);
  const response: LeaderboardResponse = {
    range,
    from: result.range.from,
    to: result.range.to,
    entries: result.rows.map((r) => ({
      rank: r.rank,
      user: toPublicUser(r.user),
      daysDone: r.daysDone,
      daysElapsed: r.daysElapsed,
      tasksDone: r.tasksDone,
      score: r.score,
      isMe: r.userId === me.id,
    })),
  };
  return c.json(response);
});
