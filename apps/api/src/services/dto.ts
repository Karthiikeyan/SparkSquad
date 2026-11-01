import {
  effectivePlan,
  type CheckinDTO,
  type ChallengeDTO,
  type CommentDTO,
  type MeDTO,
  type MemberDTO,
  type NotificationDTO,
  type NotificationKind,
  type PlanDay,
  type PublicUserDTO,
  type SquadDTO,
  type StreakDTO,
  type TaskValue,
  type BadgeId,
} from '@sparksquad/shared';
import type * as s from '../db/schema';

type UserRow = typeof s.user.$inferSelect;
type SquadRow = typeof s.squads.$inferSelect;
type MemberRow = typeof s.squadMembers.$inferSelect;
type ChallengeRow = typeof s.challenges.$inferSelect;
type CheckinRow = typeof s.checkins.$inferSelect;
type StreakRow = typeof s.streaks.$inferSelect;
type NotificationRow = typeof s.notifications.$inferSelect;

export function parseJson<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

/** Admin = an allow-listed email that the identity provider (or an OTP) has verified. */
export function isAdmin(adminEmails: string, u: Pick<UserRow, 'email' | 'emailVerified'>): boolean {
  if (!u.emailVerified) return false;
  return adminEmails
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(u.email.toLowerCase());
}

export function displayNameOf(u: Pick<UserRow, 'displayName' | 'name' | 'username'>): string {
  return u.displayName || u.name || u.username || 'Member';
}

export function toMe(u: UserRow, adminEmails: string): MeDTO {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    displayName: displayNameOf(u),
    avatarColor: u.avatarColor,
    timezone: u.timezone,
    interests: parseJson<string[]>(u.interests, []),
    reminderTime: u.reminderTime,
    notifyMissedDay: u.notifyMissedDay,
    notifySquadUpdates: u.notifySquadUpdates,
    notifyNudges: u.notifyNudges,
    notifyComments: u.notifyComments,
    notifyMembers: u.notifyMembers,
    notifyMilestones: u.notifyMilestones,
    notifyStreakRisk: u.notifyStreakRisk,
    notifyChallengeStart: u.notifyChallengeStart,
    plan: effectivePlan(u.plan, u.planExpiresAt),
    planExpiresAt: u.planExpiresAt,
    ageConfirmedAt: u.ageConfirmedAt,
    termsAcceptedAt: u.termsAcceptedAt,
    createdAt: u.createdAt.toISOString(),
    isAdmin: isAdmin(adminEmails, u),
  };
}

export function toPublicUser(
  u: Pick<UserRow, 'id' | 'username' | 'displayName' | 'name' | 'avatarColor'>,
): PublicUserDTO {
  return {
    id: u.id,
    username: u.username,
    displayName: displayNameOf(u),
    avatarColor: u.avatarColor,
  };
}

/** Invite codes are only shown to owners/admins (members share links via the app). */
export function toSquad(sq: SquadRow, viewerRole: MemberRow['role'] | null): SquadDTO {
  return {
    id: sq.id,
    name: sq.name,
    description: sq.description,
    rules: sq.rules,
    category: sq.category,
    privacy: sq.privacy,
    ownerId: sq.ownerId,
    inviteCode: viewerRole ? sq.inviteCode : null,
    chatUrl: viewerRole ? sq.chatUrl : null,
    memberLimit: sq.memberLimit,
    memberCount: sq.memberCount,
    isPro: isSquadPro(sq),
    allowPersonalTargets: sq.allowPersonalTargets,
    partialCounts: sq.partialCounts,
    createdAt: sq.createdAt,
    updatedAt: sq.updatedAt,
    archivedAt: sq.archivedAt,
  };
}

export function isSquadPro(
  sq: Pick<SquadRow, 'isPro' | 'proExpiresAt'>,
  now = new Date(),
): boolean {
  if (!sq.isPro) return false;
  return !sq.proExpiresAt || new Date(sq.proExpiresAt).getTime() > now.getTime();
}

export function toMember(m: MemberRow, u: Parameters<typeof toPublicUser>[0]): MemberDTO {
  return {
    squadId: m.squadId,
    user: toPublicUser(u),
    role: m.role,
    status: m.status,
    joinedAt: m.joinedAt,
    updatedAt: m.updatedAt,
  };
}

export function toChallenge(ch: ChallengeRow): ChallengeDTO {
  return {
    id: ch.id,
    squadId: ch.squadId,
    title: ch.title,
    planHash: ch.planHash,
    planVersion: ch.planVersion,
    durationDays: ch.durationDays,
    daysPerWeek: ch.daysPerWeek,
    startDate: ch.startDate,
    status: ch.status,
    createdBy: ch.createdBy,
    createdAt: ch.createdAt,
    endedAt: ch.endedAt,
    updatedAt: ch.updatedAt,
  };
}

export function toCheckin(
  row: CheckinRow,
  opts: { reactedByMe: boolean; photoUrl: string | null },
): CheckinDTO {
  return {
    id: row.id,
    challengeId: row.challengeId,
    userId: row.userId,
    localDate: row.localDate,
    dayNumber: row.dayNumber,
    status: row.status,
    values: parseJson<TaskValue[]>(row.values, []),
    note: row.note,
    hasPhoto: row.hasPhoto,
    photoUrl: opts.photoUrl,
    verified: parseJson<number[]>(row.verified, []),
    reactionCount: row.reactionCount,
    commentCount: row.commentCount,
    reactedByMe: opts.reactedByMe,
    edited: row.edited,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toComment(
  row: typeof s.comments.$inferSelect,
  u: Parameters<typeof toPublicUser>[0],
): CommentDTO {
  return {
    id: row.id,
    checkinId: row.checkinId,
    user: toPublicUser(u),
    body: row.body,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
}

export function toStreak(row: StreakRow): StreakDTO {
  return {
    scope: row.scope,
    current: row.current,
    best: row.best,
    freezes: row.freezes,
    lastDoneDate: row.lastDoneDate,
    updatedAt: row.updatedAt,
  };
}

export function toNotification(row: NotificationRow): NotificationDTO {
  return {
    id: row.id,
    kind: row.kind as NotificationKind,
    payload: parseJson<Record<string, unknown>>(row.payload, {}),
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

export function toBadge(row: typeof s.badges.$inferSelect): { badge: BadgeId; earnedAt: string } {
  return { badge: row.badge as BadgeId, earnedAt: row.earnedAt };
}

export function dayFromJson(json: string): PlanDay | null {
  return parseJson<PlanDay | null>(json, null);
}
