import type { CheckinDTO, LocalDate } from '@sparksquad/shared';
import { eq } from 'drizzle-orm';
import { appEvents } from '../../lib/appEvents';
import { parseJson, withWriteLock } from '../../lib/db/helpers';
import { checkins, nudges } from '../../lib/db/schema';
import type { LocalDb } from '../../lib/db/types';
import type { Outbox } from '../../lib/outbox/outbox';
import { refresh } from '../../lib/runtime';

type Queue = Pick<Outbox, 'enqueue'>;

/** Fire reaction toggle: flip locally now, deliver through the outbox (coalesced per check-in). */
export async function toggleFire(db: LocalDb, outbox: Queue, checkinId: string): Promise<boolean> {
  const on = await withWriteLock(async () => {
    const row = await db.select().from(checkins).where(eq(checkins.id, checkinId)).get();
    if (!row) return null;
    const c = parseJson<CheckinDTO | null>(row.data, null);
    if (!c) return null;
    const next = !c.reactedByMe;
    const updated: CheckinDTO = {
      ...c,
      reactedByMe: next,
      reactionCount: Math.max(0, c.reactionCount + (next ? 1 : -1)),
    };
    await db
      .update(checkins)
      .set({ data: JSON.stringify(updated) })
      .where(eq(checkins.id, checkinId));
    return next;
  });
  if (on === null) return false;
  await outbox.enqueue('fire', `fire:${checkinId}`, { checkinId, on });
  return on;
}

/** One nudge per sender → recipient → day; recorded locally so the button flips to "Nudged". */
export async function sendNudge(
  db: LocalDb,
  outbox: Queue,
  args: { challengeId: string; fromUserId: string; toUserId: string; localDate: LocalDate },
): Promise<void> {
  await withWriteLock(() => db.insert(nudges).values(args).onConflictDoNothing());
  await outbox.enqueue('nudge', `nudge:${args.challengeId}:${args.toUserId}:${args.localDate}`, {
    challengeId: args.challengeId,
    toUserId: args.toUserId,
  });
}

/** Adjusts the cached comment count after posting/deleting a comment. */
export async function bumpCommentCount(
  db: LocalDb,
  checkinId: string,
  delta: number,
): Promise<void> {
  await withWriteLock(async () => {
    const row = await db.select().from(checkins).where(eq(checkins.id, checkinId)).get();
    const c = row ? parseJson<CheckinDTO | null>(row.data, null) : null;
    if (!c) return;
    const updated = { ...c, commentCount: Math.max(0, c.commentCount + delta) };
    await db
      .update(checkins)
      .set({ data: JSON.stringify(updated) })
      .where(eq(checkins.id, checkinId));
  });
  appEvents.emit('syncCompleted');
}

/** After a server-side squad change: pull deltas so every screen catches up. */
export function syncSoon(): void {
  refresh().catch(() => undefined);
}
