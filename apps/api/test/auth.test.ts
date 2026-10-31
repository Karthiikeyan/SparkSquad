import { describe, expect, it } from 'vitest';
import { checkinBody, makeChallenge, makeSquad, newId, raw, signIn } from './helpers';

describe('auth guards', () => {
  it('rejects requests without a session', async () => {
    for (const [method, path] of [
      ['GET', '/v1/me'],
      ['GET', '/v1/sync'],
      ['POST', '/v1/squads'],
      ['PUT', `/v1/checkins/${newId()}`],
      ['GET', '/v1/admin/reports'],
    ] as const) {
      const res = await raw(path, { method });
      expect(res.status, `${method} ${path}`).toBe(401);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe('UNAUTHORIZED');
    }
  });

  it('serves public config without a session', async () => {
    const res = await raw('/v1/config');
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      limits: { free: { squadsJoined: number } };
      features: { paymentsEnabled: boolean };
      prices: { plusMonthly: string | null };
    };
    expect(json.limits.free.squadsJoined).toBe(3);
    expect(json.features.paymentsEnabled).toBe(false);
    expect(json.prices).toHaveProperty('plusMonthly');
  });

  it('signs in with an email code and returns the profile', async () => {
    const a = await signIn('guard-a@example.com');
    const me = await a.req<{ email: string; isAdmin: boolean; ageConfirmedAt: string }>(
      'GET',
      '/v1/me',
    );
    expect(me.status).toBe(200);
    expect(me.json.email).toBe('guard-a@example.com');
    expect(me.json.isAdmin).toBe(false);
    expect(me.json.ageConfirmedAt).toBeTruthy();
  });

  it('requires 18+ consent before creating squads', async () => {
    const u = await signIn('noconsent@example.com', { consent: false });
    const res = await u.req<{ error: { code: string } }>('POST', '/v1/squads', {
      name: 'Squad',
      category: 'career',
      privacy: 'public',
    });
    expect(res.status).toBe(403);
    expect(res.json.error.code).toBe('CONSENT_REQUIRED');
  });

  it('blocks non-members from squad data and members from owner actions', async () => {
    const owner = await signIn('guard-owner@example.com');
    const outsider = await signIn('guard-out@example.com');
    const sq = await makeSquad(owner, { privacy: 'private' });
    const ch = await makeChallenge(owner, sq.id);

    expect((await outsider.req('GET', `/v1/squads/${sq.id}`)).status).toBe(403);
    expect((await outsider.req('GET', `/v1/squads/${sq.id}/preview`)).status).toBe(404);
    expect((await outsider.req('GET', `/v1/challenges/${ch.id}/plan`)).status).toBe(403);
    expect((await outsider.req('PUT', `/v1/checkins/${newId()}`, checkinBody(ch.id))).status).toBe(
      403,
    );

    // Join private squad by code -> pending; still no access.
    const join = await outsider.req<{ status: string }>('POST', '/v1/squads/join', {
      code: sq.inviteCode,
    });
    expect(join.json.status).toBe('pending');
    expect((await outsider.req('GET', `/v1/squads/${sq.id}`)).status).toBe(403);

    // Approve; member can read but not change settings.
    expect(
      (await owner.req('POST', `/v1/squads/${sq.id}/requests/${outsider.id}`, { approve: true }))
        .status,
    ).toBe(200);
    expect((await outsider.req('GET', `/v1/squads/${sq.id}`)).status).toBe(200);
    expect((await outsider.req('PATCH', `/v1/squads/${sq.id}`, { name: 'Hijacked' })).status).toBe(
      403,
    );
    expect((await outsider.req('POST', `/v1/squads/${sq.id}/invite/rotate`)).status).toBe(403);
    expect((await outsider.req('POST', `/v1/challenges/${ch.id}/end`)).status).toBe(403);
  });

  it('keeps admin endpoints for admins only', async () => {
    const u = await signIn('guard-plain@example.com');
    expect((await u.req('GET', '/v1/admin/reports')).status).toBe(403);
    const admin = await signIn('admin@example.com');
    const res = await admin.req<{ reports: unknown[] }>('GET', '/v1/admin/reports');
    expect(res.status).toBe(200);
  });

  it('rejects outdated app versions', async () => {
    const res = await raw('/v1/config', { headers: { 'x-app-version': '0.9.0' } });
    expect(res.status).toBe(426);
  });

  it('serves the admin page and invite landing page', async () => {
    const admin = await raw('/admin');
    expect(admin.status).toBe(200);
    expect(await admin.text()).toContain('SparkSquad admin');
    const join = await raw('/join/abc234');
    expect(join.status).toBe(200);
    expect(await join.text()).toContain('sparksquad://join/ABC234');
    expect((await raw('/join/<script>')).status).toBe(404);
  });
});
