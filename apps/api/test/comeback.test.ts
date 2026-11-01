import { env } from 'cloudflare:workers';
import { addDays } from '@sparksquad/shared';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createDb } from '../src/db/client';
import { badges, challenges, checkins } from '../src/db/schema';
import {
  checkinBody,
  makeChallenge,
  makeSquad,
  newId,
  signIn,
  today,
  type Client,
} from './helpers';

type Res = {
  checkin: { restart?: boolean };
  streak: { current: number };
  globalStreak: { current: number };
};

const ONE_TASK = [{ t: 1, v: true }];

/** A challenge that began `started` days ago, with the given earlier days already done. */
async function challengeWithHistory(owner: Client, started: number, doneDaysAgo: number[]) {
  // Partial days off, so one task proves the restart rule and not the partial rule.
  const sq = await makeSquad(owner, { partialCounts: false });
  const ch = await makeChallenge(owner, sq.id, today(), 30);
  const d = createDb(env.DB);
  const startDate = addDays(today(), -started);
  await d.update(challenges).set({ startDate }).where(eq(challenges.id, ch.id)).run();
  for (const ago of doneDaysAgo) {
    const ts = new Date().toISOString();
    await d
      .insert(checkins)
      .values({
        id: newId(),
        challengeId: ch.id,
        userId: owner.id,
        localDate: addDays(today(), -ago),
        dayNumber: started - ago + 1,
        status: 'done',
        countsDone: true,
        tasksDone: 2,
        values: '[]',
        verified: '[]',
        createdAt: ts,
        updatedAt: ts,
      })
      .run();
  }
  return { ch, sq };
}

const put = (c: Client, challengeId: string, restart: boolean) =>
  c.req<Res>('PUT', `/v1/checkins/${newId()}`, {
    ...checkinBody(challengeId, today(), ONE_TASK),
    ...(restart ? { restart: true } : {}),
  });

describe('comeback flow', () => {
  it('one task on a restart day carries the old streak over the missed days', async () => {
    const owner = await signIn('back-saved@example.com');
    const { ch } = await challengeWithHistory(owner, 4, [4, 3]);
    const res = await put(owner, ch.id, true);
    expect(res.status).toBe(200);
    expect(res.json.checkin.restart).toBe(true);
    expect(res.json.streak.current).toBe(3);
    expect(res.json.globalStreak.current).toBe(3);
  });

  it('the same one task without a restart day does not count', async () => {
    const owner = await signIn('back-plain@example.com');
    const { ch } = await challengeWithHistory(owner, 4, [4, 3]);
    const res = await put(owner, ch.id, false);
    expect(res.json.checkin.restart).toBeUndefined();
    expect(res.json.streak.current).toBe(0);
  });

  it('after too many missed days it still counts, but starts a new streak', async () => {
    const owner = await signIn('back-long@example.com');
    const { ch } = await challengeWithHistory(owner, 10, [10]);
    const res = await put(owner, ch.id, true);
    expect(res.json.checkin.restart).toBe(true);
    expect(res.json.streak.current).toBe(1);
  });

  it('is refused while the streak is alive, whatever the phone says', async () => {
    const owner = await signIn('back-alive@example.com');
    const { ch } = await challengeWithHistory(owner, 2, [2, 1]);
    const res = await put(owner, ch.id, true);
    expect(res.json.checkin.restart).toBeUndefined();
    expect(res.json.streak.current).toBe(2);
  });

  it('can only be used once a week', async () => {
    const owner = await signIn('back-twice@example.com');
    const { ch } = await challengeWithHistory(owner, 6, [6]);
    const d = createDb(env.DB);
    await d.update(checkins).set({ restart: true }).where(eq(checkins.challengeId, ch.id)).run();
    const res = await put(owner, ch.id, true);
    expect(res.json.checkin.restart).toBeUndefined();
  });

  it('never applies without at least one finished task', async () => {
    const owner = await signIn('back-empty@example.com');
    const { ch } = await challengeWithHistory(owner, 4, [4, 3]);
    const res = await owner.req<Res>('PUT', `/v1/checkins/${newId()}`, {
      ...checkinBody(ch.id, today(), []),
      restart: true,
    });
    expect(res.json.checkin.restart).toBeUndefined();
  });
});

describe('moments', () => {
  const earned = async (id: string) =>
    (await createDb(env.DB).select().from(badges).where(eq(badges.userId, id)).all()).map(
      (b) => b.badge,
    );

  it('earns Comeback for coming back', async () => {
    const owner = await signIn('m-back@example.com');
    const { ch } = await challengeWithHistory(owner, 4, [4, 3]);
    await put(owner, ch.id, true);
    expect(await earned(owner.id)).toContain('comeback');
  });

  it('earns Truth Teller for an honest miss', async () => {
    const owner = await signIn('m-honest@example.com');
    const sq = await makeSquad(owner);
    const ch = await makeChallenge(owner, sq.id);
    await owner.req('PUT', `/v1/checkins/${newId()}`, {
      ...checkinBody(ch.id, today(), []),
      honestMiss: true,
    });
    expect(await earned(owner.id)).toContain('truth_teller');
  });

  it('gives everyone Full House when the whole squad is in', async () => {
    const owner = await signIn('m-house-a@example.com');
    const mate = await signIn('m-house-b@example.com');
    const sq = await makeSquad(owner, { privacy: 'public' });
    const ch = await makeChallenge(owner, sq.id);
    await mate.req('POST', '/v1/squads/join', { squadId: sq.id });
    await owner.req('PUT', `/v1/checkins/${newId()}`, checkinBody(ch.id));
    expect(await earned(owner.id)).not.toContain('full_house');
    await mate.req('PUT', `/v1/checkins/${newId()}`, checkinBody(ch.id));
    expect(await earned(owner.id)).toContain('full_house');
    expect(await earned(mate.id)).toContain('full_house');
  });
});
