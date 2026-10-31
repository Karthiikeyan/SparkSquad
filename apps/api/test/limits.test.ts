import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { makeSquad, signIn } from './helpers';

describe('tier limits', () => {
  it('free users own at most 1 squad', async () => {
    const u = await signIn('limit-own@example.com');
    await makeSquad(u);
    const res = await u.req<{ error: { code: string } }>('POST', '/v1/squads', {
      name: 'Second squad',
      category: 'career',
      privacy: 'public',
    });
    expect(res.status).toBe(403);
    expect(res.json.error.code).toBe('LIMIT_SQUADS_OWNED');
  });

  it('free users are in at most 3 squads; Plus raises it', async () => {
    const owners = await Promise.all(
      [1, 2, 3, 4].map((i) => signIn(`limit-owner${i}@example.com`)),
    );
    const squads = [];
    for (const o of owners) squads.push(await makeSquad(o));
    const joiner = await signIn('limit-joiner@example.com');
    for (const sq of squads.slice(0, 3)) {
      expect((await joiner.req('POST', '/v1/squads/join', { squadId: sq.id })).status).toBe(200);
    }
    const fourth = await joiner.req<{ error: { code: string } }>('POST', '/v1/squads/join', {
      squadId: squads[3]!.id,
    });
    expect(fourth.status).toBe(403);
    expect(fourth.json.error.code).toBe('LIMIT_SQUADS_JOINED');

    await env.DB.prepare("update user set plan = 'plus' where id = ?").bind(joiner.id).run();
    expect((await joiner.req('POST', '/v1/squads/join', { squadId: squads[3]!.id })).status).toBe(
      200,
    );
  });

  it('expired Plus falls back to free limits', async () => {
    const u = await signIn('limit-expired@example.com');
    await env.DB.prepare(
      "update user set plan = 'plus', plan_expires_at = '2000-01-01T00:00:00Z' where id = ?",
    )
      .bind(u.id)
      .run();
    const me = await u.req<{ plan: string }>('GET', '/v1/me');
    expect(me.json.plan).toBe('free');
  });

  it('enforces the member limit', async () => {
    const owner = await signIn('limit-full-owner@example.com');
    const sq = await makeSquad(owner, { memberLimit: 2 });
    const a = await signIn('limit-full-a@example.com');
    const b = await signIn('limit-full-b@example.com');
    expect((await a.req('POST', '/v1/squads/join', { squadId: sq.id })).status).toBe(200);
    const full = await b.req<{ error: { code: string } }>('POST', '/v1/squads/join', {
      squadId: sq.id,
    });
    expect(full.json.error.code).toBe('LIMIT_SQUAD_FULL');
  });

  it('owners must transfer before leaving; transfer works', async () => {
    const owner = await signIn('transfer-owner@example.com');
    const friend = await signIn('transfer-friend@example.com');
    const sq = await makeSquad(owner);
    await friend.req('POST', '/v1/squads/join', { squadId: sq.id });
    const leave = await owner.req<{ error: { code: string } }>('POST', `/v1/squads/${sq.id}/leave`);
    expect(leave.json.error.code).toBe('OWNER_MUST_TRANSFER');
    expect(
      (await owner.req('POST', `/v1/squads/${sq.id}/transfer`, { userId: friend.id })).status,
    ).toBe(200);
    expect((await owner.req('POST', `/v1/squads/${sq.id}/leave`)).status).toBe(200);
    const view = await friend.req<{ myRole: string; squad: { memberCount: number } }>(
      'GET',
      `/v1/squads/${sq.id}`,
    );
    expect(view.json.myRole).toBe('owner');
    expect(view.json.squad.memberCount).toBe(1);
  });

  it('rejects invalid plans with PLAN_INVALID', async () => {
    const owner = await signIn('plan-invalid@example.com');
    const sq = await makeSquad(owner);
    const res = await owner.req<{ error: { code: string; message: string } }>(
      'POST',
      `/v1/squads/${sq.id}/challenges`,
      {
        plan: { title: 'No marker', days: [] },
        startDate: '2026-11-02',
      },
    );
    expect(res.status).toBe(422);
    expect(res.json.error.code).toBe('PLAN_INVALID');
    expect(res.json.error.message).toContain('sparksquad_plan');
  });
});
