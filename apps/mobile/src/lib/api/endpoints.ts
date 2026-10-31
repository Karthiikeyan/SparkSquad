import type {
  BadgeId,
  CheckinDTO,
  CommentDTO,
  ConfigResponse,
  MeDTO,
  Plan,
  PublicUserDTO,
  SquadDTO,
  SquadPreviewDTO,
  StreakDTO,
  SyncResponse,
  UpdateMeInput,
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
  registerPushToken: (token: string, platform: 'ios' | 'android') =>
    api.put<{ ok: true }>('/v1/push-tokens', { token, platform }),
  removePushToken: (token: string) => api.del<{ ok: true }>(`/v1/push-tokens/${enc(token)}`),
};

export interface JoinSquadResponse {
  status: 'active' | 'pending';
  squad: SquadDTO | null;
  preview: SquadPreviewDTO;
}
