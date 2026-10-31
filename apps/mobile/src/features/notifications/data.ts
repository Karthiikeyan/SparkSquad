import type { NotificationDTO, NotificationKind } from '@sparksquad/shared';
import { desc, eq, isNull } from 'drizzle-orm';
import { parseJson } from '../../lib/db/helpers';
import { notifications } from '../../lib/db/schema';
import type { LocalDb } from '../../lib/db/types';

export async function readNotifications(db: LocalDb): Promise<NotificationDTO[]> {
  const rows = await db.select().from(notifications).orderBy(desc(notifications.createdAt)).all();
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as NotificationKind,
    payload: parseJson<Record<string, unknown>>(r.payload, {}),
    readAt: r.readAt,
    createdAt: r.createdAt,
  }));
}

export async function readUnreadCount(db: LocalDb): Promise<number> {
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(isNull(notifications.readAt))
    .all();
  return rows.length;
}

/** Marks rows read locally (all when `ids` is omitted). */
export async function markReadLocally(db: LocalDb, ids?: string[]): Promise<void> {
  const ts = new Date().toISOString();
  if (!ids) {
    await db.update(notifications).set({ readAt: ts }).where(isNull(notifications.readAt));
    return;
  }
  for (const id of ids) {
    await db.update(notifications).set({ readAt: ts }).where(eq(notifications.id, id));
  }
}
