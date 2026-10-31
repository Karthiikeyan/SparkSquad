import { localDateInZone, type LocalDate } from '@sparksquad/shared';

export type VerifySource = 'github' | 'leetcode' | 'codeforces';

export type VerifyResult =
  | { kind: 'ok'; count: number }
  | { kind: 'notFound' }
  /** Network trouble, rate limits or an unexpected shape: fall back to manual. */
  | { kind: 'error' };

type Fetch = typeof fetch;

const TIMEOUT_MS = 8000;

async function getJson(
  doFetch: Fetch,
  url: string,
  init?: RequestInit,
): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await doFetch(url, { ...init, signal: controller.signal });
    const body: unknown = await res.json().catch(() => null);
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Contribution events that count as "worked on code today". */
const GITHUB_EVENTS = new Set([
  'PushEvent',
  'PullRequestEvent',
  'PullRequestReviewEvent',
  'IssuesEvent',
  'CreateEvent',
]);

/** Public GitHub events on the local date (unauthenticated, 60 req/h per IP). */
export async function verifyGithub(
  handle: string,
  date: LocalDate,
  timeZone: string,
  doFetch: Fetch = fetch,
): Promise<VerifyResult> {
  try {
    const { status, body } = await getJson(
      doFetch,
      `https://api.github.com/users/${encodeURIComponent(handle)}/events/public?per_page=100`,
      { headers: { Accept: 'application/vnd.github+json' } },
    );
    if (status === 404) return { kind: 'notFound' };
    if (status !== 200 || !Array.isArray(body)) return { kind: 'error' };
    const count = body.filter(
      (e) =>
        isRecord(e) &&
        typeof e.type === 'string' &&
        GITHUB_EVENTS.has(e.type) &&
        typeof e.created_at === 'string' &&
        localDateInZone(new Date(e.created_at), timeZone) === date,
    ).length;
    return { kind: 'ok', count };
  } catch {
    return { kind: 'error' };
  }
}

const LEETCODE_QUERY =
  'query recentAc($username: String!, $limit: Int!) { matchedUser(username: $username) { username } recentAcSubmissionList(username: $username, limit: $limit) { title timestamp } }';

/** Accepted LeetCode submissions on the local date (unofficial GraphQL; may break). */
export async function verifyLeetcode(
  handle: string,
  date: LocalDate,
  timeZone: string,
  doFetch: Fetch = fetch,
): Promise<VerifyResult> {
  try {
    const { status, body } = await getJson(doFetch, 'https://leetcode.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Referer: 'https://leetcode.com' },
      body: JSON.stringify({ query: LEETCODE_QUERY, variables: { username: handle, limit: 20 } }),
    });
    if (status !== 200 || !isRecord(body) || !isRecord(body.data)) return { kind: 'error' };
    if (body.data.matchedUser === null) return { kind: 'notFound' };
    const list = body.data.recentAcSubmissionList;
    if (!Array.isArray(list)) return { kind: 'error' };
    const titles = new Set<string>();
    for (const s of list) {
      if (!isRecord(s)) continue;
      const ts = Number(s.timestamp);
      if (!Number.isFinite(ts)) continue;
      if (localDateInZone(new Date(ts * 1000), timeZone) === date) titles.add(String(s.title));
    }
    return { kind: 'ok', count: titles.size };
  } catch {
    return { kind: 'error' };
  }
}

/** Distinct Codeforces problems with verdict OK on the local date. */
export async function verifyCodeforces(
  handle: string,
  date: LocalDate,
  timeZone: string,
  doFetch: Fetch = fetch,
): Promise<VerifyResult> {
  try {
    const { status, body } = await getJson(
      doFetch,
      `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=1&count=50`,
    );
    if (!isRecord(body)) return { kind: 'error' };
    if (body.status === 'FAILED') {
      return typeof body.comment === 'string' && /not found/i.test(body.comment)
        ? { kind: 'notFound' }
        : { kind: 'error' };
    }
    if (status !== 200 || !Array.isArray(body.result)) return { kind: 'error' };
    const solved = new Set<string>();
    for (const s of body.result) {
      if (!isRecord(s) || s.verdict !== 'OK' || typeof s.creationTimeSeconds !== 'number') continue;
      if (localDateInZone(new Date(s.creationTimeSeconds * 1000), timeZone) !== date) continue;
      const p = isRecord(s.problem)
        ? `${String(s.problem.contestId)}${String(s.problem.index)}`
        : '';
      solved.add(p || String(s.id));
    }
    return { kind: 'ok', count: solved.size };
  } catch {
    return { kind: 'error' };
  }
}

export const VERIFIERS: Record<
  VerifySource,
  (handle: string, date: LocalDate, timeZone: string, doFetch?: Fetch) => Promise<VerifyResult>
> = {
  github: verifyGithub,
  leetcode: verifyLeetcode,
  codeforces: verifyCodeforces,
};

/** Today's date is used to test that a handle exists when it's saved. */
export function checkHandle(
  source: VerifySource,
  handle: string,
  timeZone: string,
  doFetch: Fetch = fetch,
): Promise<VerifyResult> {
  return VERIFIERS[source](handle, localDateInZone(new Date(), timeZone), timeZone, doFetch);
}
