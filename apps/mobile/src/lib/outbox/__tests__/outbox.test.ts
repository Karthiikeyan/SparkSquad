import { eq } from 'drizzle-orm';
import { ApiError, NetworkError } from '../../api/errors';
import { badges, checkins, streaks } from '../../db/schema';
import { createTestDb } from '../../../test/testDb';
import { checkin, ME_ID, SERVER_TIME, TODAY } from '../../../test/fixtures';
import { upsertCheckinRow } from '../../sync/applySync';
import { createOutboxHandlers, revertRejected } from '../handlers';
import { backoffMs, createOutbox, type OutboxHandlers, type OutboxItem } from '../outbox';

function fakeHandlers(log: string[], impl?: Partial<OutboxHandlers>): OutboxHandlers {
  return {
    checkin: async (p) => {
      log.push(`checkin:${p.id}`);
    },
    fire: async (p) => {
      log.push(`fire:${p.checkinId}:${p.on}`);
    },
    comment: async (p) => {
      log.push(`comment:${p.body}`);
    },
    nudge: async (p) => {
      log.push(`nudge:${p.toUserId}`);
    },
    ...impl,
  };
}

const input = {
  challengeId: 'C1',
  localDate: TODAY,
  timezone: 'Asia/Kolkata',
  values: [{ t: 0, v: true }],
};

describe('outbox', () => {
  it('delivers in enqueue order and empties the queue', async () => {
    const { db } = await createTestDb();
    const log: string[] = [];
    const onChange = jest.fn();
    const box = createOutbox({ db, handlers: fakeHandlers(log), onChange });
    await box.enqueue('checkin', 'checkin:C1:d', { id: 'K1', input });
    await box.enqueue('comment', 'comment:1', { checkinId: 'K9', body: 'nice' });
    await box.enqueue('nudge', 'nudge:C1:U2', { challengeId: 'C1', toUserId: 'U2' });
    expect(await box.pendingCount()).toBe(3);
    const res = await box.flush();
    expect(res).toEqual({ sent: 3, failed: 0, remaining: 0 });
    expect(log).toEqual(['checkin:K1', 'comment:nice', 'nudge:U2']);
    expect(onChange).toHaveBeenCalled();
  });

  it('coalesces repeated writes to the same entity but never comments', async () => {
    const { db } = await createTestDb();
    const log: string[] = [];
    const box = createOutbox({ db, handlers: fakeHandlers(log) });
    await box.enqueue('fire', 'fire:K1', { checkinId: 'K1', on: true });
    await box.enqueue('fire', 'fire:K1', { checkinId: 'K1', on: false });
    await box.enqueue('comment', 'comment:K1', { checkinId: 'K1', body: 'a' });
    await box.enqueue('comment', 'comment:K1', { checkinId: 'K1', body: 'b' });
    await box.flush();
    expect(log).toEqual(['fire:K1:false', 'comment:a', 'comment:b']);
  });

  it('backs off on network errors and keeps later writes waiting', async () => {
    const { db } = await createTestDb();
    const log: string[] = [];
    let t = 1_000_000;
    let offline = true;
    const box = createOutbox({
      db,
      now: () => t,
      handlers: fakeHandlers(log, {
        checkin: async (p) => {
          if (offline) throw new NetworkError();
          log.push(`checkin:${p.id}`);
        },
      }),
    });
    await box.enqueue('checkin', 'checkin:C1:d', { id: 'K1', input });
    await box.enqueue('nudge', 'nudge:C1:U2', { challengeId: 'C1', toUserId: 'U2' });

    expect(await box.flush()).toEqual({ sent: 0, failed: 0, remaining: 2 });
    const [first] = await box.list();
    expect(first!.attempts).toBe(1);
    expect(first!.lastError).toBe('NetworkError');
    expect(first!.nextAttemptAt).toBe(t + backoffMs(1));

    // Not due yet: nothing is sent, order is preserved.
    offline = false;
    t += 1_000;
    expect(await box.flush()).toEqual({ sent: 0, failed: 0, remaining: 2 });

    await box.retryNow();
    expect(await box.flush()).toEqual({ sent: 2, failed: 0, remaining: 0 });
    expect(log).toEqual(['checkin:K1', 'nudge:U2']);
    expect(await box.nextDueAt()).toBeNull();
  });

  it('reports when the head of the queue is next due', async () => {
    const { db } = await createTestDb();
    const t = 5_000_000;
    const box = createOutbox({
      db,
      now: () => t,
      handlers: fakeHandlers([], {
        nudge: async () => {
          throw new NetworkError();
        },
      }),
    });
    await box.enqueue('nudge', 'nudge:C1:U2', { challengeId: 'C1', toUserId: 'U2' });
    expect(await box.nextDueAt()).toBe(0);
    await box.flush();
    expect(await box.nextDueAt()).toBe(t + backoffMs(1));
  });

  it('marks 4xx rejections as failed, reports them, and continues', async () => {
    const { db } = await createTestDb();
    const log: string[] = [];
    const failures: OutboxItem[] = [];
    const box = createOutbox({
      db,
      handlers: fakeHandlers(log, {
        checkin: async () => {
          throw new ApiError(400, 'CHECKIN_WINDOW_CLOSED', 'closed');
        },
      }),
      onPermanentFailure: (item) => {
        failures.push(item);
      },
    });
    await box.enqueue('checkin', 'checkin:C1:d', { id: 'K1', input });
    await box.enqueue('nudge', 'nudge:C1:U2', { challengeId: 'C1', toUserId: 'U2' });
    expect(await box.flush()).toEqual({ sent: 1, failed: 1, remaining: 0 });
    expect(failures.map((f) => f.kind)).toEqual(['checkin']);
    const items = await box.list();
    expect(items).toHaveLength(1);
    expect(items[0]!.status).toBe('failed');
    expect(items[0]!.lastError).toBe('CHECKIN_WINDOW_CLOSED');
    await box.discard(items[0]!.id);
    expect(await box.list()).toHaveLength(0);
  });

  it('treats 429 and 5xx as retryable', async () => {
    const { db } = await createTestDb();
    const box = createOutbox({
      db,
      handlers: fakeHandlers([], {
        nudge: async () => {
          throw new ApiError(503, 'INTERNAL', 'down');
        },
      }),
    });
    await box.enqueue('nudge', 'nudge:C1:U2', { challengeId: 'C1', toUserId: 'U2' });
    expect(await box.flush()).toEqual({ sent: 0, failed: 0, remaining: 1 });
  });

  it('caps the backoff', () => {
    expect(backoffMs(1)).toBe(5_000);
    expect(backoffMs(2)).toBe(10_000);
    expect(backoffMs(50)).toBe(10 * 60_000);
  });
});

describe('outbox handlers', () => {
  const streak = (scope: string) => ({
    scope,
    current: 3,
    best: 5,
    freezes: 1,
    lastDoneDate: TODAY,
    updatedAt: SERVER_TIME,
  });

  function api(overrides: Record<string, unknown> = {}) {
    return {
      upsertCheckin: jest.fn(async (id: string) => ({
        checkin: checkin(id, 'C1', ME_ID, TODAY, { reactionCount: 0 }),
        streak: streak('C1'),
        globalStreak: streak('global'),
        newBadges: ['first_checkin' as const],
      })),
      setFire: jest.fn(async () => ({ reactionCount: 5, reactedByMe: true })),
      addComment: jest.fn(async () => ({}) as never),
      nudge: jest.fn(async () => ({ ok: true as const, localDate: TODAY })),
      checkin: jest.fn(async (id: string) => ({ checkin: checkin(id, 'C1', ME_ID), author: null })),
      ...overrides,
    };
  }

  it('stores the canonical check-in, streaks and new badges', async () => {
    const { db } = await createTestDb();
    await upsertCheckinRow(db, checkin('K1', 'C1', ME_ID), 1);
    const h = createOutboxHandlers(db, api());
    await h.checkin({ id: 'K1', input });
    const row = await db.select().from(checkins).where(eq(checkins.id, 'K1')).get();
    expect(row?.pending).toBe(0);
    expect((await db.select().from(streaks).all()).map((s) => s.scope).sort()).toEqual([
      'C1',
      'global',
    ]);
    expect((await db.select().from(badges).all()).map((b) => b.badge)).toEqual(['first_checkin']);
  });

  it('uploads a shareable photo first and sends its key', async () => {
    const { db } = await createTestDb();
    const a = api();
    const upload = jest.fn(async () => 'proof-30d/U_ME/K1.jpg');
    const h = createOutboxHandlers(db, a, upload);
    await h.checkin({ id: 'K1', input: { ...input, hasPhoto: true }, photoUri: 'file:///p.jpg' });
    expect(upload).toHaveBeenCalledWith('K1', 'file:///p.jpg');
    expect(a.upsertCheckin).toHaveBeenCalledWith(
      'K1',
      expect.objectContaining({ photoKey: 'proof-30d/U_ME/K1.jpg' }),
    );

    // No key (not allowed any more): the check-in still goes through without one.
    const b = api();
    await createOutboxHandlers(db, b, async () => null).checkin({
      id: 'K1',
      input: { ...input, hasPhoto: true },
      photoUri: 'file:///p.jpg',
    });
    const sent = (b.upsertCheckin.mock.calls[0] as unknown[] | undefined)?.[1];
    expect(sent).not.toHaveProperty('photoKey');
  });

  it('updates reaction counts from the server answer', async () => {
    const { db } = await createTestDb();
    await upsertCheckinRow(db, checkin('K1', 'C1', 'U2'));
    await createOutboxHandlers(db, api()).fire({ checkinId: 'K1', on: true });
    const row = await db.select().from(checkins).get();
    expect(JSON.parse(row!.data)).toMatchObject({ reactionCount: 5, reactedByMe: true });
  });

  it('treats "already nudged" as success', async () => {
    const { db } = await createTestDb();
    const a = api({
      nudge: jest.fn(async () => {
        throw new ApiError(409, 'LIMIT_NUDGE_ALREADY_SENT', 'x');
      }),
    });
    await expect(
      createOutboxHandlers(db, a).nudge({ challengeId: 'C1', toUserId: 'U2' }),
    ).resolves.toBeUndefined();
  });

  it('reverts a rejected check-in to the server copy, or drops it when unknown', async () => {
    const { db } = await createTestDb();
    await upsertCheckinRow(db, checkin('K1', 'C1', ME_ID, TODAY, { note: 'local' }), 1);
    const item: OutboxItem = {
      id: 'O1',
      kind: 'checkin',
      entityKey: 'x',
      payload: { id: 'K1', input },
      status: 'failed',
      attempts: 1,
      nextAttemptAt: 0,
      lastError: 'X',
      createdAt: 1,
    };
    await revertRejected(db, api(), item);
    let row = await db.select().from(checkins).get();
    expect(row?.pending).toBe(0);
    expect(JSON.parse(row!.data).note).toBeNull();

    await upsertCheckinRow(db, checkin('K1', 'C1', ME_ID, TODAY, { note: 'local' }), 1);
    const missing = api({
      checkin: jest.fn(async () => {
        throw new ApiError(404, 'NOT_FOUND', 'gone');
      }),
    });
    await revertRejected(db, missing, item);
    row = await db.select().from(checkins).get();
    expect(row).toBeUndefined();

    await upsertCheckinRow(db, checkin('K1', 'C1', ME_ID, TODAY, { note: 'local' }), 1);
    const offline = api({
      checkin: jest.fn(async () => {
        throw new NetworkError();
      }),
    });
    await revertRejected(db, offline, item);
    row = await db.select().from(checkins).get();
    expect(row?.pending).toBe(0);
  });
});
