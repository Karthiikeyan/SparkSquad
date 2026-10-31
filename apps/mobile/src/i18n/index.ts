import en from './en.json';

type Messages = typeof en;

/** Dotted paths to every leaf string, e.g. `"common.retry"`. */
type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type TKey = Leaves<Messages>;
export type TVars = Record<string, string | number>;

function lookup(key: string): string | undefined {
  let node: unknown = en;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

export function interpolate(template: string, vars?: TVars): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/** Translate a key. Falls back to the key itself so missing copy is visible, never blank. */
export function t(key: TKey, vars?: TVars): string {
  return interpolate(lookup(key) ?? key, vars);
}

/** For keys built at runtime (e.g. error codes); returns undefined when missing. */
export function tMaybe(key: string, vars?: TVars): string | undefined {
  const raw = lookup(key);
  return raw === undefined ? undefined : interpolate(raw, vars);
}

const numberFormat = new Intl.NumberFormat('en-IN');

/** Numbers in copy use Indian digit grouping (10,000 / 1,00,000). */
export function formatNumber(n: number): string {
  return numberFormat.format(n);
}
