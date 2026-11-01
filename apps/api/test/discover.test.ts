import { addDays } from '@sparksquad/shared';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { makeChallenge, makeSquad, signIn, today } from './helpers';

interface DiscoverBody {
  squads: { id: string; name: string; memberCount: number }[];
  nextCursor: string | null;
}

describe('discover', () => {
  it('sorts by popular, new and starting soon, and hides full squads', async () => {
    const a = await signIn('disc-a@example.com');
    const b = await signIn('disc-b@example.com');
    const c = await signIn('disc-c@example.com');
    const viewer = await signIn('disc-viewer@example.com');
    const cat = { category: 'mindfulness' };

    const small = await makeSquad(a, { ...cat, name: 'Small' });
    await makeChallenge(a, small.id, addDays(today(), 2));
    const big = await makeSquad(b, { ...cat, name: 'Big' });
    await makeChallenge(b, big.id, addDays(today(), 5));
    await env.DB.prepare('update squads set member_count = 40 where id = ?').bind(big.id).run();
    const full = await makeSquad(c, { ...cat, name: 'Full', memberLimit: 2 });
    await env.DB.prepare('update squads set member_count = 2 where id = ?').bind(full.id).run();

    const get = async (sort: string) =>
      (
        await viewer.req<DiscoverBody>('GET', `/v1/discover?category=mindfulness&sort=${sort}`)
      ).json.squads.map((s) => s.name);

    expect(await get('popular')).toEqual(['Big', 'Small']);
    expect(await get('new')).toEqual(['Big', 'Small']);
    expect(await get('soon')).toEqual(['Small', 'Big']);
  });

  it('lists every category when none is given', async () => {
    const owner = await signIn('disc-all@example.com');
    await makeSquad(owner, { category: 'reading', name: 'Read daily' });
    const res = await owner.req<DiscoverBody>('GET', '/v1/discover?sort=new');
    expect(res.status).toBe(200);
    expect(res.json.squads.some((s) => s.name === 'Read daily')).toBe(true);
  });
});
