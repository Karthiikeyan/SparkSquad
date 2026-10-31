import { HARD_CAPS } from '@sparksquad/shared';

/** Splits a list so each D1 statement stays under its bound-parameter limit. */
export function chunks<T>(items: readonly T[], size: number = HARD_CAPS.d1InListChunk): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
