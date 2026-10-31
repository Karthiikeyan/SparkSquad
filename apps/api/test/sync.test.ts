import { addDays } from '@sparksquad/shared';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { checkinBody, makeChallenge, makeSquad, newId, raw, signIn, today } from './helpers';

interface Sync {
  squads: { id: string }[];
  removedSquadIds: string[];
  members: { user: { id: string } }[];
  challenges: { id: string }[];
  checkins: { id: string; userId: string }[];
  notifications: { kind: string }[];
  nextCursor: string;
}

describe('sync', () => {
  it('returns everything first, then only changes since the cursor', async () => {
    const owner = await signIn('sync-owner@example.com');
    const friend = await signIn('sync-friend@example.com');
    const sq = await makeSquad(owner);
    await friend.req('POST', '/v1/squads/join', { squadId: sq.id });
    const ch = await makeChallenge(owner, sq.id);
    await owner.req('PUT', `/v1/checkins/${newId()}`, checkinBody(ch.id));

    const first = await friend.req<Sync>('GET', '/v1/sync');
    expect(first.status).toBe(200);
    expect(first.json.squads.map((s) => s.id)).toEqual([sq.id]);
    expect(first.json.members).toHaveLength(2);
    expect(first.json.challenges.map((c) => c.id)).toEqual([ch.id]);
    expect(first.json.checkins).toHaveLength(1);

    // Make the cursor strictly older than the next write.
    const cursor = btoa(new Date(Date.now() + 5_000).toISOString());
    const quiet = await friend.req<Sync>('GET', `/v1/sync?since=${encodeURIComponent(cursor)}`);
    expect(quiet.json.squads).toEqual([]);
    expect(quiet.json.checkins).toEqual([]);

    const mid = btoa(new Date(Date.now() - 1).toISOString());
    await new Promise((r) => setTimeout(r, 5));
    await friend.req('PUT', `/v1/checkins/${newId()}`, checkinBody(ch.id));
    const delta = await owner.req<Sync>('GET', `/v1/sync?since=${encodeURIComponent(mid)}`);
    expect(delta.json.checkins.map((c) => c.userId)).toEqual([friend.id]);
    expect(delta.json.squads).toEqual([]);
  });

  it('reports squads I left and hides blocked users', async () => {
    const owner = await signIn('sync-block-owner@example.com');
    const friend = await signIn('sync-block-friend@example.com');
    const sq = await makeSquad(owner);
    await friend.req('POST', '/v1/squads/join', { squadId: sq.id });
    const ch = await makeChallenge(owner, sq.id);
    await friend.req('PUT', `/v1/checkins/${newId()}`, checkinBody(ch.id));

    await owner.req('PUT', `/v1/blocks/${friend.id}`);
    const s = await owner.req<Sync>('GET', '/v1/sync');
    expect(s.json.checkins).toEqual([]);
    expect(s.json.members.map((m) => m.user.id)).toEqual([owner.id]);

    const before = btoa(new Date(Date.now() - 1000).toISOString());
    await friend.req('POST', `/v1/squads/${sq.id}/leave`);
    const after = await friend.req<Sync>('GET', `/v1/sync?since=${encodeURIComponent(before)}`);
    expect(after.json.removedSquadIds).toEqual([sq.id]);
  });

  it('delivers notifications for join requests', async () => {
    const owner = await signIn('sync-req-owner@example.com');
    const asker = await signIn('sync-req-asker@example.com');
    const sq = await makeSquad(owner, { privacy: 'private' });
    await asker.req('POST', '/v1/squads/join', { code: sq.inviteCode.toLowerCase() });
    const s = await owner.req<Sync>('GET', '/v1/sync');
    expect(s.json.notifications.map((n) => n.kind)).toContain('join_request');
  });
});

describe('leaderboard maths', () => {
  it('ranks by share of days, ties broken by tasks', async () => {
    const owner = await signIn('lb-owner@example.com');
    const a = await signIn('lb-a@example.com');
    const b = await signIn('lb-b@example.com');
    const sq = await makeSquad(owner);
    for (const u of [a, b]) await u.req('POST', '/v1/squads/join', { squadId: sq.id });
    const start = addDays(today(), -3);
    const ch = await makeChallenge(owner, sq.id, start, 10);
    // Backdate joins so all three count from the start.
    await env.DB.prepare('update squad_members set joined_at = ? where squad_id = ?')
      .bind(`${start}T00:00:00.000Z`, sq.id)
      .run();

    const insert = (
      userId: string,
      offset: number,
      status: string,
      countsDone: number,
      tasks: number,
    ) =>
      env.DB.prepare(
        'insert into checkins (id, challenge_id, user_id, local_date, day_number, status, counts_done, tasks_done) values (?, ?, ?, ?, ?, ?, ?, ?)',
      )
        .bind(newId(), ch.id, userId, addDays(start, offset), offset + 1, status, countsDone, tasks)
        .run();
    // Days 1-3 elapsed (today not checked in yet for anyone).
    for (const o of [0, 1, 2]) await insert(owner.id, o, 'done', 1, 2);
    for (const o of [0, 1, 2])
      await insert(a.id, o, o === 2 ? 'partial' : 'done', 1, o === 2 ? 1 : 2);
    await insert(b.id, 0, 'done', 1, 2);

    const res = await a.req<{
      entries: {
        user: { id: string };
        rank: number;
        score: number;
        daysDone: number;
        daysElapsed: number;
        isMe: boolean;
      }[];
    }>('GET', `/v1/challenges/${ch.id}/leaderboard?range=challenge`);
    expect(res.status).toBe(200);
    const rows = res.json.entries.map((e) => [
      e.user.id,
      e.rank,
      e.score,
      e.daysDone,
      e.daysElapsed,
    ]);
    expect(rows).toEqual([
      [owner.id, 1, 100, 3, 3],
      [a.id, 2, 100, 3, 3],
      [b.id, 3, 33, 1, 3],
    ]);
    expect(res.json.entries.find((e) => e.isMe)?.user.id).toBe(a.id);
  });
});

describe('RevenueCat webhook', () => {
  const post = (body: unknown, auth = 'Bearer test-rc-secret') =>
    raw('/webhooks/revenuecat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: auth },
      body: JSON.stringify(body),
    });

  it('rejects a wrong secret', async () => {
    expect((await post({ event: {} }, 'Bearer nope')).status).toBe(401);
  });

  it('grants and revokes Plus, idempotent by event id', async () => {
    const u = await signIn('rc-user@example.com');
    const exp = Date.now() + 30 * 86_400_000;
    const purchase = {
      event: {
        id: 'evt-1',
        type: 'INITIAL_PURCHASE',
        app_user_id: u.id,
        product_id: 'plus_monthly',
        entitlement_ids: ['plus'],
        expiration_at_ms: exp,
      },
    };
    expect((await post(purchase)).status).toBe(200);
    expect((await u.req<{ plan: string }>('GET', '/v1/me')).json.plan).toBe('plus');
    const dup = await post(purchase);
    expect(((await dup.json()) as { duplicate?: boolean }).duplicate).toBe(true);

    await post({
      event: {
        id: 'evt-2',
        type: 'EXPIRATION',
        app_user_id: u.id,
        entitlement_ids: ['plus'],
        expiration_at_ms: Date.now(),
      },
    });
    expect((await u.req<{ plan: string }>('GET', '/v1/me')).json.plan).toBe('free');
  });

  it('turns on Squad Pro for the owner’s squad', async () => {
    const owner = await signIn('rc-pro@example.com');
    const sq = await makeSquad(owner);
    await post({
      event: {
        id: 'evt-pro',
        type: 'INITIAL_PURCHASE',
        app_user_id: owner.id,
        entitlement_ids: ['squad_pro'],
        expiration_at_ms: Date.now() + 86_400_000,
        subscriber_attributes: { squad_id: { value: sq.id } },
      },
    });
    const view = await owner.req<{ squad: { isPro: boolean } }>('GET', `/v1/squads/${sq.id}`);
    expect(view.json.squad.isPro).toBe(true);
  });
});
