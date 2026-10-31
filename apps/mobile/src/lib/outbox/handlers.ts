import type { BadgeId, CheckinDTO, StreakDTO } from '@sparksquad/shared';
import { eq } from 'drizzle-orm';
import type { endpoints as Endpoints } from '../api/endpoints';
import { isApiError } from '../api/errors';
import { parseJson, withWriteLock } from '../db/helpers';
import { badges, checkins, streaks } from '../db/schema';
import type { LocalDb } from '../db/types';
import { upsertCheckinRow } from '../sync/applySync';
import type { OutboxHandlers, OutboxItem } from './outbox';

type Api = Pick<typeof Endpoints, 'upsertCheckin' | 'setFire' | 'addComment' | 'nudge' | 'checkin'>;

async function saveStreak(db: LocalDb, s: StreakDTO): Promise<void> {
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

async function patchCheckin(db: LocalDb, id: string, patch: Partial<CheckinDTO>): Promise<void> {
  const row = await db.select().from(checkins).where(eq(checkins.id, id)).get();
  if (!row) return;
  const data = { ...parseJson<CheckinDTO>(row.data, {} as CheckinDTO), ...patch };
  await db
    .update(checkins)
    .set({ data: JSON.stringify(data) })
    .where(eq(checkins.id, id));
}

/** Delivers each outbox kind and writes the server's canonical answer locally. */
export function createOutboxHandlers(db: LocalDb, api: Api): OutboxHandlers {
  return {
    async checkin({ id, input }) {
      const res = await api.upsertCheckin(id, input);
      const now = new Date().toISOString();
      await withWriteLock(async () => {
        await upsertCheckinRow(db, res.checkin, 0);
        await saveStreak(db, res.streak);
        await saveStreak(db, res.globalStreak);
        for (const badge of res.newBadges as BadgeId[]) {
          await db.insert(badges).values({ badge, earnedAt: now }).onConflictDoNothing();
        }
      });
    },
    async fire({ checkinId, on }) {
      const res = await api.setFire(checkinId, on);
      await withWriteLock(() =>
        patchCheckin(db, checkinId, {
          reactionCount: res.reactionCount,
          reactedByMe: res.reactedByMe,
        }),
      );
    },
    async comment({ checkinId, body }) {
      await api.addComment(checkinId, body);
    },
    async nudge({ challengeId, toUserId }) {
      try {
        await api.nudge(challengeId, toUserId);
      } catch (e) {
        // Already nudged today is the state we wanted.
        if (isApiError(e) && e.code === 'LIMIT_NUDGE_ALREADY_SENT') return;
        throw e;
      }
    },
  };
}

/**
 * Reverts optimistic state after the server rejected a write for good, by reloading the
 * canonical row (or dropping ours when the server never had it).
 */
export async function revertRejected(db: LocalDb, api: Api, item: OutboxItem): Promise<void> {
  const checkinId =
    item.kind === 'checkin'
      ? (item.payload as { id: string }).id
      : item.kind === 'fire'
        ? (item.payload as { checkinId: string }).checkinId
        : null;
  if (!checkinId) return;
  try {
    const res = await api.checkin(checkinId);
    await withWriteLock(() => upsertCheckinRow(db, res.checkin, 0));
  } catch (e) {
    if (isApiError(e) && (e.status === 404 || e.status === 403)) {
      await withWriteLock(() => db.delete(checkins).where(eq(checkins.id, checkinId)));
    } else {
      // Couldn't reach the server: unpin the row so the next sync can overwrite it.
      await withWriteLock(() =>
        db.update(checkins).set({ pending: 0 }).where(eq(checkins.id, checkinId)),
      );
    }
  }
}
