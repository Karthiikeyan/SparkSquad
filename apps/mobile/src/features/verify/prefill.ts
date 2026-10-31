import type { LocalDate, PlanTask } from '@sparksquad/shared';
import { getPref } from '../../lib/prefs';
import { readSteps, type StepsResult } from './steps';
import { VERIFIERS, type VerifyResult, type VerifySource } from './verifiers';

const SOURCES: readonly VerifySource[] = ['github', 'leetcode', 'codeforces'];
const CACHE_MS = 5 * 60_000;

/** Everything a task can be verified from: public profiles plus steps on the phone. */
export type PrefillSource = VerifySource | 'steps';

export const isVerifySource = (v: unknown): v is VerifySource =>
  typeof v === 'string' && (SOURCES as readonly string[]).includes(v);

export interface Prefill {
  /** Task index → value from the source. */
  values: Record<number, number | boolean>;
  /** Task index → where the value came from (for "Verified from your X activity"). */
  sources: Record<number, PrefillSource>;
  /** Tasks we tried and couldn't verify (show "Couldn't verify, mark it yourself"). */
  failed: number[];
}

export interface PrefillDeps {
  handles?: Partial<Record<VerifySource, string>>;
  doFetch?: typeof fetch;
  steps?: (date: LocalDate) => Promise<StepsResult>;
  now?: number;
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

const valueFor = (task: PlanTask, count: number): number | boolean =>
  task.type === 'check' ? true : count;

/**
 * Verifies every task whose source is connected: one request per public profile, one steps
 * read. Unconnected sources are skipped silently.
 */
export async function prefillFromVerification(
  tasks: readonly PlanTask[],
  date: LocalDate,
  timeZone: string,
  deps: PrefillDeps = {},
): Promise<Prefill> {
  const handles = deps.handles ?? getPref('integrations') ?? {};
  const doFetch = deps.doFetch ?? fetch;
  const now = deps.now ?? Date.now();
  const out: Prefill = { values: {}, sources: {}, failed: [] };

  const wanted = new Set<VerifySource>();
  let wantsSteps = false;
  for (const task of tasks) {
    if (isVerifySource(task.verify) && handles[task.verify]) wanted.add(task.verify);
    if (task.verify === 'steps') wantsSteps = true;
  }
  if (wanted.size === 0 && !wantsSteps) return out;

  const results = new Map<PrefillSource, VerifyResult>();
  await Promise.all([
    ...[...wanted].map(async (s) => {
      results.set(s, await cached(s, handles[s] ?? '', date, timeZone, doFetch, now));
    }),
    wantsSteps
      ? (deps.steps ?? ((d: LocalDate) => readSteps(d)))(date).then((r) => {
          // Not connected: nothing to say, the user enters steps by hand.
          if (r.kind !== 'notConnected') results.set('steps', r);
        })
      : Promise.resolve(),
  ]);

  tasks.forEach((task, i) => {
    const source =
      task.verify === 'steps' ? 'steps' : isVerifySource(task.verify) ? task.verify : null;
    if (!source) return;
    const r = results.get(source);
    if (!r) return;
    if (r.kind !== 'ok') {
      out.failed.push(i);
      return;
    }
    if (r.count <= 0) return;
    out.values[i] = valueFor(task, r.count);
    out.sources[i] = source;
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
