import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { migrate } from '../lib/db/migrations';
import { schema } from '../lib/db/schema';
import type { LocalDb } from '../lib/db/types';

/** Real SQLite (Node's built-in) behind Drizzle's proxy driver, for testing store code. */
export async function createTestDb(): Promise<{ db: LocalDb; raw: DatabaseSync }> {
  const raw = new DatabaseSync(':memory:');
  const db = drizzle(
    async (query, params, method) => {
      const stmt = raw.prepare(query);
      const args = params as SQLInputValue[];
      if (method === 'run') {
        stmt.run(...args);
        return { rows: [] };
      }
      stmt.setReturnArrays(true);
      if (method === 'get') {
        return { rows: stmt.get(...args) as unknown as unknown[] };
      }
      return { rows: stmt.all(...args) as unknown as unknown[][] };
    },
    { schema },
  ) as unknown as LocalDb;
  await migrate(db);
  return { db, raw };
}
