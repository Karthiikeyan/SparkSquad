import { addDays } from '@sparksquad/shared';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { compareVersions } from '../src/index';
import { runHourly } from '../src/cron/hourly';
import { checkinBody, makeChallenge, makeSquad, newId, signIn, today } from './helpers';

describe('hourly cron', () => {
  it('ends finished challenges with roll-ups and expires old data', async () => {
    const owner = await signIn('cron-owner@example.com');
    const sq = await makeSquad(owner);
    const ch = await makeChallenge(owner, sq.id, addDays(today(), -1), 2);
    await owner.req('PUT', `/v1/checkins/${newId()}`, checkinBody(ch.id, addDays(today(), -1)));
    await owner.req('PUT', `/v1/checkins/${newId()}`, checkinBody(ch.id));
    await env.DB.prepare(
      "insert into notifications (id, user_id, kind, payload, created_at, updated_at) values (?, ?, 'nudge', '{}', '2000-01-01T00:00:00.000Z', '2000-01-01T00:00:00.000Z')",
    )
      .bind(newId(), owner.id)
      .run();

    // Run "four days later" so every timezone's backfill window has closed.
    await runHourly(env, new Date(Date.now() + 4 * 86_400_000));

    const row = await env.DB.prepare('select status from challenges where id = ?')
      .bind(ch.id)
      .first<{ status: string }>();
    expect(row?.status).toBe('ended');
    const summary = await env.DB.prepare(
      'select days_done, days_elapsed from member_summary where challenge_id = ?',
    )
      .bind(ch.id)
      .first<{ days_done: number; days_elapsed: number }>();
    expect(summary).toEqual({ days_done: 2, days_elapsed: 2 });
    const badge = await env.DB.prepare(
      "select badge from badges where user_id = ? and badge = 'challenge_complete'",
    )
      .bind(owner.id)
      .first();
    expect(badge).toBeTruthy();
    const old = await env.DB.prepare(
      "select count(*) as n from notifications where created_at < '2001-01-01'",
    ).first<{ n: number }>();
    expect(old?.n).toBe(0);

    const history = await owner.req<{ completion: number; members: unknown[] }>(
      'GET',
      `/v1/squads/${sq.id}/history/${ch.id}`,
    );
    expect(history.json.completion).toBe(100);
  });

  it('compares versions', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.2', '1.10')).toBeLessThan(0);
    expect(compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0);
  });
});
