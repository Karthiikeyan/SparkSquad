import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import { migrate } from './migrations';
import { schema } from './schema';
import type { LocalDb } from './types';

const DB_NAME = 'sparksquad.db';

let instance: LocalDb | null = null;
let ready: Promise<LocalDb> | null = null;

/** Opens the on-device database once and runs migrations. */
export function openLocalDb(): Promise<LocalDb> {
  if (ready) return ready;
  ready = (async () => {
    const sqlite = openDatabaseSync(DB_NAME);
    sqlite.execSync('PRAGMA journal_mode = WAL');
    const db = drizzle(sqlite, { schema }) as unknown as LocalDb;
    await migrate(db);
    instance = db;
    return db;
  })();
  ready.catch(() => {
    ready = null;
  });
  return ready;
}

/** The opened database. Only call after `openLocalDb()` resolved (the root layout waits for it). */
export function localDb(): LocalDb {
  if (!instance) throw new Error('Local database is not open yet');
  return instance;
}
