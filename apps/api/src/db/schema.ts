import { CATEGORIES } from '@sparksquad/shared';
import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

/* ---------------- Better Auth tables (user extended with profile) ---------------- */

export const user = sqliteTable(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
    image: text('image'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    // SparkSquad profile
    username: text('username').unique(),
    displayName: text('display_name'),
    avatarColor: integer('avatar_color').notNull().default(0),
    timezone: text('timezone').notNull().default('Asia/Kolkata'),
    interests: text('interests').notNull().default('[]'),
    reminderTime: text('reminder_time').notNull().default('20:00'),
    notifyMissedDay: integer('notify_missed_day', { mode: 'boolean' }).notNull().default(true),
    notifySquadUpdates: integer('notify_squad_updates', { mode: 'boolean' })
      .notNull()
      .default(true),
    notifyNudges: integer('notify_nudges', { mode: 'boolean' }).notNull().default(true),
    ageConfirmedAt: text('age_confirmed_at'),
    termsAcceptedAt: text('terms_accepted_at'),
    plan: text('plan', { enum: ['free', 'plus'] })
      .notNull()
      .default('free'),
    planExpiresAt: text('plan_expires_at'),
    plusInterestAt: text('plus_interest_at'),
    suspendedAt: text('suspended_at'),
    deletedAt: text('deleted_at'),
  },
  (t) => [index('user_timezone_idx').on(t.timezone)],
);

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_user_idx').on(t.userId)],
);

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('account_user_idx').on(t.userId)],
);

export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
);

/* ---------------- SparkSquad ---------------- */

export const squads = sqliteTable(
  'squads',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    rules: text('rules').notNull().default(''),
    category: text('category', { enum: CATEGORIES }).notNull(),
    privacy: text('privacy', { enum: ['public', 'private'] }).notNull(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id),
    inviteCode: text('invite_code').notNull().unique(),
    chatUrl: text('chat_url'),
    memberLimit: integer('member_limit').notNull().default(100),
    memberCount: integer('member_count').notNull().default(0),
    isPro: integer('is_pro', { mode: 'boolean' }).notNull().default(false),
    proExpiresAt: text('pro_expires_at'),
    allowPersonalTargets: integer('allow_personal_targets', { mode: 'boolean' })
      .notNull()
      .default(true),
    partialCounts: integer('partial_counts', { mode: 'boolean' }).notNull().default(true),
    hiddenAt: text('hidden_at'),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now),
    archivedAt: text('archived_at'),
  },
  (t) => [
    index('squads_owner_idx').on(t.ownerId),
    index('squads_discover_idx').on(t.privacy, t.category),
    index('squads_updated_idx').on(t.updatedAt),
  ],
);

export const squadMembers = sqliteTable(
  'squad_members',
  {
    squadId: text('squad_id')
      .notNull()
      .references(() => squads.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['owner', 'admin', 'member'] }).notNull(),
    status: text('status', { enum: ['active', 'pending', 'removed', 'left'] }).notNull(),
    joinedAt: text('joined_at').notNull().default(now),
    mutedAt: text('muted_at'),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [
    primaryKey({ columns: [t.squadId, t.userId] }),
    index('squad_members_user_idx').on(t.userId, t.status),
    index('squad_members_updated_idx').on(t.squadId, t.updatedAt),
  ],
);

export const announcements = sqliteTable('announcements', {
  squadId: text('squad_id')
    .primaryKey()
    .references(() => squads.id, { onDelete: 'cascade' }),
  body: text('body'),
  authorId: text('author_id'),
  updatedAt: text('updated_at').notNull().default(now),
});

export const challenges = sqliteTable(
  'challenges',
  {
    id: text('id').primaryKey(),
    squadId: text('squad_id')
      .notNull()
      .references(() => squads.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    planKey: text('plan_key').notNull(),
    planHash: text('plan_hash').notNull(),
    planVersion: integer('plan_version').notNull().default(1),
    durationDays: integer('duration_days').notNull(),
    daysPerWeek: integer('days_per_week').notNull().default(7),
    /** JSON array of rest day numbers (kept in sync with day edits) for cheap streak maths. */
    restDays: text('rest_days').notNull().default('[]'),
    /** JSON array of task counts per day (index 0 = day 1). */
    taskCounts: text('task_counts').notNull().default('[]'),
    startDate: text('start_date').notNull(),
    status: text('status', { enum: ['active', 'ended'] })
      .notNull()
      .default('active'),
    createdBy: text('created_by').notNull(),
    createdAt: text('created_at').notNull().default(now),
    endedAt: text('ended_at'),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [
    index('challenges_squad_idx').on(t.squadId, t.status),
    index('challenges_updated_idx').on(t.updatedAt),
  ],
);

export const planDayEdits = sqliteTable(
  'plan_day_edits',
  {
    challengeId: text('challenge_id')
      .notNull()
      .references(() => challenges.id, { onDelete: 'cascade' }),
    dayNumber: integer('day_number').notNull(),
    dayJson: text('day_json').notNull(),
    editedBy: text('edited_by').notNull(),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [primaryKey({ columns: [t.challengeId, t.dayNumber] })],
);

export const checkins = sqliteTable(
  'checkins',
  {
    id: text('id').primaryKey(),
    challengeId: text('challenge_id')
      .notNull()
      .references(() => challenges.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    localDate: text('local_date').notNull(),
    dayNumber: integer('day_number').notNull(),
    status: text('status', { enum: ['done', 'partial', 'honest_miss'] }).notNull(),
    countsDone: integer('counts_done', { mode: 'boolean' }).notNull().default(false),
    tasksDone: integer('tasks_done').notNull().default(0),
    values: text('values').notNull().default('[]'),
    note: text('note'),
    hasPhoto: integer('has_photo', { mode: 'boolean' }).notNull().default(false),
    photoKey: text('photo_key'),
    verified: text('verified').notNull().default('[]'),
    reactionCount: integer('reaction_count').notNull().default(0),
    commentCount: integer('comment_count').notNull().default(0),
    edited: integer('edited', { mode: 'boolean' }).notNull().default(false),
    hiddenAt: text('hidden_at'),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [
    uniqueIndex('checkins_unique_day').on(t.challengeId, t.userId, t.localDate),
    index('checkins_challenge_date_idx').on(t.challengeId, t.localDate),
    index('checkins_user_updated_idx').on(t.userId, t.updatedAt),
    index('checkins_challenge_updated_idx').on(t.challengeId, t.updatedAt),
  ],
);

export const reactions = sqliteTable(
  'reactions',
  {
    checkinId: text('checkin_id')
      .notNull()
      .references(() => checkins.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    createdAt: text('created_at').notNull().default(now),
  },
  (t) => [
    primaryKey({ columns: [t.checkinId, t.userId, t.kind] }),
    index('reactions_user_idx').on(t.userId),
  ],
);

export const comments = sqliteTable(
  'comments',
  {
    id: text('id').primaryKey(),
    checkinId: text('checkin_id')
      .notNull()
      .references(() => checkins.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    createdAt: text('created_at').notNull().default(now),
    expiresAt: text('expires_at').notNull(),
    hiddenAt: text('hidden_at'),
  },
  (t) => [
    index('comments_checkin_idx').on(t.checkinId, t.createdAt),
    index('comments_user_idx').on(t.userId),
    index('comments_expires_idx').on(t.expiresAt),
  ],
);

export const nudges = sqliteTable(
  'nudges',
  {
    challengeId: text('challenge_id')
      .notNull()
      .references(() => challenges.id, { onDelete: 'cascade' }),
    fromUserId: text('from_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    toUserId: text('to_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    localDate: text('local_date').notNull(),
    createdAt: text('created_at').notNull().default(now),
  },
  (t) => [
    primaryKey({ columns: [t.challengeId, t.fromUserId, t.toUserId, t.localDate] }),
    index('nudges_to_idx').on(t.toUserId),
    index('nudges_created_idx').on(t.challengeId, t.createdAt),
  ],
);

export const streaks = sqliteTable(
  'streaks',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    scope: text('scope').notNull(),
    current: integer('current').notNull().default(0),
    best: integer('best').notNull().default(0),
    freezes: integer('freezes').notNull().default(0),
    lastDoneDate: text('last_done_date'),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.scope] }),
    index('streaks_updated_idx').on(t.userId, t.updatedAt),
  ],
);

export const memberSummary = sqliteTable(
  'member_summary',
  {
    challengeId: text('challenge_id')
      .notNull()
      .references(() => challenges.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    daysDone: integer('days_done').notNull(),
    daysElapsed: integer('days_elapsed').notNull(),
    tasksDone: integer('tasks_done').notNull(),
    bestStreak: integer('best_streak').notNull(),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [primaryKey({ columns: [t.challengeId, t.userId] })],
);

export const badges = sqliteTable(
  'badges',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    badge: text('badge').notNull(),
    earnedAt: text('earned_at').notNull().default(now),
  },
  (t) => [primaryKey({ columns: [t.userId, t.badge] })],
);

export const pushTokens = sqliteTable(
  'push_tokens',
  {
    token: text('token').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    platform: text('platform', { enum: ['ios', 'android'] }).notNull(),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [index('push_tokens_user_idx').on(t.userId)],
);

export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    payload: text('payload').notNull().default('{}'),
    readAt: text('read_at'),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [
    index('notifications_user_updated_idx').on(t.userId, t.updatedAt),
    index('notifications_created_idx').on(t.createdAt),
  ],
);

export const integrations = sqliteTable(
  'integrations',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    provider: text('provider', { enum: ['github', 'leetcode', 'codeforces'] }).notNull(),
    handle: text('handle').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.provider] })],
);

export const entitlements = sqliteTable(
  'entitlements',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    product: text('product').notNull(),
    squadId: text('squad_id'),
    status: text('status').notNull(),
    expiresAt: text('expires_at'),
    rcEventId: text('rc_event_id').notNull().unique(),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [index('entitlements_user_idx').on(t.userId)],
);

export const reports = sqliteTable(
  'reports',
  {
    id: text('id').primaryKey(),
    reporterId: text('reporter_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    targetType: text('target_type', { enum: ['user', 'checkin', 'comment', 'squad'] }).notNull(),
    targetId: text('target_id').notNull(),
    reason: text('reason').notNull(),
    details: text('details'),
    status: text('status', { enum: ['open', 'hidden', 'suspended', 'dismissed'] })
      .notNull()
      .default('open'),
    createdAt: text('created_at').notNull().default(now),
    resolvedAt: text('resolved_at'),
  },
  (t) => [index('reports_status_idx').on(t.status, t.createdAt)],
);

export const blocks = sqliteTable(
  'blocks',
  {
    blockerId: text('blocker_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    blockedId: text('blocked_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').notNull().default(now),
  },
  (t) => [
    primaryKey({ columns: [t.blockerId, t.blockedId] }),
    index('blocks_blocked_idx').on(t.blockedId),
  ],
);

export const usageCounters = sqliteTable(
  'usage_counters',
  {
    userId: text('user_id').notNull(),
    day: text('day').notNull(),
    kind: text('kind').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day, t.kind] })],
);

export const templates = sqliteTable('templates', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  category: text('category', { enum: CATEGORIES }).notNull(),
  durationDays: integer('duration_days').notNull(),
  tasksPerDay: integer('tasks_per_day').notNull(),
  planKey: text('plan_key').notNull(),
  published: integer('published', { mode: 'boolean' }).notNull().default(true),
});
