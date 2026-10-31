import {
  HARD_CAPS,
  announcementSchema,
  createSquadSchema,
  decideRequestSchema,
  joinSquadSchema,
  normalizeInviteCode,
  setRoleSchema,
  transferSchema,
  ulid,
  updateSquadSchema,
  type BadgeId,
  type SquadMemberStatsDTO,
  type SquadPreviewDTO,
} from '@sparksquad/shared';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Db } from '../db/client';
import {
  announcements,
  badges,
  challenges,
  memberSummary,
  squadMembers,
  squads,
  streaks,
  user,
} from '../db/schema';
import type { AppEnv } from '../env';
import { ApiError, errors } from '../lib/errors';
import { body, db, nowIso } from '../lib/http';
import {
  assertCanJoin,
  assertCanOwn,
  assertClean,
  blockedByMe,
  requireMember,
} from '../services/access';
import { toChallenge, toMember, toPublicUser, toSquad } from '../services/dto';
import { addNotification, addNotificationIf } from '../services/notify';
import { activeChallenge, managerIds, recountMembers, uniqueInviteCode } from '../services/squads';
import { memberConsistency } from '../services/leaderboard';

export const squadRoutes = new Hono<AppEnv>();

type SquadRow = typeof squads.$inferSelect;

export async function buildPreview(
  d: Db,
  sq: SquadRow,
  viewerId: string,
): Promise<SquadPreviewDTO> {
  const owner = await d.select().from(user).where(eq(user.id, sq.ownerId)).get();
  const ch = await activeChallenge(d, sq.id);
  const mine = await d
    .select({ status: squadMembers.status })
    .from(squadMembers)
    .where(and(eq(squadMembers.squadId, sq.id), eq(squadMembers.userId, viewerId)))
    .get();
  return {
    id: sq.id,
    name: sq.name,
    description: sq.description,
    rules: sq.rules,
    category: sq.category,
    privacy: sq.privacy,
    memberCount: sq.memberCount,
    memberLimit: sq.memberLimit,
    owner: owner
      ? toPublicUser(owner)
      : { id: sq.ownerId, username: null, displayName: 'Owner', avatarColor: 0 },
    challenge: ch
      ? {
          id: ch.id,
          title: ch.title,
          durationDays: ch.durationDays,
          startDate: ch.startDate,
          daysPerWeek: ch.daysPerWeek,
        }
      : null,
    myStatus: mine?.status ?? null,
  };
}

squadRoutes.post('/', async (c) => {
  const input = await body(c, createSquadSchema);
  const d = db(c);
  const me = c.get('user');
  assertClean(input.name, input.description, input.rules);
  await assertCanOwn(d, me.id);
  await assertCanJoin(d, me.id);
  const id = ulid();
  const ts = nowIso();
  const code = await uniqueInviteCode(d);
  await d.batch([
    d.insert(squads).values({
      id,
      name: input.name,
      description: input.description ?? '',
      rules: input.rules ?? '',
      category: input.category,
      privacy: input.privacy,
      ownerId: me.id,
      inviteCode: code,
      chatUrl: input.chatUrl ?? null,
      memberLimit: input.memberLimit ?? HARD_CAPS.maxMembersPerSquad,
      memberCount: 1,
      allowPersonalTargets: input.allowPersonalTargets ?? true,
      partialCounts: input.partialCounts ?? true,
      createdAt: ts,
      updatedAt: ts,
    }),
    d.insert(squadMembers).values({
      squadId: id,
      userId: me.id,
      role: 'owner',
      status: 'active',
      joinedAt: ts,
      updatedAt: ts,
    }),
  ]);
  const sq = await d.select().from(squads).where(eq(squads.id, id)).get();
  return c.json(toSquad(sq!, 'owner'), 201);
});

squadRoutes.post('/join', async (c) => {
  const input = await body(c, joinSquadSchema);
  const d = db(c);
  const me = c.get('user');
  const byCode = 'code' in input;
  const sq = byCode
    ? await d
        .select()
        .from(squads)
        .where(eq(squads.inviteCode, normalizeInviteCode(input.code)))
        .get()
    : await d.select().from(squads).where(eq(squads.id, input.squadId)).get();
  if (!sq || sq.archivedAt || sq.hiddenAt) {
    throw new ApiError(
      404,
      byCode ? 'INVITE_CODE_INVALID' : 'NOT_FOUND',
      byCode
        ? 'That invite code doesn’t match a squad. Check it and try again.'
        : 'That squad wasn’t found.',
    );
  }
  if (!byCode && sq.privacy === 'private') {
    throw errors.forbidden('This squad is private. Ask the owner for an invite code.');
  }
  const existing = await d
    .select()
    .from(squadMembers)
    .where(and(eq(squadMembers.squadId, sq.id), eq(squadMembers.userId, me.id)))
    .get();
  if (existing?.status === 'active')
    throw errors.conflict('ALREADY_MEMBER', 'You’re already in this squad.');
  if (existing?.status === 'pending') {
    throw errors.conflict(
      'REQUEST_PENDING',
      'Your request is waiting for the owner to approve it.',
    );
  }
  if (existing?.status === 'removed' && sq.privacy === 'public') {
    throw errors.forbidden('You were removed from this squad, so you can’t rejoin it.');
  }
  if (sq.memberCount >= sq.memberLimit) {
    throw errors.limit('LIMIT_SQUAD_FULL', 'This squad is full.');
  }
  await assertCanJoin(d, me.id);

  const status = sq.privacy === 'public' ? 'active' : 'pending';
  const ts = nowIso();
  await d
    .insert(squadMembers)
    .values({ squadId: sq.id, userId: me.id, role: 'member', status, joinedAt: ts, updatedAt: ts })
    .onConflictDoUpdate({
      target: [squadMembers.squadId, squadMembers.userId],
      set: { role: 'member', status, joinedAt: ts, updatedAt: ts },
    })
    .run();
  if (status === 'active') {
    await recountMembers(d, [sq.id]);
    for (const id of await managerIds(d, sq.id)) {
      if (id === me.id) continue;
      await addNotificationIf(d, id, 'notifyMembers', 'member_joined', {
        squadId: sq.id,
        squadName: sq.name,
        userId: me.id,
        name: me.name,
      });
    }
  } else {
    for (const id of await managerIds(d, sq.id)) {
      await addNotification(d, id, 'join_request', {
        squadId: sq.id,
        squadName: sq.name,
        userId: me.id,
        name: me.name,
      });
    }
  }
  const fresh = await d.select().from(squads).where(eq(squads.id, sq.id)).get();
  return c.json({
    status,
    squad: status === 'active' ? toSquad(fresh!, 'member') : null,
    preview: await buildPreview(d, fresh!, me.id),
  });
});

squadRoutes.get('/invites/:code', async (c) => {
  const d = db(c);
  const code = normalizeInviteCode(c.req.param('code'));
  const sq = await d.select().from(squads).where(eq(squads.inviteCode, code)).get();
  if (!sq || sq.archivedAt || sq.hiddenAt) {
    throw new ApiError(
      404,
      'INVITE_CODE_INVALID',
      'That invite code doesn’t match a squad. Check it and try again.',
    );
  }
  return c.json(await buildPreview(d, sq, c.get('user').id));
});

squadRoutes.get('/:id/preview', async (c) => {
  const d = db(c);
  const me = c.get('user');
  const sq = await d
    .select()
    .from(squads)
    .where(eq(squads.id, c.req.param('id')))
    .get();
  if (!sq || sq.archivedAt || sq.hiddenAt) throw errors.notFound('That squad');
  if (sq.privacy === 'private') {
    const m = await d
      .select({ s: squadMembers.status })
      .from(squadMembers)
      .where(and(eq(squadMembers.squadId, sq.id), eq(squadMembers.userId, me.id)))
      .get();
    if (!m) throw errors.notFound('That squad');
  }
  return c.json(await buildPreview(d, sq, me.id));
});

squadRoutes.get('/:id', async (c) => {
  const d = db(c);
  const me = c.get('user');
  const { squad, member } = await requireMember(d, c.req.param('id'), me.id);
  const blocked = new Set(await blockedByMe(d, me.id));
  const rows = await d
    .select()
    .from(squadMembers)
    .innerJoin(user, eq(user.id, squadMembers.userId))
    .where(and(eq(squadMembers.squadId, squad.id), eq(squadMembers.status, 'active')))
    .orderBy(asc(squadMembers.joinedAt))
    .all();
  const ch = await activeChallenge(d, squad.id);
  const ann = await d.select().from(announcements).where(eq(announcements.squadId, squad.id)).get();
  return c.json({
    squad: toSquad(squad, member.role),
    myRole: member.role,
    members: rows
      .filter((r) => !blocked.has(r.user.id))
      .map((r) => toMember(r.squad_members, r.user)),
    challenge: ch ? toChallenge(ch) : null,
    announcement: ann?.body
      ? { body: ann.body, authorId: ann.authorId, updatedAt: ann.updatedAt }
      : null,
  });
});

squadRoutes.patch('/:id', async (c) => {
  const input = await body(c, updateSquadSchema);
  const d = db(c);
  const { squad } = await requireMember(d, c.req.param('id'), c.get('user').id, ['owner']);
  assertClean(input.name, input.description, input.rules);
  if (input.memberLimit !== undefined && input.memberLimit < squad.memberCount) {
    throw errors.badRequest(
      `The limit can’t be lower than the ${squad.memberCount} members already in.`,
    );
  }
  await d
    .update(squads)
    .set({ ...input, updatedAt: nowIso() })
    .where(eq(squads.id, squad.id))
    .run();
  const fresh = await d.select().from(squads).where(eq(squads.id, squad.id)).get();
  return c.json(toSquad(fresh!, 'owner'));
});

squadRoutes.delete('/:id', async (c) => {
  const d = db(c);
  const { squad } = await requireMember(d, c.req.param('id'), c.get('user').id, ['owner']);
  const ts = nowIso();
  await d.batch([
    d.update(squads).set({ archivedAt: ts, updatedAt: ts }).where(eq(squads.id, squad.id)),
    d
      .update(challenges)
      .set({ status: 'ended', endedAt: ts, updatedAt: ts })
      .where(and(eq(challenges.squadId, squad.id), eq(challenges.status, 'active'))),
  ]);
  return c.json({ ok: true });
});

squadRoutes.post('/:id/leave', async (c) => {
  const d = db(c);
  const me = c.get('user');
  const { squad, member } = await requireMember(d, c.req.param('id'), me.id);
  if (member.role === 'owner') {
    throw errors.conflict(
      'OWNER_MUST_TRANSFER',
      'Hand the squad to someone else before you leave, or delete it.',
    );
  }
  await d
    .update(squadMembers)
    .set({ status: 'left', role: 'member', updatedAt: nowIso() })
    .where(and(eq(squadMembers.squadId, squad.id), eq(squadMembers.userId, me.id)))
    .run();
  await recountMembers(d, [squad.id]);
  return c.json({ ok: true });
});

squadRoutes.get('/:id/members', async (c) => {
  const d = db(c);
  const me = c.get('user');
  const { squad } = await requireMember(d, c.req.param('id'), me.id);
  const blocked = new Set(await blockedByMe(d, me.id));
  const rows = await d
    .select()
    .from(squadMembers)
    .innerJoin(user, eq(user.id, squadMembers.userId))
    .where(and(eq(squadMembers.squadId, squad.id), eq(squadMembers.status, 'active')))
    .orderBy(asc(squadMembers.joinedAt))
    .all();
  const ch = await activeChallenge(d, squad.id);
  const consistency = ch
    ? await memberConsistency(
        d,
        ch,
        rows.map((r) => r.user),
      )
    : new Map<string, number>();
  const ids = rows.map((r) => r.user.id);
  const streakRows =
    ch && ids.length
      ? await d
          .select()
          .from(streaks)
          .where(and(eq(streaks.scope, ch.id), inArray(streaks.userId, ids)))
          .all()
      : [];
  const streakOf = new Map(streakRows.map((s) => [s.userId, s]));
  const badgeRows = ids.length
    ? await d.select().from(badges).where(inArray(badges.userId, ids)).all()
    : [];
  const members: SquadMemberStatsDTO[] = rows
    .filter((r) => !blocked.has(r.user.id))
    .map((r) => {
      const s = streakOf.get(r.user.id);
      return {
        ...toMember(r.squad_members, r.user),
        consistency: consistency.get(r.user.id) ?? null,
        streak: ch ? { current: s?.current ?? 0, best: s?.best ?? 0 } : null,
        badges: badgeRows.filter((b) => b.userId === r.user.id).map((b) => b.badge as BadgeId),
      };
    });
  return c.json({ members });
});

squadRoutes.get('/:id/requests', async (c) => {
  const d = db(c);
  const { squad } = await requireMember(d, c.req.param('id'), c.get('user').id, ['owner', 'admin']);
  const rows = await d
    .select()
    .from(squadMembers)
    .innerJoin(user, eq(user.id, squadMembers.userId))
    .where(and(eq(squadMembers.squadId, squad.id), eq(squadMembers.status, 'pending')))
    .orderBy(asc(squadMembers.joinedAt))
    .all();
  return c.json({ requests: rows.map((r) => toMember(r.squad_members, r.user)) });
});

async function decide(
  d: Db,
  squad: SquadRow,
  userIds: string[],
  approve: boolean,
): Promise<number> {
  const pending = await d
    .select()
    .from(squadMembers)
    .where(
      and(
        eq(squadMembers.squadId, squad.id),
        eq(squadMembers.status, 'pending'),
        inArray(squadMembers.userId, userIds),
      ),
    )
    .all();
  if (pending.length === 0) return 0;
  const ts = nowIso();
  if (!approve) {
    await d
      .delete(squadMembers)
      .where(
        and(
          eq(squadMembers.squadId, squad.id),
          eq(squadMembers.status, 'pending'),
          inArray(
            squadMembers.userId,
            pending.map((p) => p.userId),
          ),
        ),
      )
      .run();
    return pending.length;
  }
  const room = squad.memberLimit - squad.memberCount;
  if (room < pending.length)
    throw errors.limit(
      'LIMIT_SQUAD_FULL',
      'There isn’t room for everyone. Raise the member limit first.',
    );
  const ids = pending.map((p) => p.userId);
  await d
    .update(squadMembers)
    .set({ status: 'active', joinedAt: ts, updatedAt: ts })
    .where(and(eq(squadMembers.squadId, squad.id), inArray(squadMembers.userId, ids)))
    .run();
  await recountMembers(d, [squad.id]);
  for (const id of ids) {
    await addNotification(d, id, 'request_approved', { squadId: squad.id, squadName: squad.name });
  }
  return ids.length;
}

squadRoutes.post('/:id/requests/approve-all', async (c) => {
  const d = db(c);
  const { squad } = await requireMember(d, c.req.param('id'), c.get('user').id, ['owner', 'admin']);
  const pending = await d
    .select({ id: squadMembers.userId })
    .from(squadMembers)
    .where(and(eq(squadMembers.squadId, squad.id), eq(squadMembers.status, 'pending')))
    .all();
  const n = await decide(
    d,
    squad,
    pending.map((p) => p.id),
    true,
  );
  return c.json({ approved: n });
});

squadRoutes.post('/:id/requests/:userId', async (c) => {
  const { approve } = await body(c, decideRequestSchema);
  const d = db(c);
  const { squad } = await requireMember(d, c.req.param('id'), c.get('user').id, ['owner', 'admin']);
  const n = await decide(d, squad, [c.req.param('userId')], approve);
  if (n === 0) throw errors.notFound('That request');
  return c.json({ ok: true });
});

squadRoutes.patch('/:id/members/:userId', async (c) => {
  const { role } = await body(c, setRoleSchema);
  const d = db(c);
  const { squad } = await requireMember(d, c.req.param('id'), c.get('user').id, ['owner']);
  const target = c.req.param('userId');
  const m = await d
    .select()
    .from(squadMembers)
    .where(and(eq(squadMembers.squadId, squad.id), eq(squadMembers.userId, target)))
    .get();
  if (!m || m.status !== 'active') throw errors.notFound('That member');
  if (m.role === 'owner') throw errors.forbidden('Use “Transfer ownership” to change the owner.');
  await d
    .update(squadMembers)
    .set({ role, updatedAt: nowIso() })
    .where(and(eq(squadMembers.squadId, squad.id), eq(squadMembers.userId, target)))
    .run();
  await addNotification(d, target, 'role_changed', {
    squadId: squad.id,
    squadName: squad.name,
    role,
  });
  return c.json({ ok: true });
});

squadRoutes.delete('/:id/members/:userId', async (c) => {
  const d = db(c);
  const { squad, member } = await requireMember(d, c.req.param('id'), c.get('user').id, [
    'owner',
    'admin',
  ]);
  const target = c.req.param('userId');
  const m = await d
    .select()
    .from(squadMembers)
    .where(and(eq(squadMembers.squadId, squad.id), eq(squadMembers.userId, target)))
    .get();
  if (!m || m.status !== 'active') throw errors.notFound('That member');
  if (m.role === 'owner' || (m.role === 'admin' && member.role !== 'owner')) {
    throw errors.forbidden('Only the owner can remove an admin.');
  }
  await d
    .update(squadMembers)
    .set({ status: 'removed', role: 'member', updatedAt: nowIso() })
    .where(and(eq(squadMembers.squadId, squad.id), eq(squadMembers.userId, target)))
    .run();
  await recountMembers(d, [squad.id]);
  return c.json({ ok: true });
});

squadRoutes.post('/:id/invite/rotate', async (c) => {
  const d = db(c);
  const { squad } = await requireMember(d, c.req.param('id'), c.get('user').id, ['owner']);
  const code = await uniqueInviteCode(d);
  await d
    .update(squads)
    .set({ inviteCode: code, updatedAt: nowIso() })
    .where(eq(squads.id, squad.id))
    .run();
  return c.json({ inviteCode: code });
});

squadRoutes.put('/:id/announcement', async (c) => {
  const input = await body(c, announcementSchema);
  const d = db(c);
  const me = c.get('user');
  const { squad } = await requireMember(d, c.req.param('id'), me.id, ['owner', 'admin']);
  assertClean(input.body);
  const ts = nowIso();
  await d
    .insert(announcements)
    .values({ squadId: squad.id, body: input.body, authorId: me.id, updatedAt: ts })
    .onConflictDoUpdate({
      target: announcements.squadId,
      set: { body: input.body, authorId: me.id, updatedAt: ts },
    })
    .run();
  if (input.body) {
    const members = await d
      .select({ id: squadMembers.userId })
      .from(squadMembers)
      .where(and(eq(squadMembers.squadId, squad.id), eq(squadMembers.status, 'active')))
      .all();
    for (const m of members) {
      if (m.id === me.id) continue;
      await addNotification(d, m.id, 'announcement', {
        squadId: squad.id,
        squadName: squad.name,
        body: input.body.slice(0, 120),
      });
    }
  }
  return c.json({ squadId: squad.id, body: input.body, authorId: me.id, updatedAt: ts });
});

squadRoutes.post('/:id/transfer', async (c) => {
  const { userId } = await body(c, transferSchema);
  const d = db(c);
  const me = c.get('user');
  const { squad } = await requireMember(d, c.req.param('id'), me.id, ['owner']);
  if (userId === me.id) throw errors.badRequest('You already own this squad.');
  const target = await d
    .select()
    .from(squadMembers)
    .where(and(eq(squadMembers.squadId, squad.id), eq(squadMembers.userId, userId)))
    .get();
  if (!target || target.status !== 'active') throw errors.notFound('That member');
  const ts = nowIso();
  await d.batch([
    d.update(squads).set({ ownerId: userId, updatedAt: ts }).where(eq(squads.id, squad.id)),
    d
      .update(squadMembers)
      .set({ role: 'owner', updatedAt: ts })
      .where(and(eq(squadMembers.squadId, squad.id), eq(squadMembers.userId, userId))),
    d
      .update(squadMembers)
      .set({ role: 'admin', updatedAt: ts })
      .where(and(eq(squadMembers.squadId, squad.id), eq(squadMembers.userId, me.id))),
  ]);
  await addNotification(d, userId, 'role_changed', {
    squadId: squad.id,
    squadName: squad.name,
    role: 'owner',
  });
  return c.json({ ok: true });
});

squadRoutes.get('/:id/history', async (c) => {
  const d = db(c);
  const { squad } = await requireMember(d, c.req.param('id'), c.get('user').id);
  const rows = await d
    .select()
    .from(challenges)
    .where(and(eq(challenges.squadId, squad.id), eq(challenges.status, 'ended')))
    .orderBy(desc(challenges.endedAt))
    .all();
  return c.json({ challenges: rows.map(toChallenge) });
});

squadRoutes.get('/:id/history/:challengeId', async (c) => {
  const d = db(c);
  const me = c.get('user');
  const { squad } = await requireMember(d, c.req.param('id'), me.id);
  const ch = await d
    .select()
    .from(challenges)
    .where(and(eq(challenges.id, c.req.param('challengeId')), eq(challenges.squadId, squad.id)))
    .get();
  if (!ch) throw errors.notFound('That challenge');
  const blocked = new Set(await blockedByMe(d, me.id));
  const rows = await d
    .select()
    .from(memberSummary)
    .innerJoin(user, eq(user.id, memberSummary.userId))
    .where(eq(memberSummary.challengeId, ch.id))
    .all();
  const members = rows
    .filter((r) => !blocked.has(r.user.id))
    .map((r) => ({
      user: toPublicUser(r.user),
      daysDone: r.member_summary.daysDone,
      daysElapsed: r.member_summary.daysElapsed,
      tasksDone: r.member_summary.tasksDone,
      bestStreak: r.member_summary.bestStreak,
      consistency:
        r.member_summary.daysElapsed > 0
          ? Math.round((r.member_summary.daysDone / r.member_summary.daysElapsed) * 100)
          : 0,
    }))
    .sort((a, b) => b.consistency - a.consistency || b.tasksDone - a.tasksDone);
  const completion =
    members.length > 0
      ? Math.round(members.reduce((n, m) => n + m.consistency, 0) / members.length)
      : 0;
  return c.json({ challenge: toChallenge(ch), completion, members });
});
