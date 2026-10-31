import { eq, sql } from 'drizzle-orm';
import { kv } from './schema';
import type { LocalDb } from './types';

/** Serialises local write batches so transactions never interleave. */
export function createLock() {
  let tail: Promise<unknown> = Promise.resolve();
  return function withLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = tail.then(fn, fn);
    tail = run.catch(() => undefined);
    return run;
  };
}

export const withWriteLock = createLock();

/** Runs `fn` inside BEGIN/COMMIT under the write lock; rolls back on error. */
export function writeTransaction<T>(db: LocalDb, fn: () => Promise<T>): Promise<T> {
  return withWriteLock(async () => {
    await db.run(sql`BEGIN`);
    try {
      const result = await fn();
      await db.run(sql`COMMIT`);
      return result;
    } catch (e) {
      await db.run(sql`ROLLBACK`);
      throw e;
    }
  });
}

export async function getKv(db: LocalDb, key: string): Promise<string | undefined> {
  const row = await db.select().from(kv).where(eq(kv.key, key)).get();
  return row?.value;
}

export async function setKv(db: LocalDb, key: string, value: string): Promise<void> {
  await db.insert(kv).values({ key, value }).onConflictDoUpdate({ target: kv.key, set: { value } });
}

export async function deleteKv(db: LocalDb, key: string): Promise<void> {
  await db.delete(kv).where(eq(kv.key, key));
}

export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
