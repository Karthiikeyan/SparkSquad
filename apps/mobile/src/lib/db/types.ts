import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type { schema } from './schema';

/**
 * Works with both the on-device expo-sqlite driver (sync) and the test driver (async).
 * Always `await` queries so the same code runs on either.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- run-result type differs per driver and is never read
export type LocalDb = BaseSQLiteDatabase<'sync' | 'async', any, typeof schema>;
