import {
  addDays,
  isValidTimeZone,
  localDateInZone,
  type CheckinDTO,
  type SyncResponse,
} from '@sparksquad/shared';
import { and, eq, inArray, lt, ne, notInArray } from 'drizzle-orm';
import { writeTransaction, setKv } from '../db/helpers';
import {
  announcements,
  badges,
  blocked,
  challenges,
  checkins,
  dayEdits,
  kv,
  members,
  notifications,
  nudges,
  outbox,
  plans,
  squads,
  streaks,
  users,
} from '../db/schema';
import type { LocalDb } from '../db/types';

export const KV_CURSOR = 'syncCursor';
export const KV_ME = 'me';
export const KV_LAST_SYNC = 'lastSyncAt';

/** Other members' check-ins are kept this long; my own are kept for history. */
export const OTHERS_CHECKIN_DAYS = 14;
export const NOTIFICATION_DAYS = 30;

export async function upsertCheckinRow(
  db: LocalDb,
  c: CheckinDTO,
  pending: 0 | 1 = 0,
): Promise<void> {
  const row = {
    id: c.id,
    challengeId: c.challengeId,
    userId: c.userId,
    localDate: c.localDate,
    dayNumber: c.dayNumber,
    status: c.status,
    data: JSON.stringify(c),
    pending,
    updatedAt: c.updatedAt,
  };
  // The unique (challenge, user, date) row may exist under another id; replace it.
  await db
    .delete(checkins)
    .where(
      and(
        eq(checkins.challengeId, c.challengeId),
        eq(checkins.userId, c.userId),
        eq(checkins.localDate, c.localDate),
        ne(checkins.id, c.id),
      ),
    );
  await db.insert(checkins).values(row).onConflictDoUpdate({ target: checkins.id, set: row });
}

async function removeSquads(db: LocalDb, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const chRows = await db
    .select({ id: challenges.id })
    .from(challenges)
    .where(inArray(challenges.squadId, ids))
    .all();
  const chIds = chRows.map((r) => r.id);
  if (chIds.length) {
    await db.delete(checkins).where(inArray(checkins.challengeId, chIds));
    await db.delete(dayEdits).where(inArray(dayEdits.challengeId, chIds));
    await db.delete(nudges).where(inArray(nudges.challengeId, chIds));
    await db.delete(streaks).where(inArray(streaks.scope, chIds));
  }
  await db.delete(challenges).where(inArray(challenges.squadId, ids));
  await db.delete(members).where(inArray(members.squadId, ids));
  await db.delete(announcements).where(inArray(announcements.squadId, ids));
  await db.delete(squads).where(inArray(squads.id, ids));
}

/** Applies one delta-sync payload atomically, then advances the cursor. */
export async function applySync(db: LocalDb, res: SyncResponse): Promise<void> {
  const parsed = new Date(res.serverTime);
  const now = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const tz = isValidTimeZone(res.me.timezone) ? res.me.timezone : 'UTC';
  const today = localDateInZone(now, tz);

  await writeTransaction(db, async () => {
    await setKv(db, KV_ME, JSON.stringify(res.me));

    await removeSquads(db, res.removedSquadIds);

    for (const s of res.squads) {
      const row = { id: s.id, data: JSON.stringify(s), updatedAt: s.updatedAt };
      await db.insert(squads).values(row).onConflictDoUpdate({ target: squads.id, set: row });
    }

    for (const u of res.users) {
      const row = {
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarColor: u.avatarColor,
      };
      await db.insert(users).values(row).onConflictDoUpdate({ target: users.id, set: row });
    }

    for (const m of res.members) {
      const user = {
        id: m.user.id,
        username: m.user.username,
        displayName: m.user.displayName,
        avatarColor: m.user.avatarColor,
      };
      await db.insert(users).values(user).onConflictDoUpdate({ target: users.id, set: user });
      const row = {
        squadId: m.squadId,
        userId: m.user.id,
        role: m.role,
        status: m.status,
        joinedAt: m.joinedAt,
        updatedAt: m.updatedAt,
      };
      await db
        .insert(members)
        .values(row)
        .onConflictDoUpdate({ target: [members.squadId, members.userId], set: row });
    }

    for (const ch of res.challenges) {
      const row = {
        id: ch.id,
        squadId: ch.squadId,
        status: ch.status,
        startDate: ch.startDate,
        durationDays: ch.durationDays,
        planHash: ch.planHash,
        data: JSON.stringify(ch),
        updatedAt: ch.updatedAt,
      };
      await db
        .insert(challenges)
        .values(row)
        .onConflictDoUpdate({ target: challenges.id, set: row });
    }

    for (const e of res.dayEdits) {
      const row = {
        challengeId: e.challengeId,
        dayNumber: e.dayNumber,
        data: JSON.stringify(e.day),
        updatedAt: e.updatedAt,
      };
      await db
        .insert(dayEdits)
        .values(row)
        .onConflictDoUpdate({ target: [dayEdits.challengeId, dayEdits.dayNumber], set: row });
    }

    for (const a of res.announcements) {
      if (a.body === null) {
        await db.delete(announcements).where(eq(announcements.squadId, a.squadId));
        continue;
      }
      const row = {
        squadId: a.squadId,
        body: a.body,
        authorId: a.authorId,
        updatedAt: a.updatedAt,
      };
      await db
        .insert(announcements)
        .values(row)
        .onConflictDoUpdate({ target: announcements.squadId, set: row });
    }

    for (const c of res.checkins) {
      // A queued local write wins until the outbox delivers it (last write wins on the server).
      const local = await db
        .select({ pending: checkins.pending })
        .from(checkins)
        .where(
          and(
            eq(checkins.challengeId, c.challengeId),
            eq(checkins.userId, c.userId),
            eq(checkins.localDate, c.localDate),
          ),
        )
        .get();
      if (local?.pending) continue;
      await upsertCheckinRow(db, c, 0);
    }

    // Moderation-hidden check-ins and members who are gone (left, removed, deleted their account).
    if (res.removedCheckinIds?.length) {
      await db.delete(checkins).where(inArray(checkins.id, res.removedCheckinIds));
    }
    for (const roster of res.squadMemberIds ?? []) {
      const keep = [...roster.userIds, res.me.id];
      const gone = (
        await db
          .select({ id: members.userId })
          .from(members)
          .where(
            and(
              eq(members.squadId, roster.squadId),
              eq(members.status, 'active'),
              notInArray(members.userId, keep),
            ),
          )
          .all()
      ).map((r) => r.id);
      if (gone.length === 0) continue;
      await db
        .delete(members)
        .where(and(eq(members.squadId, roster.squadId), inArray(members.userId, gone)));
      const squadChallenges = (
        await db
          .select({ id: challenges.id })
          .from(challenges)
          .where(eq(challenges.squadId, roster.squadId))
          .all()
      ).map((r) => r.id);
      if (squadChallenges.length) {
        await db
          .delete(checkins)
          .where(
            and(inArray(checkins.challengeId, squadChallenges), inArray(checkins.userId, gone)),
          );
      }
    }

    for (const n of res.nudges) {
      await db.insert(nudges).values(n).onConflictDoNothing();
    }

    for (const s of res.streaks) {
      const row = {
        scope: s.scope,
        current: s.current,
        best: s.best,
        freezes: s.freezes,
        lastDoneDate: s.lastDoneDate,
        updatedAt: s.updatedAt,
      };
      await db.insert(streaks).values(row).onConflictDoUpdate({ target: streaks.scope, set: row });
    }

    for (const b of res.badges) {
      await db
        .insert(badges)
        .values({ badge: b.badge, earnedAt: b.earnedAt })
        .onConflictDoNothing();
    }

    for (const n of res.notifications) {
      const row = {
        id: n.id,
        kind: n.kind,
        payload: JSON.stringify(n.payload),
        readAt: n.readAt,
        createdAt: n.createdAt,
      };
      await db
        .insert(notifications)
        .values(row)
        .onConflictDoUpdate({ target: notifications.id, set: row });
    }

    // Blocks: the server filters new data; also drop anything already cached.
    await db.delete(blocked);
    for (const userId of res.blockedUserIds) {
      await db.insert(blocked).values({ userId }).onConflictDoNothing();
    }
    if (res.blockedUserIds.length) {
      await db.delete(checkins).where(inArray(checkins.userId, res.blockedUserIds));
      await db.delete(members).where(inArray(members.userId, res.blockedUserIds));
    }

    // Pruning keeps the store small.
    await db
      .delete(checkins)
      .where(
        and(
          ne(checkins.userId, res.me.id),
          lt(checkins.localDate, addDays(today, -OTHERS_CHECKIN_DAYS)),
        ),
      );
    await db.delete(nudges).where(lt(nudges.localDate, addDays(today, -1)));
    await db
      .delete(notifications)
      .where(
        lt(
          notifications.createdAt,
          new Date(now.getTime() - NOTIFICATION_DAYS * 864e5).toISOString(),
        ),
      );
    // Check-ins for challenges we no longer have (ended long ago, or removed) go too, except mine.
    const known = (await db.select({ id: challenges.id }).from(challenges).all()).map((r) => r.id);
    await db
      .delete(checkins)
      .where(
        known.length
          ? and(ne(checkins.userId, res.me.id), notInArray(checkins.challengeId, known))
          : ne(checkins.userId, res.me.id),
      );
    // Users no longer referenced by any membership.
    const referenced = (await db.select({ id: members.userId }).from(members).all()).map(
      (r) => r.id,
    );
    await db
      .delete(users)
      .where(
        referenced.length
          ? and(notInArray(users.id, referenced), ne(users.id, res.me.id))
          : ne(users.id, res.me.id),
      );

    await setKv(db, KV_CURSOR, res.nextCursor);
    await setKv(db, KV_LAST_SYNC, res.serverTime);
  });
}

/** Removes everything (sign-out, account switch). */
export async function wipeLocalData(db: LocalDb): Promise<void> {
  await writeTransaction(db, async () => {
    for (const table of [
      squads,
      users,
      members,
      challenges,
      dayEdits,
      announcements,
      checkins,
      nudges,
      streaks,
      badges,
      notifications,
      blocked,
      outbox,
      plans,
    ]) {
      await db.delete(table);
    }
    await db.delete(kv).where(ne(kv.key, 'schemaVersion'));
  });
}
