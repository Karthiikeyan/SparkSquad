import {
  addDays,
  localDateInZone,
  syncQuerySchema,
  type CheckinDTO,
  type SyncResponse,
} from '@sparksquad/shared';
import { and, eq, gt, gte, inArray, notInArray, or } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { Hono } from 'hono';
import {
  announcements,
  badges,
  challenges,
  checkins,
  notifications,
  nudges,
  planDayEdits,
  reactions,
  squadMembers,
  squads,
  streaks,
  user,
} from '../db/schema';
import type { AppEnv } from '../env';
import { db, query } from '../lib/http';
import { blockedByMe, getUser } from '../services/access';
import {
  dayFromJson,
  toBadge,
  toChallenge,
  toCheckin,
  toMe,
  toMember,
  toNotification,
  toPublicUser,
  toSquad,
  toStreak,
} from '../services/dto';
import { photoUrlFor } from './checkins';

export const syncRoutes = new Hono<AppEnv>();

/** Overlap so writes committed in the same instant as the previous sync are not missed. */
const CURSOR_OVERLAP_MS = 2_000;
const RECENT_CHECKIN_DAYS = 7;
const EPOCH = '1970-01-01T00:00:00.000Z';

export function encodeCursor(iso: string): string {
  return btoa(iso);
}

export function decodeCursor(cursor: string | undefined): string {
  if (!cursor) return EPOCH;
  try {
    const iso = atob(cursor);
    return Number.isNaN(Date.parse(iso)) ? EPOCH : iso;
  } catch {
    return EPOCH;
  }
}

syncRoutes.get('/', async (c) => {
  const { since } = query(c, syncQuerySchema);
  const d = db(c);
  const me = c.get('user');
  const startedAt = new Date();
  const sinceIso = decodeCursor(since);
  const initial = sinceIso === EPOCH;

  const meRow = await getUser(d, me.id);
  const blocked = await blockedByMe(d, me.id);
  const today = localDateInZone(startedAt, meRow.timezone);

  // My memberships (all statuses so removals/leaves reach the phone).
  const myMemberships = await d
    .select()
    .from(squadMembers)
    .where(eq(squadMembers.userId, me.id))
    .all();
  const activeIds = myMemberships.filter((m) => m.status === 'active').map((m) => m.squadId);
  const myRole = new Map(myMemberships.map((m) => [m.squadId, m.role]));
  const removedSquadIds = myMemberships
    .filter((m) => m.status !== 'active' && m.status !== 'pending' && m.updatedAt > sinceIso)
    .map((m) => m.squadId);
  const newlyActive = new Set(
    myMemberships
      .filter((m) => m.status === 'active' && m.updatedAt > sinceIso)
      .map((m) => m.squadId),
  );
  const newIds = [...newlyActive];
  /** Changed since the cursor, or belongs to a squad I joined since the cursor (needs a full copy). */
  const changedOrNew = (updated: SQLiteColumn, squadCol: SQLiteColumn) =>
    initial
      ? undefined
      : newIds.length
        ? or(gt(updated, sinceIso), inArray(squadCol, newIds))
        : gt(updated, sinceIso);

  const empty = activeIds.length === 0;
  const changedSquads = empty
    ? []
    : await d
        .select()
        .from(squads)
        .where(and(inArray(squads.id, activeIds), changedOrNew(squads.updatedAt, squads.id)))
        .all();
  const archived = changedSquads.filter((s) => s.archivedAt || s.hiddenAt).map((s) => s.id);

  const memberRows = empty
    ? []
    : await d
        .select()
        .from(squadMembers)
        .innerJoin(user, eq(user.id, squadMembers.userId))
        .where(
          and(
            inArray(squadMembers.squadId, activeIds),
            changedOrNew(squadMembers.updatedAt, squadMembers.squadId),
          ),
        )
        .all();

  const allChallenges = empty
    ? []
    : await d.select().from(challenges).where(inArray(challenges.squadId, activeIds)).all();
  const activeChallengeIds = allChallenges
    .filter((ch) => ch.status === 'active')
    .map((ch) => ch.id);
  const changedChallenges = allChallenges.filter(
    (ch) => initial || ch.updatedAt > sinceIso || newlyActive.has(ch.squadId),
  );

  const newChallengeIds = allChallenges
    .filter((ch) => newlyActive.has(ch.squadId))
    .map((ch) => ch.id);
  const edits =
    activeChallengeIds.length === 0
      ? []
      : await d
          .select()
          .from(planDayEdits)
          .where(
            and(
              inArray(planDayEdits.challengeId, activeChallengeIds),
              initial
                ? undefined
                : newChallengeIds.length
                  ? or(
                      gt(planDayEdits.updatedAt, sinceIso),
                      inArray(planDayEdits.challengeId, newChallengeIds),
                    )
                  : gt(planDayEdits.updatedAt, sinceIso),
            ),
          )
          .all();

  const anns = empty
    ? []
    : await d
        .select()
        .from(announcements)
        .where(
          and(
            inArray(announcements.squadId, activeIds),
            changedOrNew(announcements.updatedAt, announcements.squadId),
          ),
        )
        .all();

  const recentFrom = addDays(today, -RECENT_CHECKIN_DAYS);
  const checkinRows =
    activeChallengeIds.length === 0
      ? []
      : await d
          .select()
          .from(checkins)
          .where(
            and(
              inArray(checkins.challengeId, activeChallengeIds),
              gte(checkins.localDate, recentFrom),
              initial
                ? undefined
                : newChallengeIds.length
                  ? or(
                      gt(checkins.updatedAt, sinceIso),
                      inArray(checkins.challengeId, newChallengeIds),
                    )
                  : gt(checkins.updatedAt, sinceIso),
              blocked.length ? notInArray(checkins.userId, blocked) : undefined,
            ),
          )
          .all();
  const visibleCheckins = checkinRows.filter((r) => !r.hiddenAt);
  const myReactions =
    visibleCheckins.length === 0
      ? new Set<string>()
      : new Set(
          (
            await d
              .select({ id: reactions.checkinId })
              .from(reactions)
              .where(
                and(
                  eq(reactions.userId, me.id),
                  inArray(
                    reactions.checkinId,
                    visibleCheckins.map((r) => r.id),
                  ),
                ),
              )
              .all()
          ).map((r) => r.id),
        );
  const checkinDtos: CheckinDTO[] = [];
  for (const r of visibleCheckins) {
    checkinDtos.push(
      toCheckin(r, { reactedByMe: myReactions.has(r.id), photoUrl: await photoUrlFor(c.env, r) }),
    );
  }

  const nudgeRows =
    activeChallengeIds.length === 0
      ? []
      : await d
          .select()
          .from(nudges)
          .where(
            and(
              inArray(nudges.challengeId, activeChallengeIds),
              or(eq(nudges.fromUserId, me.id), eq(nudges.toUserId, me.id)),
              gte(nudges.localDate, addDays(today, -1)),
              initial ? undefined : gt(nudges.createdAt, sinceIso),
            ),
          )
          .all();

  const streakRows = await d
    .select()
    .from(streaks)
    .where(and(eq(streaks.userId, me.id), initial ? undefined : gt(streaks.updatedAt, sinceIso)))
    .all();
  const badgeRows = await d
    .select()
    .from(badges)
    .where(and(eq(badges.userId, me.id), initial ? undefined : gt(badges.earnedAt, sinceIso)))
    .all();
  const notificationRows = await d
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, me.id),
        initial ? undefined : gt(notifications.updatedAt, sinceIso),
      ),
    )
    .all();

  const blockedSet = new Set(blocked);
  const users = new Map<string, ReturnType<typeof toPublicUser>>();
  for (const r of memberRows) {
    if (!blockedSet.has(r.user.id)) users.set(r.user.id, toPublicUser(r.user));
  }

  const response: SyncResponse = {
    me: toMe(meRow, c.env.ADMIN_EMAILS),
    squads: changedSquads
      .filter((s) => !archived.includes(s.id))
      .map((s) => toSquad(s, myRole.get(s.id) ?? null)),
    removedSquadIds: [...removedSquadIds, ...archived],
    members: memberRows
      .filter((r) => !blockedSet.has(r.user.id))
      .map((r) => toMember(r.squad_members, r.user)),
    users: [...users.values()],
    challenges: changedChallenges.map(toChallenge),
    dayEdits: edits
      .map((e) => {
        const day = dayFromJson(e.dayJson);
        return day
          ? {
              challengeId: e.challengeId,
              dayNumber: e.dayNumber,
              day,
              editedBy: e.editedBy,
              updatedAt: e.updatedAt,
            }
          : null;
      })
      .filter((e): e is NonNullable<typeof e> => e !== null),
    announcements: anns.map((a) => ({
      squadId: a.squadId,
      body: a.body,
      authorId: a.authorId,
      updatedAt: a.updatedAt,
    })),
    checkins: checkinDtos,
    nudges: nudgeRows.map((n) => ({
      challengeId: n.challengeId,
      fromUserId: n.fromUserId,
      toUserId: n.toUserId,
      localDate: n.localDate,
    })),
    streaks: streakRows.map(toStreak),
    badges: badgeRows.map(toBadge),
    notifications: notificationRows.map(toNotification),
    blockedUserIds: blocked,
    nextCursor: encodeCursor(new Date(startedAt.getTime() - CURSOR_OVERLAP_MS).toISOString()),
    serverTime: startedAt.toISOString(),
  };
  return c.json(response);
});
