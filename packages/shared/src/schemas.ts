import { z } from 'zod';
import { isLocalDate, isReminderTime, isValidTimeZone } from './date';
import { HARD_CAPS, TEXT_LIMITS } from './limits';
import { CATEGORIES } from './plan/schema';

/* ---------- primitives ---------- */

export const idSchema = z.string().min(1).max(64);
export const localDateSchema = z.string().refine(isLocalDate, 'Must be a date like 2026-10-31');
export const timeZoneSchema = z.string().max(64).refine(isValidTimeZone, 'Unknown timezone');
export const reminderTimeSchema = z.string().refine(isReminderTime, 'Must be HH:MM');
export const categorySchema = z.enum(CATEGORIES);
export const privacySchema = z.enum(['public', 'private']);
export const roleSchema = z.enum(['owner', 'admin', 'member']);
export const memberStatusSchema = z.enum(['active', 'pending', 'removed', 'left']);
export const checkinStatusSchema = z.enum(['done', 'partial', 'honest_miss']);
export const platformSchema = z.enum(['ios', 'android']);
export const integrationProviderSchema = z.enum(['github', 'leetcode', 'codeforces']);
export const avatarColorSchema = z.number().int().min(0).max(11);
export const interestSchema = z.enum(['career', 'fitness', 'learning']);

const trimmed = (max: number) => z.string().trim().max(max);

/** Only WhatsApp / Telegram group links (Product Spec §3 Squad). */
export const chatUrlSchema = z
  .string()
  .trim()
  .max(300)
  .regex(
    /^https:\/\/(chat\.whatsapp\.com|wa\.me|t\.me|telegram\.me)\/[A-Za-z0-9_+\-/]+$/,
    'Use a WhatsApp or Telegram group link',
  );

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(TEXT_LIMITS.usernameMin)
  .max(TEXT_LIMITS.usernameMax)
  .regex(/^[a-z0-9_]+$/, 'Use letters, numbers and _ only');

/* ---------- me ---------- */

export const updateMeSchema = z
  .object({
    displayName: trimmed(TEXT_LIMITS.displayName).min(1),
    username: usernameSchema,
    avatarColor: avatarColorSchema,
    timezone: timeZoneSchema,
    interests: z.array(interestSchema).max(3),
    reminderTime: reminderTimeSchema,
    notifyMissedDay: z.boolean(),
    notifySquadUpdates: z.boolean(),
    notifyNudges: z.boolean(),
  })
  .partial();
export type UpdateMeInput = z.infer<typeof updateMeSchema>;

export const consentSchema = z.object({
  ageConfirmed: z.literal(true),
  termsAccepted: z.literal(true),
});

export const usernameCheckSchema = z.object({ username: usernameSchema });

/* ---------- squads ---------- */

const squadFields = {
  name: trimmed(TEXT_LIMITS.squadName).min(2),
  description: trimmed(TEXT_LIMITS.squadDescription),
  rules: trimmed(TEXT_LIMITS.squadRules),
  category: categorySchema,
  privacy: privacySchema,
  memberLimit: z.number().int().min(2).max(HARD_CAPS.maxMembersPerSquad),
  chatUrl: chatUrlSchema.nullable(),
  allowPersonalTargets: z.boolean(),
  partialCounts: z.boolean(),
};

export const createSquadSchema = z.object({
  ...squadFields,
  description: squadFields.description.optional(),
  rules: squadFields.rules.optional(),
  memberLimit: squadFields.memberLimit.optional(),
  chatUrl: squadFields.chatUrl.optional(),
  allowPersonalTargets: squadFields.allowPersonalTargets.optional(),
  partialCounts: squadFields.partialCounts.optional(),
});
export type CreateSquadInput = z.infer<typeof createSquadSchema>;

export const updateSquadSchema = z.object(squadFields).partial();
export type UpdateSquadInput = z.infer<typeof updateSquadSchema>;

export const joinSquadSchema = z.union([
  z.object({ code: z.string().trim().min(4).max(12) }),
  z.object({ squadId: idSchema }),
]);
export type JoinSquadInput = z.infer<typeof joinSquadSchema>;

export const decideRequestSchema = z.object({ approve: z.boolean() });
export const setRoleSchema = z.object({ role: z.enum(['admin', 'member']) });
export const announcementSchema = z.object({
  body: trimmed(TEXT_LIMITS.announcement).min(1).nullable(),
});
export const transferSchema = z.object({ userId: idSchema });

/* ---------- challenges ---------- */

export const createChallengeSchema = z.object({
  /** Raw plan object or pasted text; the server re-validates with parsePlan. */
  plan: z.union([z.record(z.string(), z.unknown()), z.string().max(512 * 1024)]),
  startDate: localDateSchema,
  templateSlug: z.string().max(60).optional(),
});
export type CreateChallengeInput = z.infer<typeof createChallengeSchema>;

export const editDaySchema = z.object({
  title: z.string().max(200).optional(),
  rest: z.boolean().optional(),
  tasks: z.array(z.record(z.string(), z.unknown())).max(20).optional(),
});

export const leaderboardQuerySchema = z.object({
  range: z.enum(['challenge', 'week']).default('challenge'),
});

/* ---------- check-ins ---------- */

export const taskValueSchema = z.object({
  t: z.number().int().min(0).max(7),
  v: z.union([z.number().min(0).max(1_000_000), z.boolean()]),
});

export const upsertCheckinSchema = z.object({
  challengeId: idSchema,
  localDate: localDateSchema,
  timezone: timeZoneSchema,
  values: z.array(taskValueSchema).max(8),
  note: trimmed(TEXT_LIMITS.checkinNote).nullable().optional(),
  honestMiss: z.boolean().optional(),
  hasPhoto: z.boolean().optional(),
  photoKey: z.string().max(200).nullable().optional(),
  /** Indices of tasks verified on the phone (GitHub/LeetCode/Codeforces/steps). */
  verified: z.array(z.number().int().min(0).max(7)).max(8).optional(),
});
export type UpsertCheckinInput = z.infer<typeof upsertCheckinSchema>;

export const commentSchema = z.object({ body: trimmed(TEXT_LIMITS.comment).min(1) });
export const nudgeSchema = z.object({ challengeId: idSchema, toUserId: idSchema });

export const proofUploadSchema = z.object({
  checkinId: idSchema,
  contentType: z.enum(HARD_CAPS.uploadContentTypes),
  size: z.number().int().min(1).max(HARD_CAPS.uploadMaxBytes),
});

/* ---------- devices, safety, integrations ---------- */

export const pushTokenSchema = z.object({
  token: z.string().min(10).max(300),
  platform: platformSchema,
});

export const reportTargetSchema = z.enum(['user', 'checkin', 'comment', 'squad']);
export const reportReasonSchema = z.enum([
  'spam',
  'harassment',
  'hate',
  'sexual',
  'violence',
  'self_harm',
  'impersonation',
  'other',
]);
export const reportSchema = z.object({
  targetType: reportTargetSchema,
  targetId: idSchema,
  reason: reportReasonSchema,
  details: trimmed(TEXT_LIMITS.reportDetails).optional(),
});
export type ReportInput = z.infer<typeof reportSchema>;

export const integrationSchema = z.object({
  handle: z
    .string()
    .trim()
    .min(1)
    .max(TEXT_LIMITS.handle)
    .regex(/^[A-Za-z0-9_.-]+$/, 'Use your public username only'),
});

export const adminActionSchema = z.object({ action: z.enum(['hide', 'suspend', 'dismiss']) });

export const discoverQuerySchema = z.object({
  category: categorySchema.optional(),
  q: z.string().trim().max(60).optional(),
  cursor: z.string().max(100).optional(),
});

export const syncQuerySchema = z.object({ since: z.string().max(100).optional() });

export const plusInterestSchema = z.object({
  product: z.enum(['plus', 'squad_pro']).default('plus'),
});
