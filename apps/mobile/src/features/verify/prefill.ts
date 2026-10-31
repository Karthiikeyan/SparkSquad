import type { LocalDate, PlanTask } from '@sparksquad/shared';
import { getPref } from '../../lib/prefs';
import { VERIFIERS, type VerifyResult, type VerifySource } from './verifiers';

const SOURCES: readonly VerifySource[] = ['github', 'leetcode', 'codeforces'];
const CACHE_MS = 5 * 60_000;

export const isVerifySource = (v: unknown): v is VerifySource =>
  typeof v === 'string' && (SOURCES as readonly string[]).includes(v);

export interface Prefill {
  /** Task index → value from the source. */
  values: Record<number, number | boolean>;
  /** Task index → where the value came from (for "Verified from your X activity"). */
  sources: Record<number, VerifySource>;
  /** Tasks we tried and couldn't verify (show "Couldn't verify, mark it yourself"). */
  failed: number[];
}

const cache = new Map<string, { at: number; result: VerifyResult }>();

export function clearVerifyCache(): void {
  cache.clear();
}

async function cached(
  source: VerifySource,
  handle: string,
  date: LocalDate,
  timeZone: string,
  doFetch: typeof fetch,
  now: number,
): Promise<VerifyResult> {
  const key = `${source}:${handle.toLowerCase()}:${date}`;
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_MS) return hit.result;
  const result = await VERIFIERS[source](handle, date, timeZone, doFetch);
  // Errors aren't cached so the next open retries.
  if (result.kind === 'ok') cache.set(key, { at: now, result });
  return result;
}

/** Verifies every task that names a source the user has connected; one request per source. */
export async function prefillFromVerification(
  tasks: readonly PlanTask[],
  date: LocalDate,
  timeZone: string,
  handles: Partial<Record<VerifySource, string>> = getPref('integrations') ?? {},
  doFetch: typeof fetch = fetch,
  now = Date.now(),
): Promise<Prefill> {
  const out: Prefill = { values: {}, sources: {}, failed: [] };
  const wanted = new Set<VerifySource>();
  tasks.forEach((task) => {
    if (isVerifySource(task.verify) && handles[task.verify]) wanted.add(task.verify);
  });
  if (wanted.size === 0) return out;
  const results = new Map<VerifySource, VerifyResult>();
  await Promise.all(
    [...wanted].map(async (s) => {
      results.set(s, await cached(s, handles[s] ?? '', date, timeZone, doFetch, now));
    }),
  );
  tasks.forEach((task, i) => {
    if (!isVerifySource(task.verify)) return;
    const r = results.get(task.verify);
    if (!r) return;
    if (r.kind !== 'ok') {
      out.failed.push(i);
      return;
    }
    if (r.count <= 0) return;
    out.values[i] = task.type === 'check' ? true : r.count;
    out.sources[i] = task.verify;
  });
  return out;
}

/** Indices still holding exactly the verified value at submit time (edits drop the mark). */
export function verifiedIndices(
  prefill: Pick<Prefill, 'values'>,
  draft: Record<number, number | boolean>,
): number[] {
  return Object.entries(prefill.values)
    .filter(([i, v]) => draft[Number(i)] === v)
    .map(([i]) => Number(i))
    .sort((a, b) => a - b);
}
