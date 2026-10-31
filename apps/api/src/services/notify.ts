import { HARD_CAPS, localDateInZone, ulid, type NotificationKind } from '@sparksquad/shared';
import { and, eq, inArray, isNull, like } from 'drizzle-orm';
import type { Db } from '../db/client';
import { notifications, pushTokens, user } from '../db/schema';
import type { Bindings } from '../env';
import { takeUsage } from './access';

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

type PushChannel = 'nudge' | 'squad' | 'digest';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export async function addNotification(
  db: Db,
  userId: string,
  kind: NotificationKind,
  payload: Record<string, unknown>,
): Promise<void> {
  const ts = new Date().toISOString();
  await db
    .insert(notifications)
    .values({
      id: ulid(),
      userId,
      kind,
      payload: JSON.stringify(payload),
      createdAt: ts,
      updatedAt: ts,
    })
    .run();
}

type InboxSetting = 'notifyComments' | 'notifyMembers' | 'notifyMilestones';

/** Adds an inbox item only when the recipient keeps that kind switched on. */
export async function addNotificationIf(
  db: Db,
  userId: string,
  setting: InboxSetting,
  kind: NotificationKind,
  payload: Record<string, unknown>,
): Promise<void> {
  const u = await db.select({ on: user[setting] }).from(user).where(eq(user.id, userId)).get();
  if (u?.on) await addNotification(db, userId, kind, payload);
}

/**
 * Fires are grouped: one unread "fires" item per check-in, updated with the latest count
 * and name instead of a new row per tap.
 */
export async function notifyFires(
  db: Db,
  authorId: string,
  payload: { checkinId: string; squadId: string; squadName: string; name: string; count: number },
): Promise<void> {
  const u = await db
    .select({ on: user.notifyComments })
    .from(user)
    .where(eq(user.id, authorId))
    .get();
  if (!u?.on) return;
  const existing = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, authorId),
        eq(notifications.kind, 'fires'),
        isNull(notifications.readAt),
        like(notifications.payload, `%"checkinId":"${payload.checkinId}"%`),
      ),
    )
    .get();
  if (!existing) {
    await addNotification(db, authorId, 'fires', payload);
    return;
  }
  const ts = new Date().toISOString();
  await db
    .update(notifications)
    .set({ payload: JSON.stringify(payload), createdAt: ts, updatedAt: ts })
    .where(eq(notifications.id, existing.id))
    .run();
}

/**
 * Sends Expo pushes in batches of 100. Respects user notification settings and the
 * "max 2 server pushes per user per day" cap (nudges are immediate and uncapped by the digest rule,
 * but still respect the user's nudge switch).
 */
export async function sendPush(
  env: Bindings,
  db: Db,
  userIds: string[],
  message: PushMessage,
  channel: PushChannel,
): Promise<number> {
  if (userIds.length === 0) return 0;
  const users = await db
    .select({
      id: user.id,
      timezone: user.timezone,
      notifyNudges: user.notifyNudges,
      notifySquadUpdates: user.notifySquadUpdates,
    })
    .from(user)
    .where(inArray(user.id, userIds))
    .all();

  const allowed: string[] = [];
  for (const u of users) {
    if (channel === 'nudge' && !u.notifyNudges) continue;
    if (channel !== 'nudge' && !u.notifySquadUpdates) continue;
    if (channel !== 'nudge') {
      const day = localDateInZone(new Date(), u.timezone);
      const ok = await takeUsage(db, u.id, day, 'push', HARD_CAPS.digestPushesPerUserPerDay);
      if (!ok) continue;
    }
    allowed.push(u.id);
  }
  if (allowed.length === 0) return 0;

  const tokens = await db
    .select()
    .from(pushTokens)
    .where(inArray(pushTokens.userId, allowed))
    .all();
  if (tokens.length === 0) return 0;

  const messages = tokens.map((t) => ({
    to: t.token,
    title: message.title,
    body: message.body,
    data: message.data ?? {},
    sound: 'default',
    channelId: 'default',
  }));

  let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(batch),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        data?: { status: string; details?: { error?: string } }[];
      };
      const dead: string[] = [];
      json.data?.forEach((ticket, idx) => {
        if (ticket.status === 'ok') sent++;
        else if (ticket.details?.error === 'DeviceNotRegistered') dead.push(batch[idx]!.to);
      });
      if (dead.length > 0) await db.delete(pushTokens).where(inArray(pushTokens.token, dead)).run();
    } catch (e) {
      console.error('push batch failed', e instanceof Error ? e.message : 'unknown');
    }
  }
  return sent;
}

export async function deleteTokensForUser(db: Db, userId: string): Promise<void> {
  await db.delete(pushTokens).where(eq(pushTokens.userId, userId)).run();
}
