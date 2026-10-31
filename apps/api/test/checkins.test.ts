import { addDays } from '@sparksquad/shared';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { checkinBody, makeChallenge, makeSquad, newId, signIn, today } from './helpers';

interface CheckinResponse {
  checkin: { id: string; status: string; edited: boolean; dayNumber: number; localDate: string };
  streak: { current: number };
  globalStreak: { current: number };
  newBadges: string[];
}

describe('check-ins', () => {
  it('is an idempotent upsert keyed by client id and by (challenge, user, date)', async () => {
    const owner = await signIn('ci-owner@example.com');
    const sq = await makeSquad(owner);
    const ch = await makeChallenge(owner, sq.id, addDays(today(), -2));
    const id = newId();

    const first = await owner.req<CheckinResponse>('PUT', `/v1/checkins/${id}`, checkinBody(ch.id));
    expect(first.status).toBe(200);
    expect(first.json.checkin).toMatchObject({ id, status: 'done', edited: false, dayNumber: 3 });
    expect(first.json.newBadges).toContain('first_checkin');

    // Same id again (outbox retry) updates in place.
    const again = await owner.req<CheckinResponse>(
      'PUT',
      `/v1/checkins/${id}`,
      checkinBody(ch.id, today(), [{ t: 0, v: 1 }]),
    );
    expect(again.status).toBe(200);
    expect(again.json.checkin).toMatchObject({ id, status: 'partial', edited: true });

    // A different client id for the same day resolves to the canonical row.
    const other = await owner.req<CheckinResponse>(
      'PUT',
      `/v1/checkins/${newId()}`,
      checkinBody(ch.id),
    );
    expect(other.json.checkin.id).toBe(id);
    expect(other.json.checkin.status).toBe('done');

    const rows = await env.DB.prepare('select count(*) as n from checkins where challenge_id = ?')
      .bind(ch.id)
      .first<{ n: number }>();
    expect(rows?.n).toBe(1);
  });

  it('accepts today and yesterday but not older days or future days', async () => {
    const u = await signIn('ci-window@example.com');
    const sq = await makeSquad(u);
    const ch = await makeChallenge(u, sq.id, addDays(today(), -5));

    expect(
      (await u.req('PUT', `/v1/checkins/${newId()}`, checkinBody(ch.id, addDays(today(), -1))))
        .status,
    ).toBe(200);
    const old = await u.req<{ error: { code: string } }>(
      'PUT',
      `/v1/checkins/${newId()}`,
      checkinBody(ch.id, addDays(today(), -3)),
    );
    expect(old.status).toBe(409);
    expect(old.json.error.code).toBe('CHECKIN_WINDOW_CLOSED');
    const future = await u.req<{ error: { code: string } }>(
      'PUT',
      `/v1/checkins/${newId()}`,
      checkinBody(ch.id, addDays(today(), 3)),
    );
    expect(future.json.error.code).toBe('CHECKIN_WINDOW_CLOSED');
  });

  it('rejects days outside the challenge', async () => {
    const u = await signIn('ci-range@example.com');
    const sq = await makeSquad(u);
    const ch = await makeChallenge(u, sq.id, addDays(today(), 1));
    const res = await u.req<{ error: { code: string } }>(
      'PUT',
      `/v1/checkins/${newId()}`,
      checkinBody(ch.id),
    );
    expect(res.json.error.code).toBe('CHECKIN_DAY_OUT_OF_RANGE');
  });

  it('records honest misses and filters bad words in notes', async () => {
    const u = await signIn('ci-miss@example.com');
    const sq = await makeSquad(u);
    const ch = await makeChallenge(u, sq.id);
    const miss = await u.req<CheckinResponse>('PUT', `/v1/checkins/${newId()}`, {
      ...checkinBody(ch.id, today(), []),
      honestMiss: true,
    });
    expect(miss.json.checkin.status).toBe('honest_miss');
    const rude = await u.req<{ error: { code: string } }>('PUT', `/v1/checkins/${newId()}`, {
      ...checkinBody(ch.id),
      note: 'this is shit',
    });
    expect(rude.status).toBe(422);
    expect(rude.json.error.code).toBe('CONTENT_NOT_ALLOWED');
  });

  it('builds a streak and backfilling yesterday keeps it', async () => {
    const u = await signIn('ci-streak@example.com');
    const sq = await makeSquad(u);
    const ch = await makeChallenge(u, sq.id, addDays(today(), -1));
    const y = await u.req<CheckinResponse>(
      'PUT',
      `/v1/checkins/${newId()}`,
      checkinBody(ch.id, addDays(today(), -1)),
    );
    expect(y.json.streak.current).toBe(1);
    const t = await u.req<CheckinResponse>('PUT', `/v1/checkins/${newId()}`, checkinBody(ch.id));
    expect(t.json.streak.current).toBe(2);
    expect(t.json.globalStreak.current).toBe(2);
  });

  it('reactions toggle and comments are capped at 20 a day', async () => {
    const owner = await signIn('ci-react-owner@example.com');
    const friend = await signIn('ci-react-friend@example.com');
    const sq = await makeSquad(owner);
    await friend.req('POST', '/v1/squads/join', { squadId: sq.id });
    const ch = await makeChallenge(owner, sq.id);
    const id = newId();
    await owner.req('PUT', `/v1/checkins/${id}`, checkinBody(ch.id));

    const on = await friend.req<{ reactionCount: number }>(
      'PUT',
      `/v1/checkins/${id}/reactions/fire`,
    );
    expect(on.json.reactionCount).toBe(1);
    const on2 = await friend.req<{ reactionCount: number }>(
      'PUT',
      `/v1/checkins/${id}/reactions/fire`,
    );
    expect(on2.json.reactionCount).toBe(1);
    const off = await friend.req<{ reactionCount: number }>(
      'DELETE',
      `/v1/checkins/${id}/reactions/fire`,
    );
    expect(off.json.reactionCount).toBe(0);

    for (let i = 0; i < 20; i++) {
      expect(
        (await friend.req('POST', `/v1/checkins/${id}/comments`, { body: `Nice ${i}` })).status,
      ).toBe(201);
    }
    const capped = await friend.req<{ error: { code: string } }>(
      'POST',
      `/v1/checkins/${id}/comments`,
      { body: 'one more' },
    );
    expect(capped.status).toBe(429);
    expect(capped.json.error.code).toBe('LIMIT_COMMENTS_PER_DAY');
    const list = await owner.req<{ comments: unknown[] }>('GET', `/v1/checkins/${id}/comments`);
    expect(list.json.comments).toHaveLength(20);
  });

  it('allows one nudge per pair per day and not after check-in', async () => {
    const owner = await signIn('nudge-owner@example.com');
    const friend = await signIn('nudge-friend@example.com');
    const sq = await makeSquad(owner);
    await friend.req('POST', '/v1/squads/join', { squadId: sq.id });
    const ch = await makeChallenge(owner, sq.id);
    expect(
      (await owner.req('POST', '/v1/nudges', { challengeId: ch.id, toUserId: friend.id })).status,
    ).toBe(201);
    const twice = await owner.req<{ error: { code: string } }>('POST', '/v1/nudges', {
      challengeId: ch.id,
      toUserId: friend.id,
    });
    expect(twice.json.error.code).toBe('LIMIT_NUDGE_ALREADY_SENT');
    await owner.req('PUT', `/v1/checkins/${newId()}`, checkinBody(ch.id));
    const late = await friend.req('POST', '/v1/nudges', { challengeId: ch.id, toUserId: owner.id });
    expect(late.status).toBe(409);
  });

  it('only lets Plus users request proof uploads', async () => {
    const u = await signIn('proof@example.com');
    const res = await u.req<{ error: { code: string } }>('POST', '/v1/uploads/proof', {
      checkinId: newId(),
      contentType: 'image/jpeg',
      size: 90_000,
    });
    expect(res.status).toBe(403);
    expect(res.json.error.code).toBe('PLUS_REQUIRED');
    await env.DB.prepare("update user set plan = 'plus' where id = ?").bind(u.id).run();
    const ok = await u.req<{ key: string; url: string }>('POST', '/v1/uploads/proof', {
      checkinId: 'CHECKIN000000000000000001',
      contentType: 'image/webp',
      size: 90_000,
    });
    expect(ok.status).toBe(200);
    expect(ok.json.key).toBe(`proof-30d/${u.id}/CHECKIN000000000000000001.webp`);
  });
});
