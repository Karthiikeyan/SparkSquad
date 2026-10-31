import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

/**
 * Local offline store (Architecture §6). Rows mirror the sync payload; full DTOs are kept
 * as JSON in `data` so the wire format can grow without local migrations.
 */

export const kv = sqliteTable('kv', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const squads = sqliteTable('squads', {
  id: text('id').primaryKey(),
  data: text('data').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username'),
  displayName: text('display_name').notNull(),
  avatarColor: integer('avatar_color').notNull(),
});

export const members = sqliteTable(
  'members',
  {
    squadId: text('squad_id').notNull(),
    userId: text('user_id').notNull(),
    role: text('role').notNull(),
    status: text('status').notNull(),
    joinedAt: text('joined_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.squadId, t.userId] }), index('members_user').on(t.userId)],
);

export const challenges = sqliteTable(
  'challenges',
  {
    id: text('id').primaryKey(),
    squadId: text('squad_id').notNull(),
    status: text('status').notNull(),
    startDate: text('start_date').notNull(),
    durationDays: integer('duration_days').notNull(),
    planHash: text('plan_hash').notNull(),
    data: text('data').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('challenges_squad').on(t.squadId)],
);

/** Plan JSON cached by hash; phones refetch only when the hash changes. */
export const plans = sqliteTable('plans', {
  hash: text('hash').primaryKey(),
  json: text('json').notNull(),
  fetchedAt: text('fetched_at').notNull(),
});

export const dayEdits = sqliteTable(
  'day_edits',
  {
    challengeId: text('challenge_id').notNull(),
    dayNumber: integer('day_number').notNull(),
    data: text('data').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.challengeId, t.dayNumber] })],
);

export const announcements = sqliteTable('announcements', {
  squadId: text('squad_id').primaryKey(),
  body: text('body').notNull(),
  authorId: text('author_id'),
  updatedAt: text('updated_at').notNull(),
});

export const checkins = sqliteTable(
  'checkins',
  {
    id: text('id').primaryKey(),
    challengeId: text('challenge_id').notNull(),
    userId: text('user_id').notNull(),
    localDate: text('local_date').notNull(),
    dayNumber: integer('day_number').notNull(),
    status: text('status').notNull(),
    data: text('data').notNull(),
    /** 1 while the write is still in the outbox (shows the clock icon). */
    pending: integer('pending').notNull().default(0),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('checkins_unique_day').on(t.challengeId, t.userId, t.localDate),
    index('checkins_challenge_date').on(t.challengeId, t.localDate),
    index('checkins_user_date').on(t.userId, t.localDate),
  ],
);

export const nudges = sqliteTable(
  'nudges',
  {
    challengeId: text('challenge_id').notNull(),
    fromUserId: text('from_user_id').notNull(),
    toUserId: text('to_user_id').notNull(),
    localDate: text('local_date').notNull(),
  },
  (t) => [primaryKey({ columns: [t.challengeId, t.fromUserId, t.toUserId, t.localDate] })],
);

export const streaks = sqliteTable('streaks', {
  scope: text('scope').primaryKey(),
  current: integer('current').notNull(),
  best: integer('best').notNull(),
  freezes: integer('freezes').notNull(),
  lastDoneDate: text('last_done_date'),
  updatedAt: text('updated_at').notNull(),
});

export const badges = sqliteTable('badges', {
  badge: text('badge').primaryKey(),
  earnedAt: text('earned_at').notNull(),
});

export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    kind: text('kind').notNull(),
    payload: text('payload').notNull(),
    readAt: text('read_at'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('notifications_created').on(t.createdAt)],
);

export const blocked = sqliteTable('blocked', {
  userId: text('user_id').primaryKey(),
});

export const outbox = sqliteTable(
  'outbox',
  {
    id: text('id').primaryKey(),
    kind: text('kind').notNull(),
    /** Coalescing key: a newer write for the same entity replaces the queued one. */
    entityKey: text('entity_key').notNull(),
    payload: text('payload').notNull(),
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: integer('next_attempt_at').notNull().default(0),
    lastError: text('last_error'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('outbox_created').on(t.createdAt), index('outbox_entity').on(t.entityKey)],
);

export const schema = {
  kv,
  squads,
  users,
  members,
  challenges,
  plans,
  dayEdits,
  announcements,
  checkins,
  nudges,
  streaks,
  badges,
  notifications,
  blocked,
  outbox,
};
