import type { CheckinDTO, LocalDate, PlanTask } from '@sparksquad/shared';
import { getKeyed, removeKeyed, setKeyed } from '../../lib/prefs';
import { fromTaskValues, toggleDraft, type DraftValues } from './submit';

const keyOf = (challengeId: string, date: LocalDate) => `${challengeId}:${date}`;

/** Ticks made on the Today card before checking in (kept on the phone only). */
export function readDraft(
  challengeId: string,
  date: LocalDate,
  existing: CheckinDTO | null,
): DraftValues {
  return (
    getKeyed<DraftValues>('draft', keyOf(challengeId, date)) ??
    (existing ? fromTaskValues(existing.values) : {})
  );
}

export function writeDraft(challengeId: string, date: LocalDate, draft: DraftValues): void {
  setKeyed('draft', keyOf(challengeId, date), draft);
}

export function clearDraft(challengeId: string, date: LocalDate): void {
  removeKeyed('draft', keyOf(challengeId, date));
}

export function toggleTask(
  challengeId: string,
  date: LocalDate,
  draft: DraftValues,
  index: number,
  task: PlanTask,
): DraftValues {
  const next = { ...draft, [index]: toggleDraft(task, draft[index]) };
  writeDraft(challengeId, date, next);
  return next;
}
