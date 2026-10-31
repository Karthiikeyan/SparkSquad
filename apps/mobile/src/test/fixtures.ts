import type {
  ChallengeDTO,
  CheckinDTO,
  MeDTO,
  MemberDTO,
  SquadDTO,
  SyncResponse,
} from '@sparksquad/shared';

export const ME_ID = 'U_ME';
export const SERVER_TIME = '2026-10-31T06:00:00.000Z';
export const TODAY = '2026-10-31';

export function me(overrides: Partial<MeDTO> = {}): MeDTO {
  return {
    id: ME_ID,
    email: 'me@example.com',
    username: 'me',
    displayName: 'Kiran Raj',
    avatarColor: 5,
    timezone: 'Asia/Kolkata',
    interests: ['career'],
    reminderTime: '20:00',
    notifyMissedDay: true,
    notifySquadUpdates: true,
    notifyNudges: true,
    plan: 'free',
    planExpiresAt: null,
    ageConfirmedAt: SERVER_TIME,
    termsAcceptedAt: SERVER_TIME,
    createdAt: SERVER_TIME,
    isAdmin: false,
    ...overrides,
  };
}

export function squad(id: string, overrides: Partial<SquadDTO> = {}): SquadDTO {
  return {
    id,
    name: `Squad ${id}`,
    description: '',
    rules: '',
    category: 'career',
    privacy: 'private',
    ownerId: ME_ID,
    inviteCode: 'ABC234',
    chatUrl: null,
    memberLimit: 100,
    memberCount: 2,
    isPro: false,
    allowPersonalTargets: false,
    partialCounts: true,
    createdAt: SERVER_TIME,
    updatedAt: SERVER_TIME,
    archivedAt: null,
    ...overrides,
  };
}

export function member(squadId: string, userId: string, name = userId): MemberDTO {
  return {
    squadId,
    user: { id: userId, username: null, displayName: name, avatarColor: 1 },
    role: userId === ME_ID ? 'owner' : 'member',
    status: 'active',
    joinedAt: SERVER_TIME,
    updatedAt: SERVER_TIME,
  };
}

export function challenge(id: string, squadId: string): ChallengeDTO {
  return {
    id,
    squadId,
    title: 'DSA 60',
    planHash: 'hash1',
    planVersion: 1,
    durationDays: 60,
    daysPerWeek: 7,
    startDate: '2026-10-20',
    status: 'active',
    createdBy: ME_ID,
    createdAt: SERVER_TIME,
    endedAt: null,
    updatedAt: SERVER_TIME,
  };
}

export function checkin(
  id: string,
  challengeId: string,
  userId: string,
  localDate = TODAY,
  overrides: Partial<CheckinDTO> = {},
): CheckinDTO {
  return {
    id,
    challengeId,
    userId,
    localDate,
    dayNumber: 12,
    status: 'done',
    values: [{ t: 0, v: true }],
    note: null,
    hasPhoto: false,
    photoUrl: null,
    verified: [],
    reactionCount: 0,
    commentCount: 0,
    reactedByMe: false,
    edited: false,
    createdAt: SERVER_TIME,
    updatedAt: SERVER_TIME,
    ...overrides,
  };
}

export function syncResponse(overrides: Partial<SyncResponse> = {}): SyncResponse {
  return {
    me: me(),
    squads: [],
    removedSquadIds: [],
    members: [],
    users: [],
    challenges: [],
    dayEdits: [],
    announcements: [],
    checkins: [],
    nudges: [],
    streaks: [],
    badges: [],
    notifications: [],
    blockedUserIds: [],
    nextCursor: 'cursor-1',
    serverTime: SERVER_TIME,
    ...overrides,
  };
}
