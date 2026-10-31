import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { HARD_CAPS, type SyncResponse } from '@sparksquad/shared';
import { describe, expect, it } from 'vitest';
import { app } from '../src/index';
import { checkinBody, makeChallenge, makeSquad, newId, raw, signIn } from './helpers';

type ErrorBody = { error: { code: string } };

const sql = (q: string, ...args: unknown[]) =>
  env.DB.prepare(q)
    .bind(...args)
    .run();

const json = (body: unknown, headers: Record<string, string> = {}) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});

async function hex(bytes: ArrayBuffer): Promise<string> {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmac(key: Uint8Array, message: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(message));
}

describe('auth surface', () => {
  it('only the endpoints the app uses are reachable', async () => {
    for (const [method, path] of [
      ['GET', '/api/auth/expo-authorization-proxy?authorizationURL=https://example.com'],
      ['POST', '/api/auth/email-otp/check-verification-otp'],
      ['POST', '/api/auth/email-otp/verify-email'],
      ['POST', '/api/auth/email-otp/reset-password'],
      ['POST', '/api/auth/forget-password/email-otp'],
      ['POST', '/api/auth/update-user'],
      ['POST', '/api/auth/change-email'],
      ['GET', '/api/auth/list-sessions'],
    ] as const) {
      const res = await raw(path, method === 'POST' ? json({}) : {});
      expect(res.status, path).toBe(404);
    }
  });

  it('social sign-in requires a native ID token (no redirect flow)', async () => {
    const res = await raw(
      '/api/auth/sign-in/social',
      json({ provider: 'google', callbackURL: 'exp://x' }),
    );
    expect(res.status).toBe(400);
  });

  it('caps sign-in codes per email address', async () => {
    const email = 'otp-cap@example.com';
    const send = () =>
      raw('/api/auth/email-otp/send-verification-otp', json({ email, type: 'sign-in' }));
    for (let i = 0; i < HARD_CAPS.otpSendsPerEmailPerHour; i++)
      expect((await send()).status).toBe(200);
    expect((await send()).status).toBe(429);
  });

  it('caps code guesses per email address', async () => {
    const email = 'otp-guess@example.com';
    await raw('/api/auth/email-otp/send-verification-otp', json({ email, type: 'sign-in' }));
    let last = 0;
    for (let i = 0; i <= HARD_CAPS.otpVerifyAttemptsPerEmailPerHour; i++) {
      last = (await raw('/api/auth/sign-in/email-otp', json({ email, otp: '000000' }))).status;
    }
    expect(last).toBe(429);
  });

  it('rejects oversized auth bodies before parsing', async () => {
    const res = await raw(
      '/api/auth/sign-in/email-otp',
      json({ email: 'big@example.com', otp: '1'.repeat(HARD_CAPS.authBodyMaxBytes) }),
    );
    expect(res.status).toBe(413);
  });
});

describe('admin and suspension', () => {
  it('an allow-listed but unverified email is not an admin', async () => {
    const admin = await signIn('admin@example.com');
    expect((await admin.req('GET', '/v1/admin/reports')).status).toBe(200);
    await sql('update user set email_verified = 0 where id = ?', admin.id);
    expect((await admin.req('GET', '/v1/admin/reports')).status).toBe(403);
    await sql('update user set email_verified = 1 where id = ?', admin.id);
  });

  it('suspending a user revokes their sessions on every route', async () => {
    const admin = await signIn('admin@example.com');
    const bad = await signIn('to-suspend@example.com');
    const victim = await signIn('reporter-s@example.com');
    await victim.req('POST', '/v1/reports', {
      targetType: 'user',
      targetId: bad.id,
      reason: 'spam',
    });
    const list = await admin.req<{ reports: { id: string; targetId: string }[] }>(
      'GET',
      '/v1/admin/reports',
    );
    const report = list.json.reports.find((r) => r.targetId === bad.id)!;
    expect(
      (await admin.req('POST', `/v1/admin/reports/${report.id}`, { action: 'suspend' })).status,
    ).toBe(200);
    const session = await raw('/api/auth/get-session', { headers: { cookie: bad.cookie } });
    expect(await session.json()).toBeNull();
    const n = await env.DB.prepare('select count(*) as n from session where user_id = ?')
      .bind(bad.id)
      .first<{ n: number }>();
    expect(n?.n).toBe(0);
  });

  it('merges repeat reports of the same target', async () => {
    const r = await signIn('dup-reporter@example.com');
    const target = newId();
    for (let i = 0; i < 3; i++) {
      await r.req('POST', '/v1/reports', {
        targetType: 'comment',
        targetId: target,
        reason: 'spam',
      });
    }
    const n = await env.DB.prepare('select count(*) as n from reports where target_id = ?')
      .bind(target)
      .first<{ n: number }>();
    expect(n?.n).toBe(1);
  });
});

describe('file tokens and R2 keys', () => {
  it('a signature made with the raw auth secret is not a file token', async () => {
    const key = 'templates/dsa-30.json';
    const exp = Math.floor(Date.now() / 1000) + 600;
    const raw1 = await hex(
      await hmac(new TextEncoder().encode(env.BETTER_AUTH_SECRET), `GET\n${key}\n${exp}\n`),
    );
    const res = await raw(`/files/${key}?exp=${exp}&sig=${raw1}`);
    expect(res.status).toBe(403);
  });

  it('far-future expiries and traversal keys are refused', async () => {
    const far = Math.floor(Date.now() / 1000) + 365 * 86_400;
    expect((await raw(`/files/a/b.jpg?exp=${far}&sig=${'0'.repeat(64)}`)).status).toBe(403);
    expect((await raw(`/files/a/%2E%2E/b.jpg?exp=1&sig=${'0'.repeat(64)}`)).status).toBe(403);
  });

  it('proof upload ids cannot escape the caller’s prefix', async () => {
    const u = await signIn('escape@example.com');
    await sql("update user set plan = 'plus' where id = ?", u.id);
    for (const checkinId of ['../../templates/dsa-30.json#', '../someone/abc1234567', 'a/b']) {
      const res = await u.req('POST', '/v1/uploads/proof', {
        checkinId,
        contentType: 'image/jpeg',
        size: 1000,
      });
      expect(res.status, checkinId).toBe(400);
    }
  });

  it('downloads never replay stored content types and are sandboxed', async () => {
    const u = await signIn('files-type@example.com');
    await sql("update user set plan = 'plus' where id = ?", u.id);
    const signed = await u.req<{ key: string; url: string }>('POST', '/v1/uploads/proof', {
      checkinId: newId(),
      contentType: 'image/jpeg',
      size: 10,
    });
    // Simulate an object stored with a dangerous type by another path.
    await env.BUCKET.put(signed.json.key, '<script>alert(1)</script>', {
      httpMetadata: { contentType: 'text/html' },
    });
    const { signedUrl } = await import('../src/services/r2');
    const get = await signedUrl(env, 'GET', signed.json.key, 60);
    const res = await raw(get.url.replace(/^https?:\/\/[^/]+/, ''));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('content-security-policy')).toContain('sandbox');
    expect(res.headers.get('content-disposition')).toBe('attachment');
  });
});

describe('request size limits', () => {
  it('rejects oversized /v1 bodies with 413', async () => {
    const u = await signIn('big-body@example.com');
    const res = await raw('/v1/me', {
      method: 'PATCH',
      headers: { cookie: u.cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: 'x'.repeat(HARD_CAPS.requestBodyMaxBytes) }),
    });
    expect(res.status).toBe(413);
  });
});

describe('squad membership rules', () => {
  it('a user blocked by the owner cannot request to join or appear in requests', async () => {
    const owner = await signIn('blk-owner@example.com');
    const pest = await signIn('blk-pest@example.com');
    const sq = await makeSquad(owner, { privacy: 'private' });
    await owner.req('PUT', `/v1/blocks/${pest.id}`);
    const res = await pest.req<ErrorBody>('POST', '/v1/squads/join', { code: sq.inviteCode });
    expect(res.status).toBe(403);
    const notes = await env.DB.prepare(
      "select count(*) as n from notifications where user_id = ? and kind = 'join_request'",
    )
      .bind(owner.id)
      .first<{ n: number }>();
    expect(notes?.n).toBe(0);
  });

  it('join requests carry the public display name, not the provider name', async () => {
    const owner = await signIn('dn-owner@example.com');
    const joiner = await signIn('dn-joiner@example.com');
    await sql("update user set name = 'Real Legal Name' where id = ?", joiner.id);
    const sq = await makeSquad(owner, { privacy: 'private' });
    await joiner.req('POST', '/v1/squads/join', { code: sq.inviteCode });
    const row = await env.DB.prepare(
      "select payload from notifications where user_id = ? and kind = 'join_request'",
    )
      .bind(owner.id)
      .first<{ payload: string }>();
    expect(JSON.parse(row!.payload).name).toBe('dn-joiner');
  });

  it('a pending request can be withdrawn, freeing the slot', async () => {
    const owner = await signIn('wd-owner@example.com');
    const joiner = await signIn('wd-joiner@example.com');
    const sq = await makeSquad(owner, { privacy: 'private' });
    await joiner.req('POST', '/v1/squads/join', { code: sq.inviteCode });
    expect((await joiner.req('DELETE', `/v1/squads/${sq.id}/request`)).status).toBe(200);
    const row = await env.DB.prepare(
      'select count(*) as n from squad_members where squad_id = ? and user_id = ?',
    )
      .bind(sq.id, joiner.id)
      .first<{ n: number }>();
    expect(row?.n).toBe(0);
    expect((await joiner.req('DELETE', `/v1/squads/${sq.id}/request`)).status).toBe(404);
  });

  it('ownership transfer respects the recipient’s owned-squad limit', async () => {
    const owner = await signIn('tr-owner@example.com');
    const heir = await signIn('tr-heir@example.com');
    await makeSquad(heir); // Free plan: heir already owns 1 (the limit).
    const sq = await makeSquad(owner);
    await heir.req('POST', '/v1/squads/join', { squadId: sq.id });
    const res = await owner.req<ErrorBody>('POST', `/v1/squads/${sq.id}/transfer`, {
      userId: heir.id,
    });
    expect(res.status).toBe(403);
    expect(res.json.error.code).toBe('LIMIT_SQUADS_OWNED');
  });

  it('account deletion never makes an at-limit member the owner of a live squad', async () => {
    const owner = await signIn('del-owner@example.com');
    const heir = await signIn('del-heir@example.com');
    await makeSquad(heir);
    const sq = await makeSquad(owner);
    await heir.req('POST', '/v1/squads/join', { squadId: sq.id });
    expect((await owner.req('DELETE', '/v1/me')).status).toBe(200);
    const row = await env.DB.prepare('select owner_id, archived_at from squads where id = ?')
      .bind(sq.id)
      .first<{ owner_id: string; archived_at: string | null }>();
    expect(row?.owner_id).toBe(heir.id);
    expect(row?.archived_at).not.toBeNull();
  });

  it('identical announcements do not fan out again', async () => {
    const owner = await signIn('ann-owner@example.com');
    const m = await signIn('ann-member@example.com');
    const sq = await makeSquad(owner);
    await m.req('POST', '/v1/squads/join', { squadId: sq.id });
    for (let i = 0; i < 3; i++) {
      await owner.req('PUT', `/v1/squads/${sq.id}/announcement`, { body: 'Same text' });
    }
    const n = await env.DB.prepare(
      "select count(*) as n from notifications where user_id = ? and kind = 'announcement'",
    )
      .bind(m.id)
      .first<{ n: number }>();
    expect(n?.n).toBe(1);
  });
});

describe('delta sync isolation', () => {
  it('a moderation-hidden squad stops delivering content and is removed', async () => {
    const owner = await signIn('hid-owner@example.com');
    const m = await signIn('hid-member@example.com');
    const sq = await makeSquad(owner);
    await m.req('POST', '/v1/squads/join', { squadId: sq.id });
    const ch = await makeChallenge(owner, sq.id);
    await owner.req('PUT', `/v1/checkins/${newId()}`, checkinBody(ch.id));
    const first = await m.req<SyncResponse>('GET', '/v1/sync');
    expect(first.json.checkins.length).toBeGreaterThan(0);

    await sql(
      'update squads set hidden_at = ?, updated_at = ? where id = ?',
      new Date().toISOString(),
      new Date().toISOString(),
      sq.id,
    );
    const initial = await m.req<SyncResponse>('GET', '/v1/sync');
    expect(initial.json.checkins).toHaveLength(0);
    expect(initial.json.challenges).toHaveLength(0);
    expect(initial.json.members.filter((x) => x.squadId === sq.id)).toHaveLength(0);
    const delta = await m.req<SyncResponse>(
      'GET',
      `/v1/sync?since=${encodeURIComponent(first.json.nextCursor)}`,
    );
    expect(delta.json.removedSquadIds).toContain(sq.id);
  });

  it('pending requests are visible to managers only', async () => {
    const owner = await signIn('pend-owner@example.com');
    const member = await signIn('pend-member@example.com');
    const asker = await signIn('pend-asker@example.com');
    const sq = await makeSquad(owner, { privacy: 'private' });
    await member.req('POST', '/v1/squads/join', { code: sq.inviteCode });
    await owner.req('POST', `/v1/squads/${sq.id}/requests/${member.id}`, { approve: true });
    await asker.req('POST', '/v1/squads/join', { code: sq.inviteCode });
    const seenBy = async (c: typeof owner) =>
      (await c.req<SyncResponse>('GET', '/v1/sync')).json.members.some(
        (x) => x.user.id === asker.id,
      );
    expect(await seenBy(member)).toBe(false);
    expect(await seenBy(owner)).toBe(true);
  });

  it('hidden check-ins are tombstoned and rosters let phones prune members', async () => {
    const owner = await signIn('tomb-owner@example.com');
    const m = await signIn('tomb-member@example.com');
    const sq = await makeSquad(owner);
    await m.req('POST', '/v1/squads/join', { squadId: sq.id });
    const ch = await makeChallenge(owner, sq.id);
    const ck = await owner.req<{ checkin: { id: string } }>(
      'PUT',
      `/v1/checkins/${newId()}`,
      checkinBody(ch.id),
    );
    const first = await m.req<SyncResponse>('GET', '/v1/sync');
    const later = new Date(Date.now() + 5_000).toISOString();
    await sql(
      'update checkins set hidden_at = ?, updated_at = ? where id = ?',
      later,
      later,
      ck.json.checkin.id,
    );
    await sql('update squads set updated_at = ? where id = ?', later, sq.id);
    const delta = await m.req<SyncResponse>(
      'GET',
      `/v1/sync?since=${encodeURIComponent(first.json.nextCursor)}`,
    );
    expect(delta.json.removedCheckinIds).toContain(ck.json.checkin.id);
    const roster = delta.json.squadMemberIds?.find((r) => r.squadId === sq.id);
    expect(roster?.userIds.sort()).toEqual([owner.id, m.id].sort());
  });
});

describe('RevenueCat entitlements', () => {
  const post = async (body: unknown, overrides: Record<string, unknown> = {}) => {
    const ctx = createExecutionContext();
    const e = { ...env, ...overrides } as typeof env;
    const res = await app.request(
      '/webhooks/revenuecat',
      json(body, { authorization: 'Bearer test-rc-secret' }),
      e,
      ctx,
    );
    await waitOnExecutionContext(ctx);
    return res;
  };
  const plan = async (id: string) =>
    (await env.DB.prepare('select plan from user where id = ?').bind(id).first<{ plan: string }>())
      ?.plan;
  const future = () => Date.now() + 30 * 86_400_000;

  it('sandbox events never grant production entitlements', async () => {
    const u = await signIn('rc-sandbox@example.com');
    const res = await post(
      {
        event: {
          id: 'sbx-1',
          type: 'INITIAL_PURCHASE',
          environment: 'SANDBOX',
          app_user_id: u.id,
          product_id: 'plus_monthly',
          entitlement_ids: ['plus'],
          expiration_at_ms: future(),
        },
      },
      { APP_ENV: 'production' },
    );
    expect(res.status).toBe(200);
    expect(await plan(u.id)).toBe('free');
  });

  it('one expiring subscription does not cancel another active one', async () => {
    const u = await signIn('rc-two@example.com');
    const base = { app_user_id: u.id, entitlement_ids: ['plus'] };
    await post({
      event: {
        ...base,
        id: 'two-a',
        type: 'INITIAL_PURCHASE',
        product_id: 'plus_monthly',
        original_transaction_id: 'tx-a',
        expiration_at_ms: future(),
      },
    });
    await post({
      event: {
        ...base,
        id: 'two-b',
        type: 'INITIAL_PURCHASE',
        product_id: 'plus_yearly',
        original_transaction_id: 'tx-b',
        expiration_at_ms: future(),
      },
    });
    await post({
      event: {
        ...base,
        id: 'two-c',
        type: 'EXPIRATION',
        product_id: 'plus_monthly',
        original_transaction_id: 'tx-a',
        expiration_at_ms: Date.now(),
      },
    });
    expect(await plan(u.id)).toBe('plus');
  });

  it('a late, older event does not override a newer one', async () => {
    const u = await signIn('rc-order@example.com');
    const base = {
      app_user_id: u.id,
      entitlement_ids: ['plus'],
      product_id: 'plus_monthly',
      original_transaction_id: 'tx-o',
    };
    const t0 = Date.now();
    await post({
      event: {
        ...base,
        id: 'ord-2',
        type: 'RENEWAL',
        event_timestamp_ms: t0,
        expiration_at_ms: future(),
      },
    });
    await post({
      event: {
        ...base,
        id: 'ord-1',
        type: 'EXPIRATION',
        event_timestamp_ms: t0 - 60_000,
        expiration_at_ms: t0 - 60_000,
      },
    });
    expect(await plan(u.id)).toBe('plus');
  });

  it('TRANSFER (real RevenueCat payload shape) moves Plus away from the previous account', async () => {
    const from = await signIn('rc-from@example.com');
    const to = await signIn('rc-to@example.com');
    await post({
      event: {
        id: 'tf-1',
        type: 'INITIAL_PURCHASE',
        app_user_id: from.id,
        product_id: 'plus_monthly',
        original_transaction_id: 'tx-t',
        entitlement_ids: ['plus'],
        expiration_at_ms: future(),
      },
    });
    expect(await plan(from.id)).toBe('plus');
    const res = await post({
      event: {
        id: 'tf-2',
        type: 'TRANSFER',
        store: 'APP_STORE',
        environment: 'PRODUCTION',
        event_timestamp_ms: Date.now(),
        transferred_from: [from.id],
        transferred_to: [to.id],
      },
    });
    expect(res.status).toBe(200);
    expect(await plan(from.id)).toBe('free');
    expect(await plan(to.id)).toBe('plus');
  });

  it('a lapsed Squad Pro subscription can be bought again for another squad', async () => {
    const owner = await signIn('rc-rebind@example.com');
    await sql("update user set plan = 'plus' where id = ?", owner.id);
    const a = await makeSquad(owner);
    const b = await makeSquad(owner, { name: 'Rebind squad' });
    const base = {
      app_user_id: owner.id,
      entitlement_ids: ['squad_pro'],
      product_id: 'pro_monthly',
      original_transaction_id: 'tx-r',
    };
    const t0 = Date.now();
    const attr = (id: string) => ({ squad_id: { value: id } });
    await post({
      event: {
        ...base,
        id: 'rb-1',
        type: 'INITIAL_PURCHASE',
        event_timestamp_ms: t0 - 3000,
        expiration_at_ms: future(),
        subscriber_attributes: attr(a.id),
      },
    });
    await post({
      event: {
        ...base,
        id: 'rb-2',
        type: 'EXPIRATION',
        event_timestamp_ms: t0 - 2000,
        expiration_at_ms: t0 - 2000,
      },
    });
    await post({
      event: {
        ...base,
        id: 'rb-3',
        type: 'RENEWAL',
        event_timestamp_ms: t0 - 1000,
        expiration_at_ms: future(),
        subscriber_attributes: attr(b.id),
      },
    });
    const pro = async (id: string) =>
      (
        await env.DB.prepare('select is_pro from squads where id = ?')
          .bind(id)
          .first<{ is_pro: number }>()
      )?.is_pro;
    expect(await pro(a.id)).toBe(0);
    expect(await pro(b.id)).toBe(1);
  });

  it('Squad Pro stays on the squad chosen at purchase', async () => {
    const owner = await signIn('rc-bind@example.com');
    await sql("update user set plan = 'plus' where id = ?", owner.id);
    const a = await makeSquad(owner);
    const b = await makeSquad(owner, { name: 'Second squad' });
    const base = {
      app_user_id: owner.id,
      entitlement_ids: ['squad_pro'],
      product_id: 'pro_monthly',
      original_transaction_id: 'tx-p',
    };
    await post({
      event: {
        ...base,
        id: 'bind-1',
        type: 'INITIAL_PURCHASE',
        expiration_at_ms: future(),
        subscriber_attributes: { squad_id: { value: a.id } },
      },
    });
    await post({
      event: {
        ...base,
        id: 'bind-2',
        type: 'RENEWAL',
        expiration_at_ms: future(),
        subscriber_attributes: { squad_id: { value: b.id } },
      },
    });
    const pro = async (id: string) =>
      (
        await env.DB.prepare('select is_pro from squads where id = ?')
          .bind(id)
          .first<{ is_pro: number }>()
      )?.is_pro;
    expect(await pro(a.id)).toBe(1);
    expect(await pro(b.id)).toBe(0);
  });
});

describe('creation caps and timezone', () => {
  it('caps challenge creation per user per day', async () => {
    const owner = await signIn('cap-ch@example.com');
    const sq = await makeSquad(owner);
    for (let i = 0; i < HARD_CAPS.challengesCreatedPerUserPerDay; i++) {
      const ch = await makeChallenge(owner, sq.id);
      await owner.req('POST', `/v1/challenges/${ch.id}/end`);
    }
    const res = await owner.req<ErrorBody>('POST', `/v1/squads/${sq.id}/challenges`, {
      plan: (await import('./helpers')).plan(7),
      startDate: (await import('./helpers')).today(),
    });
    expect(res.status).toBe(429);
  });

  it('stores timezones in canonical case and keeps the device spelling', async () => {
    const u = await signIn('tz-canon@example.com');
    const a = await u.req<{ timezone: string }>('PATCH', '/v1/me', { timezone: 'europe/london' });
    expect(a.json.timezone).toBe('Europe/London');
    const b = await u.req<{ timezone: string }>('PATCH', '/v1/me', { timezone: 'Asia/Kolkata' });
    expect(b.json.timezone).toBe('Asia/Kolkata');
  });
});
