import type { PlanTask } from '@sparksquad/shared';
import { checkins } from '../../../lib/db/schema';
import { createOutbox } from '../../../lib/outbox/outbox';
import { checkin, ME_ID } from '../../../test/fixtures';
import { createTestDb } from '../../../test/testDb';
import {
  draftDoneCount,
  fromTaskValues,
  submitCheckin,
  toggleDraft,
  toTaskValues,
} from '../submit';

const tasks: PlanTask[] = [
  { id: 'a', title: 'Problems', type: 'count', target: 2, unit: 'problems' },
  { id: 'b', title: 'Lesson', type: 'minutes', target: 30 },
  { id: 'c', title: 'Notes', type: 'check' },
];

describe('draft values', () => {
  it('maps drafts to typed wire values', () => {
    expect(toTaskValues(tasks, { 0: true, 1: 12.6, 2: 1 })).toEqual([
      { t: 0, v: 2 },
      { t: 1, v: 13 },
      { t: 2, v: true },
    ]);
    expect(toTaskValues(tasks, {})).toEqual([
      { t: 0, v: 0 },
      { t: 1, v: 0 },
      { t: 2, v: false },
    ]);
    expect(fromTaskValues([{ t: 1, v: 30 }])).toEqual({ 1: 30 });
  });

  it('toggles checks and jumps numbers between 0 and the target', () => {
    expect(toggleDraft(tasks[2]!, undefined)).toBe(true);
    expect(toggleDraft(tasks[2]!, true)).toBe(false);
    expect(toggleDraft(tasks[0]!, undefined)).toBe(2);
    expect(toggleDraft(tasks[0]!, 2)).toBe(0);
    expect(toggleDraft(tasks[0]!, 1)).toBe(2);
  });

  it('counts tasks met', () => {
    expect(draftDoneCount(tasks, { 0: 2, 1: 10, 2: true })).toBe(2);
  });
});

describe('submitCheckin', () => {
  async function setup() {
    const { db } = await createTestDb();
    const outbox = createOutbox({ db, handlers: {} as never });
    const base = {
      db,
      outbox,
      userId: ME_ID,
      timezone: 'Asia/Kolkata',
      challengeId: 'C1',
      localDate: '2026-10-31',
      dayNumber: 12,
      tasks,
      note: '  Sliding window clicked.  ',
      honestMiss: false,
      hasPhoto: false,
      partialCounts: true,
      existing: null,
    };
    return { db, outbox, base };
  }

  it('writes a pending row and queues the upsert', async () => {
    const { db, outbox, base } = await setup();
    const res = await submitCheckin({ ...base, draft: { 0: 2, 1: 30, 2: true } });
    expect(res.checkin.status).toBe('done');
    expect(res.countsDone).toBe(true);
    const row = await db.select().from(checkins).get();
    expect(row).toMatchObject({ id: res.checkin.id, pending: 1, status: 'done' });
    const [item] = await outbox.list();
    expect(item).toMatchObject({ kind: 'checkin', entityKey: 'checkin:C1:2026-10-31' });
    expect(item!.payload).toMatchObject({
      id: res.checkin.id,
      input: {
        challengeId: 'C1',
        localDate: '2026-10-31',
        note: 'Sliding window clicked.',
        honestMiss: false,
      },
    });
  });

  it('applies the partial rule locally', async () => {
    const { base } = await setup();
    const half = await submitCheckin({ ...base, draft: { 0: 2, 1: 30 } });
    expect(half.checkin.status).toBe('partial');
    expect(half.countsDone).toBe(true);
    const strict = await submitCheckin({ ...base, partialCounts: false, draft: { 0: 2, 1: 30 } });
    expect(strict.countsDone).toBe(false);
  });

  it('reuses the existing id for edits and coalesces the queue', async () => {
    const { outbox, base } = await setup();
    const existing = checkin('K1', 'C1', ME_ID, '2026-10-31', { reactionCount: 3 });
    const a = await submitCheckin({ ...base, existing, draft: { 2: true } });
    const b = await submitCheckin({ ...base, existing, draft: { 0: 2, 1: 30, 2: true } });
    expect(a.checkin.id).toBe('K1');
    expect(b.checkin).toMatchObject({ id: 'K1', edited: true, reactionCount: 3 });
    expect(await outbox.list()).toHaveLength(1);
  });

  it('sends an honest miss without values', async () => {
    const { outbox, base } = await setup();
    const res = await submitCheckin({
      ...base,
      honestMiss: true,
      hasPhoto: false,
      draft: { 0: 2 },
    });
    expect(res.checkin).toMatchObject({ status: 'honest_miss', values: [] });
    expect(res.countsDone).toBe(false);
    expect((await outbox.list())[0]!.payload).toMatchObject({
      input: { values: [], honestMiss: true },
    });
  });
});
