import type {
  AnnouncementDTO,
  BadgeId,
  ChallengeDTO,
  CheckinDTO,
  CommentDTO,
  ConfigResponse,
  CreateChallengeInput,
  CreateSquadInput,
  DiscoverResponse,
  LeaderboardResponse,
  MeDTO,
  MemberDTO,
  SquadMemberStatsDTO,
  Plan,
  PlanDay,
  PublicUserDTO,
  ReportInput,
  SquadDTO,
  SquadPreviewDTO,
  StreakDTO,
  SyncResponse,
  TemplateSummaryDTO,
  UpdateMeInput,
  UpdateSquadInput,
  UpsertCheckinInput,
} from '@sparksquad/shared';
import { authCookie } from '../auth';
import { env } from '../env';
import { appEvents } from '../appEvents';
import { createApiClient, type ApiClient } from './client';

export const api: ApiClient = createApiClient({
  baseUrl: env.apiUrl,
  appVersion: env.appVersion,
  getCookie: authCookie,
  onUpdateRequired: () => appEvents.emit('updateRequired'),
  onUnauthorized: () => appEvents.emit('unauthorized'),
});

export interface UpsertCheckinResponse {
  checkin: CheckinDTO;
  streak: StreakDTO;
  globalStreak: StreakDTO;
  newBadges: BadgeId[];
}

const enc = encodeURIComponent;

/** Typed wrappers for the endpoints the foundation needs. Feature phases add more here. */
export const endpoints = {
  config: () => api.get<ConfigResponse>('/v1/config'),
  me: () => api.get<MeDTO>('/v1/me'),
  updateMe: (input: UpdateMeInput) => api.patch<MeDTO>('/v1/me', input),
  sync: (since?: string) => api.get<SyncResponse>('/v1/sync', { query: { since } }),
  /** Returns null when the cached copy (by plan hash ETag) is still current. */
  plan: (challengeId: string, planHash?: string) =>
    api.get<Plan | null>(`/v1/challenges/${enc(challengeId)}/plan`, {
      headers: planHash ? { 'if-none-match': `"${planHash}"` } : undefined,
      allowNotModified: true,
    }),
  upsertCheckin: (id: string, input: UpsertCheckinInput) =>
    api.put<UpsertCheckinResponse>(`/v1/checkins/${enc(id)}`, input),
  checkin: (id: string) =>
    api.get<{ checkin: CheckinDTO; author: PublicUserDTO | null }>(`/v1/checkins/${enc(id)}`),
  setFire: (checkinId: string, on: boolean) =>
    on
      ? api.put<{ reactionCount: number; reactedByMe: boolean }>(
          `/v1/checkins/${enc(checkinId)}/reactions/fire`,
        )
      : api.del<{ reactionCount: number; reactedByMe: boolean }>(
          `/v1/checkins/${enc(checkinId)}/reactions/fire`,
        ),
  comments: (checkinId: string) =>
    api.get<{ comments: CommentDTO[] }>(`/v1/checkins/${enc(checkinId)}/comments`),
  addComment: (checkinId: string, body: string) =>
    api.post<CommentDTO>(`/v1/checkins/${enc(checkinId)}/comments`, { body }),
  nudge: (challengeId: string, toUserId: string) =>
    api.post<{ ok: true; localDate: string }>('/v1/nudges', { challengeId, toUserId }),
  markNotificationsRead: (ids?: string[]) =>
    api.post<{ ok: true }>('/v1/notifications/read', ids ? { ids } : {}),
  consent: () => api.post<MeDTO>('/v1/me/consent', { ageConfirmed: true, termsAccepted: true }),
  usernameAvailable: (username: string, signal?: AbortSignal) =>
    api.get<{ username: string; available: boolean }>('/v1/me/username-available', {
      query: { username },
      signal,
    }),
  invitePreview: (code: string) => api.get<SquadPreviewDTO>(`/v1/squads/invites/${enc(code)}`),
  squadPreview: (squadId: string) => api.get<SquadPreviewDTO>(`/v1/squads/${enc(squadId)}/preview`),
  joinSquad: (input: { code: string } | { squadId: string }) =>
    api.post<JoinSquadResponse>('/v1/squads/join', input),
  cancelJoinRequest: (squadId: string) =>
    api.del<{ ok: true }>(`/v1/squads/${enc(squadId)}/request`),
  registerPushToken: (token: string, platform: 'ios' | 'android') =>
    api.put<{ ok: true }>('/v1/push-tokens', { token, platform }),
  removePushToken: (token: string) => api.del<{ ok: true }>(`/v1/push-tokens/${enc(token)}`),

  /* squads (Phase 6) */
  squadMembers: (squadId: string) =>
    api.get<{ members: SquadMemberStatsDTO[] }>(`/v1/squads/${enc(squadId)}/members`),
  squadRequests: (squadId: string) =>
    api.get<{ requests: MemberDTO[] }>(`/v1/squads/${enc(squadId)}/requests`),
  decideRequest: (squadId: string, userId: string, approve: boolean) =>
    api.post<{ ok: true }>(`/v1/squads/${enc(squadId)}/requests/${enc(userId)}`, { approve }),
  approveAll: (squadId: string) =>
    api.post<{ approved: number }>(`/v1/squads/${enc(squadId)}/requests/approve-all`),
  setRole: (squadId: string, userId: string, role: 'admin' | 'member') =>
    api.patch<{ ok: true }>(`/v1/squads/${enc(squadId)}/members/${enc(userId)}`, { role }),
  removeMember: (squadId: string, userId: string) =>
    api.del<{ ok: true }>(`/v1/squads/${enc(squadId)}/members/${enc(userId)}`),
  updateSquad: (squadId: string, input: UpdateSquadInput) =>
    api.patch<SquadDTO>(`/v1/squads/${enc(squadId)}`, input),
  deleteSquad: (squadId: string) => api.del<{ ok: true }>(`/v1/squads/${enc(squadId)}`),
  leaveSquad: (squadId: string) => api.post<{ ok: true }>(`/v1/squads/${enc(squadId)}/leave`),
  rotateInvite: (squadId: string) =>
    api.post<{ inviteCode: string }>(`/v1/squads/${enc(squadId)}/invite/rotate`),
  setAnnouncement: (squadId: string, body: string | null) =>
    api.put<AnnouncementDTO>(`/v1/squads/${enc(squadId)}/announcement`, { body }),
  transferOwnership: (squadId: string, userId: string) =>
    api.post<{ ok: true }>(`/v1/squads/${enc(squadId)}/transfer`, { userId }),
  squadHistory: (squadId: string) =>
    api.get<{ challenges: ChallengeDTO[] }>(`/v1/squads/${enc(squadId)}/history`),
  challengeSummary: (squadId: string, challengeId: string) =>
    api.get<ChallengeSummaryResponse>(`/v1/squads/${enc(squadId)}/history/${enc(challengeId)}`),
  leaderboard: (challengeId: string, range: 'challenge' | 'week') =>
    api.get<LeaderboardResponse>(`/v1/challenges/${enc(challengeId)}/leaderboard`, {
      query: { range },
    }),
  editDay: (challengeId: string, n: number, input: EditDayInput) =>
    api.put<{ day: PlanDay; fixes: string[] }>(
      `/v1/challenges/${enc(challengeId)}/days/${n}`,
      input,
    ),
  endChallenge: (challengeId: string) =>
    api.post<ChallengeDTO>(`/v1/challenges/${enc(challengeId)}/end`),
  deleteComment: (commentId: string) => api.del<{ ok: true }>(`/v1/comments/${enc(commentId)}`),
  report: (input: ReportInput) => api.post<{ ok: true }>('/v1/reports', input),
  block: (userId: string) => api.put<{ ok: true }>(`/v1/blocks/${enc(userId)}`),

  /* create & discover (Phase 7) */
  createSquad: (input: CreateSquadInput) => api.post<SquadDTO>('/v1/squads', input),
  createChallenge: (squadId: string, input: CreateChallengeInput) =>
    api.post<{ challenge: ChallengeDTO; fixes: string[] }>(
      `/v1/squads/${enc(squadId)}/challenges`,
      input,
    ),
  templates: () => api.get<{ templates: TemplateSummaryDTO[] }>('/v1/templates'),
  template: (slug: string) => api.get<unknown>(`/v1/templates/${enc(slug)}`),
  discover: (params: { category?: string; q?: string; sort?: string; cursor?: string }) =>
    api.get<DiscoverResponse>('/v1/discover', { query: params }),

  proofUpload: (checkinId: string, contentType: 'image/jpeg' | 'image/webp', size: number) =>
    api.post<{ url: string; key: string; headers: Record<string, string>; expiresAt: string }>(
      '/v1/uploads/proof',
      { checkinId, contentType, size },
    ),

  /* you & settings (Phase 8) */
  blocks: () => api.get<{ blocked: { user: PublicUserDTO; createdAt: string }[] }>('/v1/blocks'),
  unblock: (userId: string) => api.del<{ ok: true }>(`/v1/blocks/${enc(userId)}`),
  exportData: () => api.post<{ url: string; expiresAt: string }>('/v1/me/export'),
  deleteAccount: () => api.del<{ ok: true }>('/v1/me'),
  revokeApple: (code: string) => api.post<{ revoked: boolean }>('/v1/me/apple-revoke', { code }),
  plusInterest: (product: 'plus' | 'squad_pro') =>
    api.post<{ ok: true }>('/v1/me/plus-interest', { product }),
  integrations: () =>
    api.get<{ integrations: { provider: IntegrationProvider; handle: string }[] }>(
      '/v1/integrations',
    ),
  setIntegration: (provider: IntegrationProvider, handle: string) =>
    api.put<{ provider: IntegrationProvider; handle: string }>(`/v1/integrations/${provider}`, {
      handle,
    }),
  removeIntegration: (provider: IntegrationProvider) =>
    api.del<{ ok: true }>(`/v1/integrations/${provider}`),
};

export type IntegrationProvider = 'github' | 'leetcode' | 'codeforces';

export interface EditDayInput {
  title?: string;
  rest?: boolean;
  tasks?: Record<string, unknown>[];
}

export interface ChallengeSummaryResponse {
  challenge: ChallengeDTO;
  completion: number;
  members: {
    user: PublicUserDTO;
    daysDone: number;
    daysElapsed: number;
    tasksDone: number;
    bestStreak: number;
    consistency: number;
  }[];
}

export interface JoinSquadResponse {
  status: 'active' | 'pending';
  squad: SquadDTO | null;
  preview: SquadPreviewDTO;
}
