import { eq } from 'drizzle-orm';
import { getKv } from '../../db/helpers';
import {
  announcements,
  blocked,
  challenges,
  checkins,
  members,
  notifications,
  nudges,
  outbox,
  squads,
  users,
} from '../../db/schema';
import { MIGRATIONS, migrate } from '../../db/migrations';
import { createTestDb } from '../../../test/testDb';
import {
  challenge,
  checkin,
  ME_ID,
  member,
  SERVER_TIME,
  squad,
  syncResponse,
  TODAY,
} from '../../../test/fixtures';
import { applySync, KV_CURSOR, KV_ME, upsertCheckinRow, wipeLocalData } from '../applySync';

describe('migrations', () => {
  it('are idempotent and record the version', async () => {
    const { db } = await createTestDb();
    expect(await migrate(db)).toBe(MIGRATIONS.length);
    expect(await getKv(db, 'schemaVersion')).toBe(String(MIGRATIONS.length));
  });
});

describe('applySync', () => {
  it('writes an initial sync and advances the cursor', async () => {
    const { db } = await createTestDb();
    await applySync(
      db,
      syncResponse({
        squads: [squad('S1')],
        members: [member('S1', ME_ID, 'Kiran Raj'), member('S1', 'U2', 'Divya')],
        challenges: [challenge('C1', 'S1')],
        announcements: [
          { squadId: 'S1', body: 'Mock test Sunday', authorId: ME_ID, updatedAt: SERVER_TIME },
        ],
        checkins: [checkin('K1', 'C1', 'U2')],
        nudges: [{ challengeId: 'C1', fromUserId: ME_ID, toUserId: 'U2', localDate: TODAY }],
        streaks: [
          {
            scope: 'global',
            current: 12,
            best: 21,
            freezes: 1,
            lastDoneDate: TODAY,
            updatedAt: SERVER_TIME,
          },
        ],
        badges: [{ badge: 'streak_7', earnedAt: SERVER_TIME }],
        notifications: [
          {
            id: 'N1',
            kind: 'nudge',
            payload: { from: 'U2' },
            readAt: null,
            createdAt: SERVER_TIME,
          },
        ],
      }),
    );
    expect(await db.select().from(squads).all()).toHaveLength(1);
    expect(await db.select().from(members).all()).toHaveLength(2);
    expect((await db.select().from(users).all()).map((u) => u.displayName).sort()).toEqual([
      'Divya',
      'Kiran Raj',
    ]);
    expect(await db.select().from(challenges).all()).toHaveLength(1);
    expect((await db.select().from(announcements).get())?.body).toBe('Mock test Sunday');
    const k = await db.select().from(checkins).get();
    expect(k?.pending).toBe(0);
    expect(JSON.parse(k!.data).values).toEqual([{ t: 0, v: true }]);
    expect(await db.select().from(nudges).all()).toHaveLength(1);
    expect(await db.select().from(notifications).all()).toHaveLength(1);
    expect(await getKv(db, KV_CURSOR)).toBe('cursor-1');
    expect(JSON.parse((await getKv(db, KV_ME))!).id).toBe(ME_ID);
  });

  it('removes squads with everything that belongs to them', async () => {
    const { db } = await createTestDb();
    await applySync(
      db,
      syncResponse({
        squads: [squad('S1'), squad('S2')],
        members: [member('S1', 'U2'), member('S2', 'U3')],
        challenges: [challenge('C1', 'S1'), challenge('C2', 'S2')],
        announcements: [{ squadId: 'S1', body: 'hi', authorId: ME_ID, updatedAt: SERVER_TIME }],
        checkins: [checkin('K1', 'C1', ME_ID), checkin('K2', 'C2', 'U3')],
      }),
    );
    await applySync(db, syncResponse({ removedSquadIds: ['S1'], nextCursor: 'cursor-2' }));
    expect((await db.select().from(squads).all()).map((s) => s.id)).toEqual(['S2']);
    expect((await db.select().from(challenges).all()).map((c) => c.id)).toEqual(['C2']);
    expect((await db.select().from(checkins).all()).map((c) => c.id)).toEqual(['K2']);
    expect(await db.select().from(announcements).all()).toHaveLength(0);
    expect((await db.select().from(members).all()).map((m) => m.squadId)).toEqual(['S2']);
    expect(await getKv(db, KV_CURSOR)).toBe('cursor-2');
  });

  it('keeps a pending local check-in until the outbox delivers it', async () => {
    const { db } = await createTestDb();
    await applySync(
      db,
      syncResponse({ squads: [squad('S1')], challenges: [challenge('C1', 'S1')] }),
    );
    await upsertCheckinRow(db, checkin('LOCAL', 'C1', ME_ID, TODAY, { note: 'mine' }), 1);
    await applySync(
      db,
      syncResponse({ checkins: [checkin('SERVER', 'C1', ME_ID, TODAY, { note: 'older' })] }),
    );
    const rows = await db.select().from(checkins).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe('LOCAL');
    expect(rows[0]!.pending).toBe(1);
  });

  it('replaces a same-day row that arrives under another id', async () => {
    const { db } = await createTestDb();
    await applySync(
      db,
      syncResponse({ challenges: [challenge('C1', 'S1')], squads: [squad('S1')] }),
    );
    await upsertCheckinRow(db, checkin('A', 'C1', 'U2'));
    await upsertCheckinRow(db, checkin('B', 'C1', 'U2', TODAY, { status: 'partial' }));
    const rows = await db.select().from(checkins).all();
    expect(rows.map((r) => [r.id, r.status])).toEqual([['B', 'partial']]);
  });

  it('drops blocked users from cached data', async () => {
    const { db } = await createTestDb();
    await applySync(
      db,
      syncResponse({
        squads: [squad('S1')],
        members: [member('S1', 'U2'), member('S1', 'U3')],
        challenges: [challenge('C1', 'S1')],
        checkins: [checkin('K2', 'C1', 'U2'), checkin('K3', 'C1', 'U3')],
      }),
    );
    await applySync(db, syncResponse({ blockedUserIds: ['U2'] }));
    expect((await db.select().from(checkins).all()).map((c) => c.userId)).toEqual(['U3']);
    expect((await db.select().from(members).all()).map((m) => m.userId)).toEqual(['U3']);
    expect((await db.select().from(blocked).all()).map((b) => b.userId)).toEqual(['U2']);
    expect(await db.select().from(users).where(eq(users.id, 'U2')).get()).toBeUndefined();
  });

  it('clears an unpinned announcement', async () => {
    const { db } = await createTestDb();
    await applySync(
      db,
      syncResponse({
        squads: [squad('S1')],
        announcements: [{ squadId: 'S1', body: 'pinned', authorId: ME_ID, updatedAt: SERVER_TIME }],
      }),
    );
    await applySync(
      db,
      syncResponse({
        announcements: [{ squadId: 'S1', body: null, authorId: null, updatedAt: SERVER_TIME }],
      }),
    );
    expect(await db.select().from(announcements).all()).toHaveLength(0);
  });

  it("prunes other members' old check-ins but keeps mine", async () => {
    const { db } = await createTestDb();
    await applySync(
      db,
      syncResponse({
        squads: [squad('S1')],
        members: [member('S1', 'U2')],
        challenges: [challenge('C1', 'S1')],
        checkins: [
          checkin('OLD_THEIRS', 'C1', 'U2', '2026-10-01'),
          checkin('OLD_MINE', 'C1', ME_ID, '2026-10-01'),
          checkin('NEW_THEIRS', 'C1', 'U2', TODAY),
        ],
        nudges: [{ challengeId: 'C1', fromUserId: ME_ID, toUserId: 'U2', localDate: '2026-10-20' }],
        notifications: [
          {
            id: 'OLD',
            kind: 'digest',
            payload: {},
            readAt: null,
            createdAt: '2026-09-01T00:00:00.000Z',
          },
        ],
      }),
    );
    expect((await db.select().from(checkins).all()).map((c) => c.id).sort()).toEqual([
      'NEW_THEIRS',
      'OLD_MINE',
    ]);
    expect(await db.select().from(nudges).all()).toHaveLength(0);
    expect(await db.select().from(notifications).all()).toHaveLength(0);
  });

  it('rolls back a failed batch and keeps the old cursor', async () => {
    const { db } = await createTestDb();
    await applySync(db, syncResponse({ squads: [squad('S1')] }));
    const broken = syncResponse({
      squads: [squad('S2')],
      nextCursor: 'cursor-bad',
      // A null required column makes the insert throw mid-batch.
      members: [{ ...member('S2', 'U9'), joinedAt: null as unknown as string }],
    });
    await expect(applySync(db, broken)).rejects.toThrow();
    expect((await db.select().from(squads).all()).map((s) => s.id)).toEqual(['S1']);
    expect(await getKv(db, KV_CURSOR)).toBe('cursor-1');
  });

  it('wipes everything except the schema version', async () => {
    const { db } = await createTestDb();
    await applySync(db, syncResponse({ squads: [squad('S1')] }));
    await db.insert(outbox).values({
      id: 'O1',
      kind: 'nudge',
      entityKey: 'x',
      payload: '{}',
      createdAt: 1,
    });
    await wipeLocalData(db);
    expect(await db.select().from(squads).all()).toHaveLength(0);
    expect(await db.select().from(outbox).all()).toHaveLength(0);
    expect(await getKv(db, KV_CURSOR)).toBeUndefined();
    expect(await getKv(db, 'schemaVersion')).toBe(String(MIGRATIONS.length));
  });
});
