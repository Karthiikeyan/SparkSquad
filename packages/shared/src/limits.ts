/**
 * Tier limits. The only place free-tier numbers live (Product Spec §4).
 * The server enforces these; the app mirrors them for UX via GET /v1/config.
 */
export type UserPlan = 'free' | 'plus';

export interface TierLimits {
  squadsJoined: number;
  squadsOwned: number;
  freezesBanked: number;
  commentRetentionDays: number;
  photoUpload: boolean;
  photoRetentionDays: number;
  aiBuilder: boolean;
}

export const TIER_LIMITS: Record<UserPlan, TierLimits> = {
  free: {
    squadsJoined: 3,
    squadsOwned: 1,
    freezesBanked: 2,
    commentRetentionDays: 30,
    photoUpload: false,
    photoRetentionDays: 0,
    // BYOK: the phone calls the user's own provider, so this costs SparkSquad nothing.
    aiBuilder: true,
  },
  plus: {
    squadsJoined: 10,
    squadsOwned: 5,
    freezesBanked: 5,
    commentRetentionDays: 90,
    photoUpload: true,
    photoRetentionDays: 30,
    aiBuilder: true,
  },
};

/** Squad Pro applies to one squad, bought by its owner. */
export const SQUAD_PRO = {
  photoRetentionDays: 90,
  commentRetentionDays: 90,
} as const;

/** Hard caps that apply to everyone (Architecture §5.10). */
export const HARD_CAPS = {
  maxMembersPerSquad: 100,
  checkinsPerChallengePerDay: 1,
  commentsPerUserPerDay: 20,
  nudgesPerPairPerDay: 1,
  uploadMaxBytes: 300 * 1024,
  uploadContentTypes: ['image/jpeg', 'image/webp'] as const,
  digestPushesPerUserPerDay: 2,
  notificationRetentionDays: 30,
  exportRetentionDays: 1,
  rawCheckinRetentionAfterEndDays: 60,
  freezeEarnEveryDays: 7,
} as const;

export const TEXT_LIMITS = {
  squadName: 60,
  squadDescription: 300,
  squadRules: 500,
  announcement: 500,
  checkinNote: 280,
  comment: 140,
  displayName: 40,
  usernameMin: 3,
  usernameMax: 20,
  reportDetails: 500,
  handle: 40,
} as const;

export const CHALLENGE_LIMITS = {
  minDays: 1,
  maxDays: 120,
  maxTasksPerDay: 8,
} as const;

export const AI_DEFAULTS = {
  dailyRequestCap: 20,
  maxDailyRequestCap: 100,
} as const;

export const INVITE_CODE_LENGTH = 6;

export function limitsFor(plan: UserPlan): TierLimits {
  return TIER_LIMITS[plan];
}

/** Effective plan for a user given an optional expiry. */
export function effectivePlan(
  plan: UserPlan,
  planExpiresAt: string | null | undefined,
  now: Date = new Date(),
): UserPlan {
  if (plan === 'plus' && planExpiresAt && new Date(planExpiresAt).getTime() < now.getTime()) {
    return 'free';
  }
  return plan;
}

export function commentRetentionDays(plan: UserPlan, squadIsPro: boolean): number {
  if (squadIsPro) return SQUAD_PRO.commentRetentionDays;
  return TIER_LIMITS[plan].commentRetentionDays;
}

/** Photo retention in days, or 0 when photos may not be uploaded. */
export function photoRetentionDays(plan: UserPlan, squadIsPro: boolean): number {
  if (squadIsPro) return SQUAD_PRO.photoRetentionDays;
  return TIER_LIMITS[plan].photoRetentionDays;
}
