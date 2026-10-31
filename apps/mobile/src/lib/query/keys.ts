/**
 * Query keys. Everything under `local` reads the on-device SQLite store and is invalidated
 * after a sync or an outbox change; other keys are direct API reads.
 */
export const qk = {
  local: ['local'] as const,
  today: ['local', 'today'] as const,
  me: ['local', 'me'] as const,
  squads: ['local', 'squads'] as const,
  squad: (id: string) => ['local', 'squad', id] as const,
  board: (squadId: string, date: string) => ['local', 'board', squadId, date] as const,
  streaks: ['local', 'streaks'] as const,
  notifications: ['local', 'notifications'] as const,
  outbox: ['local', 'outbox'] as const,
  plan: (hash: string) => ['local', 'plan', hash] as const,
  config: ['config'] as const,
  comments: (checkinId: string) => ['comments', checkinId] as const,
  leaderboard: (challengeId: string, range: string) => ['leaderboard', challengeId, range] as const,
  discover: (category: string | undefined, q: string | undefined) =>
    ['discover', category ?? '', q ?? ''] as const,
  templates: ['templates'] as const,
};
