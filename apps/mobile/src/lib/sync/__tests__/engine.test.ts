import type { SyncResponse } from '@sparksquad/shared';
import { getKv } from '../../db/helpers';
import { squads } from '../../db/schema';
import { createTestDb } from '../../../test/testDb';
import { squad, syncResponse } from '../../../test/fixtures';
import { KV_CURSOR } from '../applySync';
import { createSyncEngine } from '../engine';

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('sync engine', () => {
  it('sends the stored cursor and stores the next one', async () => {
    const { db } = await createTestDb();
    const seen: (string | undefined)[] = [];
    let n = 0;
    const engine = createSyncEngine({
      db,
      fetchSync: async (since) => {
        seen.push(since);
        n += 1;
        return syncResponse({ nextCursor: `c${n}`, squads: [squad(`S${n}`)] });
      },
    });
    await engine.sync();
    await engine.sync();
    expect(seen).toEqual([undefined, 'c1']);
    expect(await getKv(db, KV_CURSOR)).toBe('c2');
    expect(await db.select().from(squads).all()).toHaveLength(2);
  });

  it('shares one request between concurrent calls and runs once more if asked mid-flight', async () => {
    const { db } = await createTestDb();
    const gate = deferred<SyncResponse>();
    let calls = 0;
    const onSynced = jest.fn();
    const engine = createSyncEngine({
      db,
      onSynced,
      fetchSync: () => {
        calls += 1;
        return calls === 1 ? gate.promise : Promise.resolve(syncResponse({ nextCursor: 'c2' }));
      },
    });
    const a = engine.sync();
    const b = engine.sync();
    gate.resolve(syncResponse({ nextCursor: 'c1' }));
    await Promise.all([a, b]);
    expect(calls).toBe(2);
    expect(onSynced).toHaveBeenCalledTimes(2);
    expect(await getKv(db, KV_CURSOR)).toBe('c2');
  });

  it('propagates errors and lets the next call retry', async () => {
    const { db } = await createTestDb();
    let fail = true;
    const engine = createSyncEngine({
      db,
      fetchSync: async () => {
        if (fail) throw new Error('offline');
        return syncResponse();
      },
    });
    await expect(engine.sync()).rejects.toThrow('offline');
    fail = false;
    await engine.sync();
    expect(await getKv(db, KV_CURSOR)).toBe('cursor-1');
  });
});
