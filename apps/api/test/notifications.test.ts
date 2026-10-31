import { addDays } from '@sparksquad/shared';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { isMilestoneDay, runHourly } from '../src/cron/hourly';
import {
  checkinBody,
  makeChallenge,
  makeSquad,
  newId,
  signIn,
  today,
  type Client,
} from './helpers';

async function inbox(u: Client, kind: string) {
  const res = await env.DB.prepare(
    'select payload from notifications where user_id = ? and kind = ? order by created_at',
  )
    .bind(u.id, kind)
    .all<{ payload: string }>();
  return res.results.map((r) => JSON.parse(r.payload) as Record<string, unknown>);
}

describe('notifications', () => {
  it('tells the author about comments and groups fires into one item', async () => {
    const author = await signIn('notif-author@example.com');
    const a = await signIn('notif-a@example.com');
    const b = await signIn('notif-b@example.com');
    const sq = await makeSquad(author);
    for (const u of [a, b]) await u.req('POST', '/v1/squads/join', { squadId: sq.id });
    const ch = await makeChallenge(author, sq.id);
    const id = newId();
    await author.req('PUT', `/v1/checkins/${id}`, checkinBody(ch.id));

    expect((await a.req('POST', `/v1/checkins/${id}/comments`, { body: 'Nice' })).status).toBe(201);
    await a.req('PUT', `/v1/checkins/${id}/reactions/fire`);
    await b.req('PUT', `/v1/checkins/${id}/reactions/fire`);
    // Reacting on your own check-in never notifies.
    await author.req('PUT', `/v1/checkins/${id}/reactions/fire`);

    const comments = await inbox(author, 'comment');
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({ checkinId: id, body: 'Nice', squadId: sq.id });
    const fires = await inbox(author, 'fires');
    expect(fires).toHaveLength(1);
    expect(fires[0]).toMatchObject({ checkinId: id, count: 2 });
  });

  it('respects the switches and tells owners about new members', async () => {
    const owner = await signIn('notif-owner@example.com');
    const quiet = await signIn('notif-quiet@example.com');
    const joiner = await signIn('notif-joiner@example.com');
    const sq = await makeSquad(quiet);
    await quiet.req('PATCH', '/v1/me', { notifyComments: false, notifyMembers: false });
    await owner.req('POST', '/v1/squads/join', { squadId: sq.id });
    const ch = await makeChallenge(quiet, sq.id);
    const id = newId();
    await quiet.req('PUT', `/v1/checkins/${id}`, checkinBody(ch.id));
    await owner.req('POST', `/v1/checkins/${id}/comments`, { body: 'Go' });
    expect(await inbox(quiet, 'comment')).toHaveLength(0);
    expect(await inbox(quiet, 'member_joined')).toHaveLength(0);

    const mine = await makeSquad(owner, { name: 'Owner squad' });
    await joiner.req('POST', '/v1/squads/join', { squadId: mine.id });
    expect(await inbox(owner, 'member_joined')).toEqual([
      expect.objectContaining({ squadId: mine.id, userId: joiner.id }),
    ]);
    const me = await quiet.req<{ notifyComments: boolean; notifyStreakRisk: boolean }>(
      'GET',
      '/v1/me',
    );
    expect(me.json).toMatchObject({ notifyComments: false, notifyStreakRisk: true });
  });

  it('marks squad milestones at the morning digest hour', async () => {
    const owner = await signIn('notif-milestone@example.com');
    const sq = await makeSquad(owner);
    await makeChallenge(owner, sq.id, addDays(today(), -6), 7);
    // 09:30 in Asia/Kolkata (UTC+5:30) on the test's local date.
    await runHourly(env, new Date(`${today()}T04:00:00Z`));
    expect(await inbox(owner, 'milestone')).toEqual([
      expect.objectContaining({ squadId: sq.id, day: 7, total: 7 }),
    ]);
  });

  it('knows which days are milestones', () => {
    expect(isMilestoneDay(7, 60)).toBe(true);
    expect(isMilestoneDay(30, 60)).toBe(true);
    expect(isMilestoneDay(60, 60)).toBe(true);
    expect(isMilestoneDay(11, 21)).toBe(true);
    expect(isMilestoneDay(1, 30)).toBe(false);
    expect(isMilestoneDay(8, 60)).toBe(false);
  });
});
