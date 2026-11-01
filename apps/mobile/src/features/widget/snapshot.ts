import { addDays, rawDayNumber, type PlanTask } from '@sparksquad/shared';
import { getPref, setPref, type Prefs } from '../../lib/prefs';
import { readDraft, toggleTask } from '../checkin/drafts';
import { fromTaskValues, type DraftValues } from '../checkin/submit';
import { dayFor, type TodayCard, type TodaySource } from '../today/model';

export type WidgetSnapshot = NonNullable<Prefs['widgetSnapshot']>;
type SnapshotRow = WidgetSnapshot['days'][string][number];

/** Today plus two days ahead, so the widget is right after midnight with the app closed. */
const DAYS_AHEAD = 3;

function rowsFor(cards: readonly TodayCard[], source: TodaySource, offset: number): SnapshotRow[] {
  const rows: SnapshotRow[] = [];
  for (const card of cards) {
    if (card.state !== 'active' && card.state !== 'upcoming') continue;
    const n = rawDayNumber(addDays(card.today, offset), card.challenge.startDate);
    if (n < 1 || n > card.challenge.durationDays) continue;
    const day = offset === 0 ? card.day : dayFor(source, card.challenge, n);
    if (!day || day.rest) continue;
    const mine = offset === 0 ? card.mine : null;
    rows.push({
      challengeId: card.challenge.id,
      squad: card.squad.name,
      title: card.challenge.title,
      checkedIn: !!mine,
      checked: offset === 0 ? card.checkedCount : 0,
      members: card.members.length,
      tasks: day.tasks.map((task) => ({
        title: task.title,
        type: task.type,
        ...(task.target !== undefined ? { target: task.target } : {}),
        ...(task.unit !== undefined ? { unit: task.unit } : {}),
      })),
      values: mine ? fromTaskValues(mine.values) : {},
    });
  }
  return rows;
}

/** What the home-screen widget shows, saved on the phone so it never needs the network. */
export function buildWidgetSnapshot(
  cards: readonly TodayCard[],
  source: TodaySource,
  today: string,
): WidgetSnapshot {
  const days: WidgetSnapshot['days'] = {};
  for (let i = 0; i < DAYS_AHEAD; i++) {
    days[addDays(today, i)] = rowsFor(cards, source, i);
  }
  return { days };
}

export function readWidgetSnapshot(): WidgetSnapshot | null {
  return getPref('widgetSnapshot') ?? null;
}

export function saveWidgetSnapshot(snapshot: WidgetSnapshot): boolean {
  if (JSON.stringify(readWidgetSnapshot()) === JSON.stringify(snapshot)) return false;
  setPref('widgetSnapshot', snapshot);
  return true;
}

export interface WidgetTask {
  title: string;
  done: boolean;
}

export interface WidgetCard {
  challengeId: string;
  squad: string;
  checkedIn: boolean;
  checked: number;
  members: number;
  tasks: WidgetTask[];
}

export interface WidgetView {
  date: string;
  /** Null when the phone has no data for this date yet. */
  cards: WidgetCard[] | null;
  /** Tasks still to do, across every squad. */
  left: number;
}

function taskDone(task: SnapshotRow['tasks'][number], value: number | boolean | undefined) {
  if (task.type === 'check') return value === true;
  return typeof value === 'number' && value >= (task.target ?? 1);
}

/** Combines the snapshot with whatever has been ticked since, on the widget or in the app. */
export function buildWidgetView(snapshot: WidgetSnapshot | null, date: string): WidgetView {
  const rows = snapshot?.days[date];
  if (!rows) return { date, cards: null, left: 0 };
  const cards = rows.map((row): WidgetCard => {
    const draft: DraftValues = row.checkedIn ? row.values : readDraft(row.challengeId, date, null);
    return {
      challengeId: row.challengeId,
      squad: row.squad,
      checkedIn: row.checkedIn,
      checked: row.checked,
      members: row.members,
      tasks: row.tasks.map((task, i) => ({ title: task.title, done: taskDone(task, draft[i]) })),
    };
  });
  const left = cards
    .filter((c) => !c.checkedIn)
    .reduce((n, c) => n + c.tasks.filter((x) => !x.done).length, 0);
  return { date, cards, left };
}

/** A tick on the widget: the same draft the app's check-in sheet opens with. */
export function tickWidgetTask(
  snapshot: WidgetSnapshot | null,
  challengeId: string,
  date: string,
  index: number,
): boolean {
  const row = snapshot?.days[date]?.find((r) => r.challengeId === challengeId);
  const task = row?.tasks[index];
  if (!row || !task || row.checkedIn) return false;
  toggleTask(challengeId, date, readDraft(challengeId, date, null), index, task as PlanTask);
  return true;
}
