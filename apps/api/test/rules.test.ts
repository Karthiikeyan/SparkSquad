import { addDays, HARD_CAPS, TIER_LIMITS } from '@sparksquad/shared';
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { createDb } from '../src/db/client';
import { app } from '../src/index';
import { sendPush } from '../src/services/notify';
import { recomputeGlobalStreak } from '../src/services/streaks';
import {
  checkinBody,
  makeChallenge,
  makeSquad,
  newId,
  raw,
  signIn,
  today,
  type Client,
} from './helpers';

/** Product Spec §3–§4 and Architecture §5/§10 rules not covered by the other suites. */

interface ErrorBody {
  error: { code: string };
}
interface CheckinResponse {
  checkin: { id: string; status: string };
  streak: { current: number };
  newBadges: string[];
}

const sql = (q: string, ...args: unknown[]) =>
  env.DB.prepare(q)
    .bind(...args)
    .run();

async function join(u: Client, squadId: string) {
  expect((await u.req('POST', '/v1/squads/join', { squadId })).status).toBe(200);
}

async function makeAdmin(owner: Client, squadId: string, u: Client) {
  await join(u, squadId);
  expect(
    (await owner.req('PATCH', `/v1/squads/${squadId}/members/${u.id}`, { role: 'admin' })).status,
  ).toBe(200);
}

describe('roles and permissions', () => {
  it('admins approve requests and remove members but cannot touch admins, roles or deletion', async () => {
    const owner = await signIn('role-owner@example.com');
    const admin = await signIn('role-admin@example.com');
    const admin2 = await signIn('role-admin2@example.com');
    const member = await signIn('role-member@example.com');
    const asker = await signIn('role-asker@example.com');
    const sq = await makeSquad(owner);
    await makeAdmin(owner, sq.id, admin);
    await makeAdmin(owner, sq.id, admin2);
    await join(member, sq.id);

    // Private squad: admin approves a request.
    await sql("update squads set privacy = 'private' where id = ?", sq.id);
    expect(
      (await asker.req('POST', '/v1/squads/join', { code: sq.inviteCode })).status,
    ).toBeLessThan(300);
    expect(
      (await admin.req('POST', `/v1/squads/${sq.id}/requests/${asker.id}`, { approve: true }))
        .status,
    ).toBe(200);

    expect((await admin.req('DELETE', `/v1/squads/${sq.id}/members/${member.id}`)).status).toBe(
      200,
    );
    expect((await admin.req('DELETE', `/v1/squads/${sq.id}/members/${admin2.id}`)).status).toBe(
      403,
    );
    expect(
      (await admin.req('PATCH', `/v1/squads/${sq.id}/members/${asker.id}`, { role: 'admin' }))
        .status,
    ).toBe(403);
    expect((await admin.req('DELETE', `/v1/squads/${sq.id}`)).status).toBe(403);
    expect((await owner.req('DELETE', `/v1/squads/${sq.id}`)).status).toBe(200);
  });

  it('only owners and admins announce; announcements are capped and filtered', async () => {
    const owner = await signIn('ann-owner@example.com');
    const member = await signIn('ann-member@example.com');
    const sq = await makeSquad(owner);
    await join(member, sq.id);
    expect(
      (await member.req('PUT', `/v1/squads/${sq.id}/announcement`, { body: 'Hi all' })).status,
    ).toBe(403);
    const long = await owner.req<ErrorBody>('PUT', `/v1/squads/${sq.id}/announcement`, {
      body: 'x'.repeat(501),
    });
    expect(long.status).toBe(400);
    const rude = await owner.req<ErrorBody>('PUT', `/v1/squads/${sq.id}/announcement`, {
      body: 'this is shit',
    });
    expect(rude.json.error.code).toBe('CONTENT_NOT_ALLOWED');
    expect(
      (await owner.req('PUT', `/v1/squads/${sq.id}/announcement`, { body: 'Mock test Friday' }))
        .status,
    ).toBe(200);
  });

  it('a removed member cannot rejoin a public squad', async () => {
    const owner = await signIn('rejoin-owner@example.com');
    const member = await signIn('rejoin-member@example.com');
    const sq = await makeSquad(owner);
    await join(member, sq.id);
    await owner.req('DELETE', `/v1/squads/${sq.id}/members/${member.id}`);
    expect((await member.req('POST', '/v1/squads/join', { squadId: sq.id })).status).toBe(403);
  });

  it('approve all fails when there is not room for everyone', async () => {
    const owner = await signIn('room-owner@example.com');
    const sq = await makeSquad(owner, { privacy: 'private', memberLimit: 2 });
    for (const i of [1, 2]) {
      const u = await signIn(`room-ask${i}@example.com`);
      await u.req('POST', '/v1/squads/join', { code: sq.inviteCode });
    }
    const res = await owner.req<ErrorBody>('POST', `/v1/squads/${sq.id}/requests/approve-all`);
    expect(res.json.error.code).toBe('LIMIT_SQUAD_FULL');
  });

  it('word filter covers squad names and display names', async () => {
    const u = await signIn('filter-names@example.com');
    const squad = await u.req<ErrorBody>('POST', '/v1/squads', {
      name: 'shit squad',
      category: 'career',
      privacy: 'public',
    });
    expect(squad.json.error.code).toBe('CONTENT_NOT_ALLOWED');
    const name = await u.req<ErrorBody>('PATCH', '/v1/me', { displayName: 'shit head' });
    expect(name.json.error.code).toBe('CONTENT_NOT_ALLOWED');
  });
});

describe('member profile stats (C8)', () => {
  it('shows each member’s streak in this squad and their badges, nothing private', async () => {
    const owner = await signIn('stats-owner@example.com');
    const friend = await signIn('stats-friend@example.com');
    const sq = await makeSquad(owner);
    await join(friend, sq.id);
    const ch = await makeChallenge(owner, sq.id);
    await owner.req('PUT', `/v1/checkins/${newId()}`, checkinBody(ch.id));
    const res = await friend.req<{
      members: {
        user: Record<string, unknown>;
        streak: { current: number; best: number } | null;
        badges: string[];
      }[];
    }>('GET', `/v1/squads/${sq.id}/members`);
    const o = res.json.members.find((m) => m.user.id === owner.id)!;
    expect(o.streak).toEqual({ current: 1, best: 1 });
    expect(o.badges).toContain('first_checkin');
    expect(o.user).not.toHaveProperty('email');
    const f = res.json.members.find((m) => m.user.id === friend.id)!;
    expect(f.streak).toEqual({ current: 0, best: 0 });
    expect(f.badges).toEqual([]);
  });
});

describe('challenges', () => {
  it('one active challenge per squad, created by owners or admins', async () => {
    const owner = await signIn('one-ch-owner@example.com');
    const member = await signIn('one-ch-member@example.com');
    const sq = await makeSquad(owner);
    await join(member, sq.id);
    const body = {
      plan: {
        sparksquad_plan: 1,
        title: 'Plan',
        category: 'career',
        duration_days: 3,
        days: [1, 2, 3].map((day) => ({
          day,
          title: `Day ${day}`,
          tasks: [{ title: 'Read', type: 'check' }],
        })),
      },
      startDate: today(),
    };
    expect((await member.req('POST', `/v1/squads/${sq.id}/challenges`, body)).status).toBe(403);
    await makeChallenge(owner, sq.id);
    const second = await owner.req<ErrorBody>('POST', `/v1/squads/${sq.id}/challenges`, body);
    expect(second.status).toBe(409);
    expect(second.json.error.code).toBe('CHALLENGE_ALREADY_ACTIVE');
  });

  it('only future days can be edited, by owners or admins', async () => {
    const owner = await signIn('edit-owner@example.com');
    const member = await signIn('edit-member@example.com');
    const sq = await makeSquad(owner);
    await join(member, sq.id);
    const ch = await makeChallenge(owner, sq.id);
    const day = { title: 'New day', tasks: [{ title: 'Read', type: 'check' }] };
    expect((await member.req('PUT', `/v1/challenges/${ch.id}/days/2`, day)).status).toBe(403);
    const locked = await owner.req<ErrorBody>('PUT', `/v1/challenges/${ch.id}/days/1`, day);
    expect(locked.json.error.code).toBe('DAY_LOCKED');
    expect((await owner.req('PUT', `/v1/challenges/${ch.id}/days/2`, day)).status).toBe(200);
  });
});

describe('check-in rules', () => {
  it('notes are capped at 280 characters', async () => {
    const u = await signIn('note-cap@example.com');
    const sq = await makeSquad(u);
    const ch = await makeChallenge(u, sq.id);
    const res = await u.req('PUT', `/v1/checkins/${newId()}`, {
      ...checkinBody(ch.id),
      note: 'x'.repeat(281),
    });
    expect(res.status).toBe(400);
  });

  it('partial days count only when the squad allows it', async () => {
    const u = await signIn('partial@example.com');
    const sq = await makeSquad(u);
    const ch = await makeChallenge(u, sq.id);
    const id = newId();
    const half = checkinBody(ch.id, today(), [
      { t: 0, v: 2 },
      { t: 1, v: false },
    ]);
    const on = await u.req<CheckinResponse>('PUT', `/v1/checkins/${id}`, half);
    expect(on.json.checkin.status).toBe('partial');
    expect(on.json.streak.current).toBe(1);
    await sql('update squads set partial_counts = 0 where id = ?', sq.id);
    const off = await u.req<CheckinResponse>('PUT', `/v1/checkins/${id}`, half);
    expect(off.json.streak.current).toBe(0);
  });

  it('personal targets apply only when the squad allows them', async () => {
    const u = await signIn('targets@example.com');
    const sq = await makeSquad(u);
    const ch = await makeChallenge(u, sq.id);
    const id = newId();
    const body = {
      ...checkinBody(ch.id, today(), [
        { t: 0, v: 1 },
        { t: 1, v: true },
      ]),
      targets: [{ t: 0, target: 1 }],
    };
    expect(
      (await u.req<CheckinResponse>('PUT', `/v1/checkins/${id}`, body)).json.checkin.status,
    ).toBe('done');
    await sql('update squads set allow_personal_targets = 0 where id = ?', sq.id);
    expect(
      (await u.req<CheckinResponse>('PUT', `/v1/checkins/${id}`, body)).json.checkin.status,
    ).toBe('partial');
  });

  it('awards the first check-in badge on the server', async () => {
    const u = await signIn('badge-first@example.com');
    const sq = await makeSquad(u);
    const ch = await makeChallenge(u, sq.id);
    const res = await u.req<CheckinResponse>('PUT', `/v1/checkins/${newId()}`, checkinBody(ch.id));
    expect(res.json.newBadges).toContain('first_checkin');
  });

  it('banks freezes up to the tier cap (2 Free, 5 Plus)', async () => {
    const d = createDb(env.DB);
    for (const [email, plan] of [
      ['freeze-free@example.com', 'free'],
      ['freeze-plus@example.com', 'plus'],
    ] as const) {
      const u = await signIn(email);
      const sq = await makeSquad(u);
      const ch = await makeChallenge(u, sq.id);
      await sql('update user set plan = ? where id = ?', plan, u.id);
      // 35 done days in a row before today (5 freezes earned).
      const stmts = Array.from({ length: 35 }, (_, i) =>
        env.DB.prepare(
          "insert into checkins (id, challenge_id, user_id, local_date, day_number, status, counts_done) values (?, ?, ?, ?, 1, 'done', 1)",
        ).bind(newId(), ch.id, u.id, addDays(today(), -(i + 1))),
      );
      await env.DB.batch(stmts);
      const { state } = await recomputeGlobalStreak(d, u.id, today());
      expect(state.freezes).toBe(TIER_LIMITS[plan].freezesBanked);
    }
  });
});

describe('comments', () => {
  async function setup(prefix: string) {
    const owner = await signIn(`${prefix}-owner@example.com`);
    const friend = await signIn(`${prefix}-friend@example.com`);
    const sq = await makeSquad(owner);
    await join(friend, sq.id);
    const ch = await makeChallenge(owner, sq.id);
    const ck = await owner.req<CheckinResponse>(
      'PUT',
      `/v1/checkins/${newId()}`,
      checkinBody(ch.id),
    );
    return { owner, friend, sq, checkinId: ck.json.checkin.id };
  }
  const daysLeft = async (commentId: string) => {
    const row = await env.DB.prepare('select expires_at as e from comments where id = ?')
      .bind(commentId)
      .first<{ e: string }>();
    return Math.round((Date.parse(row!.e) - Date.now()) / 86_400_000);
  };

  it('are capped at 140 characters and filtered', async () => {
    const { friend, checkinId } = await setup('cm-cap');
    const long = await friend.req('POST', `/v1/checkins/${checkinId}/comments`, {
      body: 'x'.repeat(141),
    });
    expect(long.status).toBe(400);
    const rude = await friend.req<ErrorBody>('POST', `/v1/checkins/${checkinId}/comments`, {
      body: 'this is shit',
    });
    expect(rude.json.error.code).toBe('CONTENT_NOT_ALLOWED');
  });

  it('are kept 30 days on Free and 90 on Plus or a Squad Pro squad', async () => {
    const { friend, sq, checkinId } = await setup('cm-keep');
    const post = async () =>
      (
        await friend.req<{ id: string }>('POST', `/v1/checkins/${checkinId}/comments`, {
          body: 'Nice',
        })
      ).json.id;
    expect(await daysLeft(await post())).toBe(TIER_LIMITS.free.commentRetentionDays);
    await sql("update user set plan = 'plus' where id = ?", friend.id);
    expect(await daysLeft(await post())).toBe(TIER_LIMITS.plus.commentRetentionDays);
    await sql("update user set plan = 'free' where id = ?", friend.id);
    await sql('update squads set is_pro = 1 where id = ?', sq.id);
    expect(await daysLeft(await post())).toBe(90);
  });

  it('from blocked people are hidden from the blocker', async () => {
    const { owner, friend, checkinId } = await setup('cm-block');
    await friend.req('POST', `/v1/checkins/${checkinId}/comments`, { body: 'Well done' });
    expect(
      (await owner.req<{ comments: unknown[] }>('GET', `/v1/checkins/${checkinId}/comments`)).json
        .comments,
    ).toHaveLength(1);
    expect((await owner.req('PUT', `/v1/blocks/${friend.id}`)).status).toBeLessThan(300);
    expect(
      (await owner.req<{ comments: unknown[] }>('GET', `/v1/checkins/${checkinId}/comments`)).json
        .comments,
    ).toHaveLength(0);
  });
});

describe('photo proof', () => {
  it('Plus photos go to the 30-day prefix and Squad Pro photos to the 90-day prefix', async () => {
    const plus = await signIn('photo-plus@example.com');
    await sql("update user set plan = 'plus' where id = ?", plus.id);
    const a = await plus.req<{ key: string }>('POST', '/v1/uploads/proof', {
      checkinId: newId(),
      contentType: 'image/jpeg',
      size: 1000,
    });
    expect(a.json.key).toMatch(/^proof-30d\//);

    const owner = await signIn('photo-pro@example.com');
    const sq = await makeSquad(owner);
    await sql('update squads set is_pro = 1 where id = ?', sq.id);
    const ch = await makeChallenge(owner, sq.id);
    const ck = await owner.req<CheckinResponse>(
      'PUT',
      `/v1/checkins/${newId()}`,
      checkinBody(ch.id),
    );
    const b = await owner.req<{ key: string }>('POST', '/v1/uploads/proof', {
      checkinId: ck.json.checkin.id,
      contentType: 'image/jpeg',
      size: 1000,
    });
    expect(b.json.key).toMatch(/^proof-90d\//);
  });

  it('rejects uploads over 300 KB', async () => {
    const u = await signIn('photo-big@example.com');
    await sql("update user set plan = 'plus' where id = ?", u.id);
    const signed = await u.req<{ url: string }>('POST', '/v1/uploads/proof', {
      checkinId: newId(),
      contentType: 'image/jpeg',
      size: 1000,
    });
    const path = signed.json.url.replace(/^https?:\/\/[^/]+/, '');
    const put = (bytes: number) =>
      raw(path, {
        method: 'PUT',
        headers: { 'content-type': 'image/jpeg' },
        body: new Uint8Array(bytes),
      });
    expect((await put(HARD_CAPS.uploadMaxBytes + 1)).status).toBe(413);
    expect((await put(1000)).status).toBe(200);
  });
});

describe('cost and abuse caps', () => {
  it('squads are capped at 100 members', async () => {
    const u = await signIn('cap-100@example.com');
    const res = await u.req('POST', '/v1/squads', {
      name: 'Huge squad',
      category: 'career',
      privacy: 'public',
      memberLimit: HARD_CAPS.maxMembersPerSquad + 1,
    });
    expect(res.status).toBe(400);
  });

  it('sends at most 2 digest pushes per user per day; nudges are not counted', async () => {
    const u = await signIn('push-cap@example.com');
    const d = createDb(env.DB);
    const msg = { title: 'Squad update', body: 'Two of five checked in' };
    for (let i = 0; i < 3; i++) await sendPush(env, d, [u.id], msg, 'digest');
    await sendPush(env, d, [u.id], msg, 'nudge');
    const row = await env.DB.prepare(
      "select count from usage_counters where user_id = ? and kind = 'push'",
    )
      .bind(u.id)
      .first<{ count: number }>();
    expect(row?.count).toBe(HARD_CAPS.digestPushesPerUserPerDay);
  });

  it('rate limits by IP with 429', async () => {
    const limited = {
      ...env,
      IP_LIMITER: { limit: async () => ({ success: false }) },
    } as unknown as typeof env;
    const ctx = createExecutionContext();
    const res = await app.request('/v1/config', {}, limited, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(429);
    expect(((await res.json()) as ErrorBody).error.code).toBe('RATE_LIMITED');
  });
});

describe('your data', () => {
  it('records Plus interest while payments are off', async () => {
    const u = await signIn('interest@example.com');
    expect((await u.req('POST', '/v1/me/plus-interest', { product: 'plus' })).status).toBe(200);
    const row = await env.DB.prepare('select plus_interest_at as at from user where id = ?')
      .bind(u.id)
      .first<{ at: string | null }>();
    expect(row?.at).toBeTruthy();
  });

  it('exports with a one-day link and deletes the account', async () => {
    const u = await signIn('export-delete@example.com');
    const owner = await signIn('export-delete-owner@example.com');
    const sq = await makeSquad(owner);
    await join(u, sq.id);
    const exp = await u.req<{ url: string; expiresAt: string }>('POST', '/v1/me/export');
    expect(exp.status).toBe(200);
    const hours = (Date.parse(exp.json.expiresAt) - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(23);
    expect(hours).toBeLessThanOrEqual(24);

    expect((await u.req('DELETE', '/v1/me')).status).toBe(200);
    const gone = await env.DB.prepare('select count(*) as n from user where id = ?')
      .bind(u.id)
      .first<{ n: number }>();
    expect(gone?.n).toBe(0);
    const members = await env.DB.prepare('select member_count as n from squads where id = ?')
      .bind(sq.id)
      .first<{ n: number }>();
    expect(members?.n).toBe(1);
    expect((await u.req('GET', '/v1/me')).status).toBe(401);
  });
});
