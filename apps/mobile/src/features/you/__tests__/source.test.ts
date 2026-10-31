import type { Plan } from '@sparksquad/shared';
import { plans } from '../../../lib/db/schema';
import { applySync } from '../../../lib/sync/applySync';
import {
  challenge,
  checkin,
  member,
  ME_ID,
  SERVER_TIME,
  squad,
  syncResponse,
} from '../../../test/fixtures';
import { createTestDb } from '../../../test/testDb';
import { countMet, readYouSource } from '../source';

const plan: Plan = {
  sparksquad_plan: 1,
  title: 'DSA 60',
  category: 'career',
  duration_days: 60,
  days: Array.from({ length: 60 }, (_, i) => ({
    day: i + 1,
    title: `Day ${i + 1}`,
    rest: false,
    tasks: [
      { id: 'a', title: 'Problems', type: 'count' as const, target: 2, unit: 'problems' },
      { id: 'b', title: 'Notes', type: 'check' as const },
    ],
  })),
} as unknown as Plan;

describe('readYouSource', () => {
  it('reads my check-ins with tasks met, streaks, badges and squad counts', async () => {
    const { db } = await createTestDb();
    await applySync(
      db,
      syncResponse({
        squads: [squad('S1'), squad('S2', { ownerId: 'U2' })],
        members: [member('S1', ME_ID), { ...member('S2', ME_ID), role: 'member' }],
        challenges: [challenge('C1', 'S1')],
        checkins: [
          checkin('K1', 'C1', ME_ID, '2026-10-30', {
            values: [
              { t: 0, v: 3 },
              { t: 1, v: true },
            ],
          }),
          checkin('K2', 'C1', ME_ID, '2026-10-31', {
            status: 'partial',
            values: [
              { t: 0, v: 1 },
              { t: 1, v: true },
            ],
          }),
          checkin('K3', 'C1', 'U2', '2026-10-31'),
        ],
        streaks: [
          {
            scope: 'global',
            current: 5,
            best: 9,
            freezes: 1,
            lastDoneDate: '2026-10-31',
            updatedAt: SERVER_TIME,
          },
        ],
        badges: [{ badge: 'first_checkin', earnedAt: SERVER_TIME }],
      }),
    );
    await db
      .insert(plans)
      .values({ hash: 'hash1', json: JSON.stringify(plan), fetchedAt: SERVER_TIME });

    const src = await readYouSource(db, ME_ID);
    expect(src.checkins.map((c) => [c.id, c.tasksDone, c.squadName])).toEqual([
      ['K2', 1, 'Squad S1'],
      ['K1', 2, 'Squad S1'],
    ]);
    expect(src.current).toBe(5);
    expect(src.best).toBe(9);
    expect(src.badges).toEqual([{ badge: 'first_checkin', earnedAt: SERVER_TIME }]);
    expect(src.squadCount).toBe(2);
    expect(src.ownedCount).toBe(1);
    expect(src.firstJoined).toBe(SERVER_TIME);
  });

  it('counts truthy values when the plan is not cached, and zero for honest misses', () => {
    expect(
      countMet(
        {
          status: 'done',
          values: [
            { t: 0, v: 2 },
            { t: 1, v: false },
          ],
        },
        null,
      ),
    ).toBe(1);
    expect(countMet({ status: 'honest_miss', values: [{ t: 0, v: true }] }, null)).toBe(0);
  });
});
