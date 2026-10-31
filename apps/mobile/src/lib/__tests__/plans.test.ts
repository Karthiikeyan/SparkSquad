import type { Plan, PlanDay } from '@sparksquad/shared';
import { challenges, plans } from '../db/schema';
import { createTestDb } from '../../test/testDb';
import { effectiveDay, ensurePlans, readPlan } from '../plans';

jest.mock('../api/endpoints', () => ({ endpoints: { plan: jest.fn() } }));

const plan = (title: string): Plan => ({
  sparksquad_plan: 1,
  title,
  category: 'career',
  duration_days: 2,
  days_per_week: 7,
  phases: [],
  days: [
    { day: 1, title: 'One', rest: false, tasks: [{ id: 'd1t0', title: 'A', type: 'check' }] },
    { day: 2, title: 'Two', rest: true, tasks: [] },
  ],
  milestones: [],
});

async function addChallenge(
  db: Awaited<ReturnType<typeof createTestDb>>['db'],
  id: string,
  hash: string,
  status = 'active',
) {
  await db.insert(challenges).values({
    id,
    squadId: 'S1',
    status,
    startDate: '2026-10-20',
    durationDays: 2,
    planHash: hash,
    data: '{}',
    updatedAt: '',
  });
}

describe('plan cache', () => {
  it('fetches each missing hash once, skips cached ones and drops stale plans', async () => {
    const { db } = await createTestDb();
    await addChallenge(db, 'C1', 'h1');
    await addChallenge(db, 'C2', 'h1');
    await addChallenge(db, 'C3', 'h2');
    await addChallenge(db, 'OLD', 'h-old', 'ended');
    await db
      .insert(plans)
      .values({ hash: 'h2', json: JSON.stringify(plan('cached')), fetchedAt: '' });
    await db.insert(plans).values({ hash: 'h-old', json: '{}', fetchedAt: '' });
    const fetchPlan = jest.fn(async () => plan('fresh'));
    expect(await ensurePlans(db, fetchPlan)).toBe(1);
    expect(fetchPlan).toHaveBeenCalledTimes(1);
    expect((await readPlan(db, 'h1'))?.title).toBe('fresh');
    expect((await readPlan(db, 'h2'))?.title).toBe('cached');
    expect(await readPlan(db, 'h-old')).toBeNull();
  });

  it('keeps going when a download fails (offline)', async () => {
    const { db } = await createTestDb();
    await addChallenge(db, 'C1', 'h1');
    const fetchPlan = jest.fn(async () => {
      throw new Error('offline');
    });
    expect(await ensurePlans(db, fetchPlan)).toBe(0);
    expect(await readPlan(db, 'h1')).toBeNull();
  });

  it('overlays day edits', () => {
    const edit: PlanDay = {
      day: 2,
      title: 'Mock test',
      rest: false,
      tasks: [{ id: 'x', title: 'Mock', type: 'check' }],
    };
    expect(effectiveDay(plan('p'), [edit], 2)).toMatchObject({ title: 'Mock test', rest: false });
    expect(effectiveDay(plan('p'), [edit], 1)?.title).toBe('One');
    expect(effectiveDay(plan('p'), [], 9)).toBeNull();
  });
});
