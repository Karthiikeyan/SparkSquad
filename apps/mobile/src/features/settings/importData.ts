import { updateMeSchema, type MeDTO, type UpdateMeInput } from '@sparksquad/shared';
import { type IntegrationProvider } from '../../lib/api/endpoints';

/** Fields a file may restore. Username (could be taken) and timezone (this phone's) stay as is. */
const RESTORABLE = [
  'displayName',
  'avatarColor',
  'interests',
  'reminderTime',
  'notifyMissedDay',
  'notifySquadUpdates',
  'notifyNudges',
  'notifyComments',
  'notifyMembers',
  'notifyMilestones',
  'notifyStreakRisk',
  'notifyChallengeStart',
] as const;

const PROVIDERS: readonly IntegrationProvider[] = ['github', 'leetcode', 'codeforces'];

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

export interface ImportPlan {
  profile: UpdateMeInput;
  integrations: { provider: IntegrationProvider; handle: string }[];
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Reads a SparkSquad export. Only settings come back: the file can be edited, so check-ins, streaks
 * and badges are never written from it (that would let anyone fake a leaderboard).
 */
export function parseExportFile(text: string): ImportPlan | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObject(data) || typeof data.exportedAt !== 'string' || !isObject(data.profile)) {
    return null;
  }
  const profile: Record<string, unknown> = {};
  for (const field of RESTORABLE) {
    const candidate = { [field]: data.profile[field] };
    if (data.profile[field] === undefined) continue;
    const checked = updateMeSchema.safeParse(candidate);
    if (checked.success) profile[field] = (checked.data as Record<string, unknown>)[field];
  }
  const integrations: ImportPlan['integrations'] = [];
  if (Array.isArray(data.integrations)) {
    for (const row of data.integrations) {
      if (!isObject(row) || typeof row.handle !== 'string' || !row.handle) continue;
      const provider = PROVIDERS.find((p) => p === row.provider);
      if (provider) integrations.push({ provider, handle: row.handle });
    }
  }
  return { profile: profile as UpdateMeInput, integrations };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Drops everything that already matches this account, so the confirm step lists real changes. */
export function diffImport(
  plan: ImportPlan,
  me: MeDTO,
  connected: Partial<Record<IntegrationProvider, string>>,
): ImportPlan {
  const profile: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(plan.profile)) {
    if (!same(value, (me as unknown as Record<string, unknown>)[field])) profile[field] = value;
  }
  return {
    profile: profile as UpdateMeInput,
    integrations: plan.integrations.filter((i) => connected[i.provider] !== i.handle),
  };
}

export function isEmptyImport(plan: ImportPlan): boolean {
  return Object.keys(plan.profile).length === 0 && plan.integrations.length === 0;
}
