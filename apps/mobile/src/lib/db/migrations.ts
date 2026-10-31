import { eq, sql } from 'drizzle-orm';
import { kv } from './schema';
import type { LocalDb } from './types';

/**
 * Hand-written, append-only migrations (keep in sync with schema.ts).
 * The version lives in `kv` so it is read through Drizzle the same way on every driver.
 */
export const MIGRATIONS: readonly (readonly string[])[] = [
  [
    `CREATE TABLE IF NOT EXISTS squads (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY NOT NULL, username TEXT, display_name TEXT NOT NULL, avatar_color INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS members (squad_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL, status TEXT NOT NULL, joined_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (squad_id, user_id))`,
    `CREATE INDEX IF NOT EXISTS members_user ON members (user_id)`,
    `CREATE TABLE IF NOT EXISTS challenges (id TEXT PRIMARY KEY NOT NULL, squad_id TEXT NOT NULL, status TEXT NOT NULL, start_date TEXT NOT NULL, duration_days INTEGER NOT NULL, plan_hash TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS challenges_squad ON challenges (squad_id)`,
    `CREATE TABLE IF NOT EXISTS plans (hash TEXT PRIMARY KEY NOT NULL, json TEXT NOT NULL, fetched_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS day_edits (challenge_id TEXT NOT NULL, day_number INTEGER NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (challenge_id, day_number))`,
    `CREATE TABLE IF NOT EXISTS announcements (squad_id TEXT PRIMARY KEY NOT NULL, body TEXT NOT NULL, author_id TEXT, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS checkins (id TEXT PRIMARY KEY NOT NULL, challenge_id TEXT NOT NULL, user_id TEXT NOT NULL, local_date TEXT NOT NULL, day_number INTEGER NOT NULL, status TEXT NOT NULL, data TEXT NOT NULL, pending INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS checkins_unique_day ON checkins (challenge_id, user_id, local_date)`,
    `CREATE INDEX IF NOT EXISTS checkins_challenge_date ON checkins (challenge_id, local_date)`,
    `CREATE INDEX IF NOT EXISTS checkins_user_date ON checkins (user_id, local_date)`,
    `CREATE TABLE IF NOT EXISTS nudges (challenge_id TEXT NOT NULL, from_user_id TEXT NOT NULL, to_user_id TEXT NOT NULL, local_date TEXT NOT NULL, PRIMARY KEY (challenge_id, from_user_id, to_user_id, local_date))`,
    `CREATE TABLE IF NOT EXISTS streaks (scope TEXT PRIMARY KEY NOT NULL, current INTEGER NOT NULL, best INTEGER NOT NULL, freezes INTEGER NOT NULL, last_done_date TEXT, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS badges (badge TEXT PRIMARY KEY NOT NULL, earned_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL, read_at TEXT, created_at TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS notifications_created ON notifications (created_at)`,
    `CREATE TABLE IF NOT EXISTS blocked (user_id TEXT PRIMARY KEY NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL, entity_key TEXT NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER NOT NULL DEFAULT 0, last_error TEXT, created_at INTEGER NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS outbox_created ON outbox (created_at)`,
    `CREATE INDEX IF NOT EXISTS outbox_entity ON outbox (entity_key)`,
  ],
];

const VERSION_KEY = 'schemaVersion';

export async function migrate(db: LocalDb): Promise<number> {
  await db.run(
    sql.raw(`CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)`),
  );
  const row = await db.select().from(kv).where(eq(kv.key, VERSION_KEY)).get();
  let version = row ? Number(row.value) || 0 : 0;
  while (version < MIGRATIONS.length) {
    const statements = MIGRATIONS[version] ?? [];
    for (const stmt of statements) await db.run(sql.raw(stmt));
    version += 1;
    await db
      .insert(kv)
      .values({ key: VERSION_KEY, value: String(version) })
      .onConflictDoUpdate({ target: kv.key, set: { value: String(version) } });
  }
  return version;
}
