import {
  computeCheckinStatus,
  countsAsDone,
  ulid,
  type CheckinDTO,
  type LocalDate,
  type PlanTask,
  type TaskValue,
  type UpsertCheckinInput,
} from '@sparksquad/shared';
import { withWriteLock } from '../../lib/db/helpers';
import type { LocalDb } from '../../lib/db/types';
import type { Outbox } from '../../lib/outbox/outbox';
import { upsertCheckinRow } from '../../lib/sync/applySync';

export type DraftValues = Record<number, number | boolean>;

/** Draft values → wire values, one per task, typed by task kind. */
export function toTaskValues(tasks: readonly PlanTask[], draft: DraftValues): TaskValue[] {
  return tasks.map((task, t) => {
    const raw = draft[t];
    if (task.type === 'check')
      return { t, v: raw === true || (typeof raw === 'number' && raw > 0) };
    const n = typeof raw === 'number' ? raw : raw === true ? (task.target ?? 1) : 0;
    return { t, v: Math.max(0, Math.round(n)) };
  });
}

/** Wire values → draft (for editing an existing check-in). */
export function fromTaskValues(values: readonly TaskValue[]): DraftValues {
  const out: DraftValues = {};
  for (const v of values) out[v.t] = v.v;
  return out;
}

/** Ticking a task on the Today card: checks flip; numbers jump between 0 and the target. */
export function toggleDraft(
  task: PlanTask,
  current: number | boolean | undefined,
): number | boolean {
  if (task.type === 'check') return !(current === true);
  const target = task.target ?? 1;
  return typeof current === 'number' && current >= target ? 0 : target;
}

export function draftDoneCount(tasks: readonly PlanTask[], draft: DraftValues): number {
  return computeCheckinStatus(tasks, toTaskValues(tasks, draft)).completed;
}

export interface SubmitArgs {
  db: LocalDb;
  outbox: Pick<Outbox, 'enqueue'>;
  userId: string;
  timezone: string;
  challengeId: string;
  localDate: LocalDate;
  dayNumber: number;
  tasks: readonly PlanTask[];
  draft: DraftValues;
  note: string | null;
  honestMiss: boolean;
  hasPhoto: boolean;
  partialCounts: boolean;
  existing: CheckinDTO | null;
  /** Task indices whose value came from GitHub/LeetCode/Codeforces on this phone. */
  verified?: readonly number[];
  now?: Date;
}

export interface SubmitResult {
  checkin: CheckinDTO;
  countsDone: boolean;
}

/** Writes the check-in locally (pending) and queues it; the outbox delivers it when online. */
export async function submitCheckin(a: SubmitArgs): Promise<SubmitResult> {
  const now = (a.now ?? new Date()).toISOString();
  const values = a.honestMiss ? [] : toTaskValues(a.tasks, a.draft);
  const { status, fraction } = computeCheckinStatus(a.tasks, values, a.honestMiss);
  const id = a.existing?.id ?? ulid();
  const note = a.note?.trim() ? a.note.trim() : null;
  const verified = a.honestMiss
    ? []
    : [...new Set(a.verified ?? [])]
        .filter((i) => i >= 0 && i < a.tasks.length)
        .sort((x, y) => x - y);

  const checkin: CheckinDTO = {
    id,
    challengeId: a.challengeId,
    userId: a.userId,
    localDate: a.localDate,
    dayNumber: a.dayNumber,
    status,
    values,
    note,
    hasPhoto: a.hasPhoto,
    photoUrl: a.existing?.photoUrl ?? null,
    verified,
    reactionCount: a.existing?.reactionCount ?? 0,
    commentCount: a.existing?.commentCount ?? 0,
    reactedByMe: a.existing?.reactedByMe ?? false,
    edited: !!a.existing,
    createdAt: a.existing?.createdAt ?? now,
    updatedAt: now,
  };
  const input: UpsertCheckinInput = {
    challengeId: a.challengeId,
    localDate: a.localDate,
    timezone: a.timezone,
    values,
    note,
    honestMiss: a.honestMiss,
    hasPhoto: a.hasPhoto,
    ...(verified.length ? { verified } : {}),
  };

  await withWriteLock(() => upsertCheckinRow(a.db, checkin, 1));
  await a.outbox.enqueue('checkin', `checkin:${a.challengeId}:${a.localDate}`, { id, input });
  return { checkin, countsDone: countsAsDone(status, fraction, a.partialCounts) };
}
