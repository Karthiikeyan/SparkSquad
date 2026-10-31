import { ulid, type UpsertCheckinInput } from '@sparksquad/shared';
import { and, asc, eq } from 'drizzle-orm';
import { isApiError, isRetryable } from '../api/errors';
import { withWriteLock } from '../db/helpers';
import { outbox } from '../db/schema';
import type { LocalDb } from '../db/types';

export interface OutboxPayloads {
  checkin: { id: string; input: UpsertCheckinInput };
  fire: { checkinId: string; on: boolean };
  comment: { checkinId: string; body: string };
  nudge: { challengeId: string; toUserId: string };
}

export type OutboxKind = keyof OutboxPayloads;

export type OutboxHandlers = {
  [K in OutboxKind]: (payload: OutboxPayloads[K]) => Promise<void>;
};

export interface OutboxItem<K extends OutboxKind = OutboxKind> {
  id: string;
  kind: K;
  entityKey: string;
  payload: OutboxPayloads[K];
  status: 'pending' | 'failed';
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
  createdAt: number;
}

export interface OutboxDeps {
  db: LocalDb;
  handlers: OutboxHandlers;
  now?: () => number;
  /** Fired after the queue changes (enqueue, delivery, failure). */
  onChange?: () => void;
  /** A write the server rejected for good (4xx). The caller reverts optimistic state. */
  onPermanentFailure?: (item: OutboxItem, error: unknown) => void | Promise<void>;
}

export interface FlushResult {
  sent: number;
  failed: number;
  remaining: number;
}

/** Kinds where a newer write for the same entity supersedes the queued one. */
const COALESCE: Record<OutboxKind, boolean> = {
  checkin: true,
  fire: true,
  comment: false,
  nudge: true,
};

const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 10 * 60_000;

export function backoffMs(attempts: number): number {
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1));
}

type Row = typeof outbox.$inferSelect;

function toItem(row: Row): OutboxItem {
  return {
    id: row.id,
    kind: row.kind as OutboxKind,
    entityKey: row.entityKey,
    payload: JSON.parse(row.payload) as OutboxPayloads[OutboxKind],
    status: row.status === 'failed' ? 'failed' : 'pending',
    attempts: row.attempts,
    nextAttemptAt: row.nextAttemptAt,
    lastError: row.lastError,
    createdAt: row.createdAt,
  };
}

function errorCode(e: unknown): string {
  if (isApiError(e)) return e.code;
  return e instanceof Error ? e.name : 'UNKNOWN';
}

export function createOutbox(deps: OutboxDeps) {
  const now = deps.now ?? Date.now;
  let flushing: Promise<FlushResult> | null = null;
  let again = false;
  let lastCreatedAt = 0;

  async function enqueue<K extends OutboxKind>(
    kind: K,
    entityKey: string,
    payload: OutboxPayloads[K],
  ): Promise<string> {
    const id = ulid(now());
    await withWriteLock(async () => {
      if (COALESCE[kind]) {
        await deps.db
          .delete(outbox)
          .where(and(eq(outbox.entityKey, entityKey), eq(outbox.kind, kind)));
      }
      // Strictly increasing so delivery order matches enqueue order within one millisecond.
      lastCreatedAt = Math.max(now(), lastCreatedAt + 1);
      await deps.db.insert(outbox).values({
        id,
        kind,
        entityKey,
        payload: JSON.stringify(payload),
        status: 'pending',
        attempts: 0,
        nextAttemptAt: 0,
        lastError: null,
        createdAt: lastCreatedAt,
      });
    });
    deps.onChange?.();
    return id;
  }

  async function list(): Promise<OutboxItem[]> {
    const rows = await deps.db.select().from(outbox).orderBy(asc(outbox.createdAt)).all();
    return rows.map(toItem);
  }

  async function pendingCount(): Promise<number> {
    const rows = await deps.db
      .select({ id: outbox.id })
      .from(outbox)
      .where(eq(outbox.status, 'pending'))
      .all();
    return rows.length;
  }

  async function discard(id: string): Promise<void> {
    await withWriteLock(() => deps.db.delete(outbox).where(eq(outbox.id, id)));
    deps.onChange?.();
  }

  async function flushOnce(): Promise<FlushResult> {
    const queued = await deps.db
      .select()
      .from(outbox)
      .where(eq(outbox.status, 'pending'))
      .orderBy(asc(outbox.createdAt))
      .all();

    let sent = 0;
    let failed = 0;
    let changed = false;
    for (const row of queued) {
      // Strict FIFO: an item still backing off holds back everything queued after it.
      if (row.nextAttemptAt > now()) break;
      const item = toItem(row);
      try {
        const handler = deps.handlers[item.kind] as (
          p: OutboxPayloads[OutboxKind],
        ) => Promise<void>;
        await handler(item.payload);
        await withWriteLock(() => deps.db.delete(outbox).where(eq(outbox.id, item.id)));
        sent += 1;
        changed = true;
      } catch (e) {
        if (isRetryable(e)) {
          const attempts = item.attempts + 1;
          await withWriteLock(() =>
            deps.db
              .update(outbox)
              .set({
                attempts,
                nextAttemptAt: now() + backoffMs(attempts),
                lastError: errorCode(e),
              })
              .where(eq(outbox.id, item.id)),
          );
          changed = true;
          // Keep order: later writes wait for this one.
          break;
        }
        await withWriteLock(() =>
          deps.db
            .update(outbox)
            .set({ status: 'failed', attempts: item.attempts + 1, lastError: errorCode(e) })
            .where(eq(outbox.id, item.id)),
        );
        failed += 1;
        changed = true;
        await deps.onPermanentFailure?.(item, e);
      }
    }
    if (changed) deps.onChange?.();
    return { sent, failed, remaining: await pendingCount() };
  }

  /** Delivers due items in order. Concurrent calls share one run; one more pass runs if asked mid-flight. */
  function flush(): Promise<FlushResult> {
    if (flushing) {
      again = true;
      return flushing;
    }
    flushing = (async () => {
      const total: FlushResult = { sent: 0, failed: 0, remaining: 0 };
      try {
        do {
          again = false;
          const r = await flushOnce();
          total.sent += r.sent;
          total.failed += r.failed;
          total.remaining = r.remaining;
        } while (again);
        return total;
      } finally {
        flushing = null;
      }
    })();
    return flushing;
  }

  /** When the head of the queue is next due (ms epoch), or null if nothing is pending. */
  async function nextDueAt(): Promise<number | null> {
    const head = await deps.db
      .select({ at: outbox.nextAttemptAt })
      .from(outbox)
      .where(eq(outbox.status, 'pending'))
      .orderBy(asc(outbox.createdAt))
      .get();
    return head ? head.at : null;
  }

  /** Makes every pending item due now (e.g. when the network comes back). */
  async function retryNow(): Promise<void> {
    await withWriteLock(() =>
      deps.db.update(outbox).set({ nextAttemptAt: 0 }).where(eq(outbox.status, 'pending')),
    );
  }

  return { enqueue, flush, list, pendingCount, discard, retryNow, nextDueAt };
}

export type Outbox = ReturnType<typeof createOutbox>;
