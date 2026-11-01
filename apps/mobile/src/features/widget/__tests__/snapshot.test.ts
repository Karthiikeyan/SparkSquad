import { clearKeyed, clearPrefs } from '../../../lib/prefs';
import type { TodayCard, TodaySource } from '../../today/model';
import { widgetHeading } from '../heading';
import {
  buildWidgetSnapshot,
  buildWidgetView,
  readWidgetSnapshot,
  saveWidgetSnapshot,
  tickWidgetTask,
} from '../snapshot';
import { localDateFromDevice } from '../today';

const TODAY = '2026-11-01';

const task = (title: string) => ({ id: title, title, type: 'check' as const });

const card = (name: string, overrides: Record<string, unknown> = {}) =>
  ({
    challenge: { id: `C-${name}`, title: name, startDate: '2026-10-20', durationDays: 30 },
    state: 'active',
    today: TODAY,
    dayNumber: 13,
    squad: { name },
    day: { rest: false, tasks: [task(`${name} one`), task(`${name} two`)] },
    mine: null,
    checkedCount: 1,
    members: [{}, {}, {}],
    ...overrides,
  }) as unknown as TodayCard;

const source = {
  plans: new Map(),
  edits: new Map(),
} as unknown as TodaySource;

describe('widget snapshot', () => {
  beforeEach(() => {
    clearPrefs();
    clearKeyed();
  });

  it('shows every task of every squad, not just squad names', () => {
    const snap = buildWidgetSnapshot([card('A'), card('B')], source, TODAY);
    const view = buildWidgetView(snap, TODAY);
    expect(view.cards?.map((c) => c.squad)).toEqual(['A', 'B']);
    expect(view.cards?.[0]?.tasks.map((t) => t.title)).toEqual(['A one', 'A two']);
    expect(view.left).toBe(4);
  });

  it('skips rest days and counts checked-in squads as finished', () => {
    const snap = buildWidgetSnapshot(
      [
        card('A', {
          mine: {
            values: [
              { t: 0, v: true },
              { t: 1, v: true },
            ],
          },
        }),
        card('C', { day: { rest: true, tasks: [] } }),
      ],
      source,
      TODAY,
    );
    const view = buildWidgetView(snap, TODAY);
    expect(view.cards).toHaveLength(1);
    expect(view.cards?.[0]).toMatchObject({ checkedIn: true });
    expect(view.left).toBe(0);
    expect(widgetHeading(view)).toBe('All done today');
  });

  it('a tick on the widget is the same draft the check-in sheet opens with', () => {
    const snap = buildWidgetSnapshot([card('A')], source, TODAY);
    expect(tickWidgetTask(snap, 'C-A', TODAY, 1)).toBe(true);
    let view = buildWidgetView(snap, TODAY);
    expect(view.cards?.[0]?.tasks.map((t) => t.done)).toEqual([false, true]);
    expect(view.left).toBe(1);
    expect(widgetHeading(view)).toBe('1 left today');
    tickWidgetTask(snap, 'C-A', TODAY, 1);
    view = buildWidgetView(snap, TODAY);
    expect(view.left).toBe(2);
  });

  it('will not tick a day already checked in, or a task that does not exist', () => {
    const snap = buildWidgetSnapshot([card('A', { mine: { values: [] } })], source, TODAY);
    expect(tickWidgetTask(snap, 'C-A', TODAY, 0)).toBe(false);
    expect(tickWidgetTask(snap, 'C-A', TODAY, 9)).toBe(false);
    expect(tickWidgetTask(snap, 'nope', TODAY, 0)).toBe(false);
  });

  it('asks to open the app when it has nothing for that date', () => {
    const snap = buildWidgetSnapshot([card('A')], source, TODAY);
    const view = buildWidgetView(snap, '2027-01-01');
    expect(view.cards).toBeNull();
    expect(widgetHeading(view)).toBe('Open SparkSquad to refresh');
  });

  it('reports whether anything changed so the widget only redraws when needed', () => {
    const snap = buildWidgetSnapshot([card('A')], source, TODAY);
    expect(saveWidgetSnapshot(snap)).toBe(true);
    expect(saveWidgetSnapshot(snap)).toBe(false);
    expect(readWidgetSnapshot()).toEqual(snap);
  });

  it('formats the device date', () => {
    expect(localDateFromDevice(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
