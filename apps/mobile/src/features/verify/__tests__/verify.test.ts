import type { PlanTask } from '@sparksquad/shared';
import { clearVerifyCache, prefillFromVerification, verifiedIndices } from '../prefill';
import { verifyCodeforces, verifyGithub, verifyLeetcode } from '../verifiers';

const TZ = 'Asia/Kolkata';
const DATE = '2026-10-31';

/** Minimal fetch double: returns `body` with `status`, records calls. */
function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return { status, ok: status >= 200 && status < 300, json: async () => body } as Response;
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const failing = (async () => {
  throw new TypeError('Network request failed');
}) as unknown as typeof fetch;

describe('verifyGithub', () => {
  it('counts contribution events on the local date in the user’s timezone', async () => {
    const { fn, calls } = fakeFetch(200, [
      { type: 'PushEvent', created_at: '2026-10-31T03:00:00Z' }, // 08:30 IST, today
      { type: 'PullRequestEvent', created_at: '2026-10-30T19:00:00Z' }, // 00:30 IST, today
      { type: 'WatchEvent', created_at: '2026-10-31T04:00:00Z' }, // not a contribution
      { type: 'PushEvent', created_at: '2026-10-30T18:00:00Z' }, // 23:30 IST yesterday
    ]);
    expect(await verifyGithub('kiran', DATE, TZ, fn)).toEqual({ kind: 'ok', count: 2 });
    expect(calls[0]?.url).toContain('/users/kiran/events/public');
  });

  it('maps 404 to notFound and other trouble to error', async () => {
    expect(await verifyGithub('nobody', DATE, TZ, fakeFetch(404, {}).fn)).toEqual({
      kind: 'notFound',
    });
    expect(await verifyGithub('kiran', DATE, TZ, fakeFetch(403, {}).fn)).toEqual({ kind: 'error' });
    expect(await verifyGithub('kiran', DATE, TZ, failing)).toEqual({ kind: 'error' });
  });
});

describe('verifyLeetcode', () => {
  it('counts distinct accepted problems on the local date', async () => {
    const ts = (iso: string) => String(Date.parse(iso) / 1000);
    const { fn, calls } = fakeFetch(200, {
      data: {
        matchedUser: { username: 'kiran' },
        recentAcSubmissionList: [
          { title: 'Two Sum', timestamp: ts('2026-10-31T02:00:00Z') },
          { title: 'Two Sum', timestamp: ts('2026-10-31T05:00:00Z') },
          { title: 'LRU Cache', timestamp: ts('2026-10-31T10:00:00Z') },
          { title: 'Old', timestamp: ts('2026-10-29T10:00:00Z') },
        ],
      },
    });
    expect(await verifyLeetcode('kiran', DATE, TZ, fn)).toEqual({ kind: 'ok', count: 2 });
    expect(calls[0]?.init?.method).toBe('POST');
  });

  it('reports unknown users and unexpected shapes', async () => {
    expect(
      await verifyLeetcode(
        'ghost',
        DATE,
        TZ,
        fakeFetch(200, { data: { matchedUser: null, recentAcSubmissionList: null } }).fn,
      ),
    ).toEqual({ kind: 'notFound' });
    expect(await verifyLeetcode('kiran', DATE, TZ, fakeFetch(200, { errors: [] }).fn)).toEqual({
      kind: 'error',
    });
  });
});

describe('verifyCodeforces', () => {
  it('counts distinct problems with verdict OK on the local date', async () => {
    const at = (iso: string) => Date.parse(iso) / 1000;
    const { fn } = fakeFetch(200, {
      status: 'OK',
      result: [
        {
          id: 1,
          verdict: 'OK',
          creationTimeSeconds: at('2026-10-31T06:00:00Z'),
          problem: { contestId: 1, index: 'A' },
        },
        {
          id: 2,
          verdict: 'OK',
          creationTimeSeconds: at('2026-10-31T07:00:00Z'),
          problem: { contestId: 1, index: 'A' },
        },
        {
          id: 3,
          verdict: 'WRONG_ANSWER',
          creationTimeSeconds: at('2026-10-31T07:00:00Z'),
          problem: { contestId: 1, index: 'B' },
        },
        {
          id: 4,
          verdict: 'OK',
          creationTimeSeconds: at('2026-10-31T08:00:00Z'),
          problem: { contestId: 2, index: 'C' },
        },
      ],
    });
    expect(await verifyCodeforces('tourist', DATE, TZ, fn)).toEqual({ kind: 'ok', count: 2 });
  });

  it('maps "not found" failures', async () => {
    const { fn } = fakeFetch(400, {
      status: 'FAILED',
      comment: 'handle: User with handle zz not found',
    });
    expect(await verifyCodeforces('zz', DATE, TZ, fn)).toEqual({ kind: 'notFound' });
  });
});

describe('prefillFromVerification', () => {
  beforeEach(() => clearVerifyCache());

  const tasks: PlanTask[] = [
    { id: 'a', title: 'LeetCode', type: 'count', target: 2, verify: 'leetcode' },
    { id: 'b', title: 'Commit', type: 'check', verify: 'github' },
    { id: 'c', title: 'Read', type: 'minutes', target: 20 },
    { id: 'd', title: 'Walk', type: 'count', target: 5000, verify: 'steps' },
  ] as PlanTask[];

  const routed = (github: unknown, leetcode: unknown) => {
    let count = 0;
    const fn = (async (url: string) => {
      count += 1;
      const body = url.includes('github') ? github : leetcode;
      if (body === 'fail') throw new TypeError('offline');
      return { status: 200, ok: true, json: async () => body } as Response;
    }) as unknown as typeof fetch;
    return { fn, calls: () => count };
  };

  it('fills values from connected sources and marks failures', async () => {
    const ts = String(Date.parse('2026-10-31T06:00:00Z') / 1000);
    const { fn } = routed('fail', {
      data: {
        matchedUser: { username: 'k' },
        recentAcSubmissionList: [
          { title: 'A', timestamp: ts },
          { title: 'B', timestamp: ts },
          { title: 'C', timestamp: ts },
        ],
      },
    });
    const p = await prefillFromVerification(tasks, DATE, TZ, { leetcode: 'k', github: 'k' }, fn);
    expect(p.values).toEqual({ 0: 3 });
    expect(p.sources).toEqual({ 0: 'leetcode' });
    expect(p.failed).toEqual([1]);
  });

  it('skips sources without a handle and caches successful lookups', async () => {
    const { fn, calls } = routed([{ type: 'PushEvent', created_at: '2026-10-31T06:00:00Z' }], {});
    const first = await prefillFromVerification(tasks, DATE, TZ, { github: 'k' }, fn, 1000);
    expect(first.values).toEqual({ 1: true });
    await prefillFromVerification(tasks, DATE, TZ, { github: 'k' }, fn, 2000);
    expect(calls()).toBe(1);
    await prefillFromVerification(tasks, DATE, TZ, { github: 'k' }, fn, 1000 + 6 * 60_000);
    expect(calls()).toBe(2);
  });

  it('keeps the verified mark only while the value is unchanged', () => {
    const prefill = { values: { 0: 3, 1: true } };
    expect(verifiedIndices(prefill, { 0: 3, 1: true })).toEqual([0, 1]);
    expect(verifiedIndices(prefill, { 0: 4, 1: true })).toEqual([1]);
  });
});
