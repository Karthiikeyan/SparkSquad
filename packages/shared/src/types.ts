import type { LocalDate } from './date';
import type { TierLimits, UserPlan } from './limits';
import type { Category, PlanDay } from './plan/schema';
import type { CheckinStatus, TaskValue } from './scoring';
import type { BadgeId } from './streaks';

/** Wire types returned by the API (camelCase JSON). */

export type Role = 'owner' | 'admin' | 'member';
export type MemberStatus = 'active' | 'pending' | 'removed' | 'left';
export type Privacy = 'public' | 'private';

export interface MeDTO {
  id: string;
  email: string;
  username: string | null;
  displayName: string;
  avatarColor: number;
  timezone: string;
  interests: string[];
  reminderTime: string;
  notifyMissedDay: boolean;
  notifySquadUpdates: boolean;
  notifyNudges: boolean;
  plan: UserPlan;
  planExpiresAt: string | null;
  ageConfirmedAt: string | null;
  termsAcceptedAt: string | null;
  createdAt: string;
  isAdmin: boolean;
}

export interface PublicUserDTO {
  id: string;
  username: string | null;
  displayName: string;
  avatarColor: number;
}

export interface SquadDTO {
  id: string;
  name: string;
  description: string;
  rules: string;
  category: Category;
  privacy: Privacy;
  ownerId: string;
  inviteCode: string | null;
  chatUrl: string | null;
  memberLimit: number;
  memberCount: number;
  isPro: boolean;
  allowPersonalTargets: boolean;
  partialCounts: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface MemberDTO {
  squadId: string;
  user: PublicUserDTO;
  role: Role;
  status: MemberStatus;
  joinedAt: string;
  updatedAt: string;
}

export interface ChallengeDTO {
  id: string;
  squadId: string;
  title: string;
  planHash: string;
  planVersion: number;
  durationDays: number;
  daysPerWeek: number;
  startDate: LocalDate;
  status: 'active' | 'ended';
  createdBy: string;
  createdAt: string;
  endedAt: string | null;
  updatedAt: string;
}

export interface DayEditDTO {
  challengeId: string;
  dayNumber: number;
  day: PlanDay;
  editedBy: string;
  updatedAt: string;
}

export interface AnnouncementDTO {
  squadId: string;
  body: string | null;
  authorId: string | null;
  updatedAt: string;
}

export interface CheckinDTO {
  id: string;
  challengeId: string;
  userId: string;
  localDate: LocalDate;
  dayNumber: number;
  status: CheckinStatus;
  values: TaskValue[];
  note: string | null;
  hasPhoto: boolean;
  photoUrl: string | null;
  verified: number[];
  reactionCount: number;
  commentCount: number;
  reactedByMe: boolean;
  edited: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommentDTO {
  id: string;
  checkinId: string;
  user: PublicUserDTO;
  body: string;
  createdAt: string;
  expiresAt: string;
}

export interface StreakDTO {
  scope: string;
  current: number;
  best: number;
  freezes: number;
  lastDoneDate: LocalDate | null;
  updatedAt: string;
}

export interface BadgeDTO {
  badge: BadgeId;
  earnedAt: string;
}

export type NotificationKind =
  | 'nudge'
  | 'join_request'
  | 'request_approved'
  | 'announcement'
  | 'milestone'
  | 'badge'
  | 'freeze_used'
  | 'digest'
  | 'challenge_ended'
  | 'role_changed';

export interface NotificationDTO {
  id: string;
  kind: NotificationKind;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface NudgeDTO {
  challengeId: string;
  fromUserId: string;
  toUserId: string;
  localDate: LocalDate;
}

export interface SyncResponse {
  me: MeDTO;
  squads: SquadDTO[];
  removedSquadIds: string[];
  members: MemberDTO[];
  users: PublicUserDTO[];
  challenges: ChallengeDTO[];
  dayEdits: DayEditDTO[];
  announcements: AnnouncementDTO[];
  checkins: CheckinDTO[];
  nudges: NudgeDTO[];
  streaks: StreakDTO[];
  badges: BadgeDTO[];
  notifications: NotificationDTO[];
  blockedUserIds: string[];
  nextCursor: string;
  serverTime: string;
}

export interface ConfigResponse {
  minAppVersion: string;
  limits: Record<UserPlan, TierLimits>;
  features: {
    paymentsEnabled: boolean;
    emailOtp: boolean;
    google: boolean;
    apple: boolean;
  };
  contactEmail: string;
}

export interface LeaderboardEntryDTO {
  rank: number;
  user: PublicUserDTO;
  daysDone: number;
  daysElapsed: number;
  tasksDone: number;
  score: number;
  isMe: boolean;
}

export interface LeaderboardResponse {
  range: 'challenge' | 'week';
  from: LocalDate;
  to: LocalDate;
  entries: LeaderboardEntryDTO[];
}

export interface TemplateSummaryDTO {
  slug: string;
  title: string;
  category: Category;
  durationDays: number;
  tasksPerDay: number;
}

export interface SquadPreviewDTO {
  id: string;
  name: string;
  description: string;
  rules: string;
  category: Category;
  privacy: Privacy;
  memberCount: number;
  memberLimit: number;
  owner: PublicUserDTO;
  challenge: Pick<
    ChallengeDTO,
    'id' | 'title' | 'durationDays' | 'startDate' | 'daysPerWeek'
  > | null;
  myStatus: MemberStatus | null;
}

export interface DiscoverResponse {
  squads: SquadPreviewDTO[];
  templates: TemplateSummaryDTO[];
  nextCursor: string | null;
}

export interface UploadUrlResponse {
  url: string;
  key: string;
  headers: Record<string, string>;
  expiresAt: string;
}
