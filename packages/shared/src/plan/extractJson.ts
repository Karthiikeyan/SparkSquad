import JSON5 from 'json5';

const SMART_DOUBLE = /[\u201C\u201D\u201E\u201F\u2033\u2036]/g;
const SMART_SINGLE = /[\u2018\u2019\u201A\u201B\u2032\u2035]/g;

/** Remove // and /* *\/ comments and trailing commas outside of strings. */
export function stripJsonNoise(text: string): string {
  let out = '';
  let inString = false;
  let quote = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    const next = text[i + 1];
    if (inString) {
      out += ch;
      if (ch === '\\') {
        out += next ?? '';
        i++;
      } else if (ch === quote) {
        inString = false;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i++;
      continue;
    }
    if (ch === ',') {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j]!)) j++;
      if (text[j] === '}' || text[j] === ']') continue;
    }
    out += ch;
  }
  return out;
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // fall through
  }
  const cleaned = stripJsonNoise(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    // fall through
  }
  try {
    return JSON5.parse(cleaned);
  } catch {
    return undefined;
  }
}

/** Parse leniently: raw first, then with smart quotes normalised. */
export function parseLenient(text: string): unknown {
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (!trimmed) return undefined;
  const direct = tryParse(trimmed);
  if (direct !== undefined) return direct;
  const quotesFixed = trimmed.replace(SMART_DOUBLE, '"').replace(SMART_SINGLE, "'");
  if (quotesFixed !== trimmed) return tryParse(quotesFixed);
  return undefined;
}

/** All top-level brace-balanced `{…}` spans, string-aware. */
export function findObjectSpans(text: string): string[] {
  const spans: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let quote = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === quote) inString = false;
      continue;
    }
    if (depth > 0 && (ch === '"' || ch === '\u201C' || ch === '\u201D')) {
      inString = true;
      quote = ch === '"' ? '"' : '\u201D';
      continue;
    }
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}' && depth > 0) {
      depth--;
      if (depth === 0) spans.push(text.slice(start, i + 1));
    }
  }
  return spans;
}

/**
 * Bodies of ```fenced``` blocks, in order. A linear scan equivalent to
 * /```[^\n`]*\n?([\s\S]*?)```/g without the regex's quadratic backtracking on long, unclosed lines.
 */
function fencedBlocks(text: string): string[] {
  const blocks: string[] = [];
  let from = 0;
  for (;;) {
    const open = text.indexOf('```', from);
    if (open < 0) break;
    let body = open + 3;
    while (body < text.length && text[body] !== '\n' && text[body] !== '`') body++;
    if (text[body] === '\n') body++;
    const close = text.indexOf('```', body);
    if (close < 0) break;
    blocks.push(text.slice(body, close));
    from = close + 3;
  }
  return blocks;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function candidates(text: string): unknown[] {
  const found: unknown[] = [];
  const blocks = fencedBlocks(text);
  const sources = blocks.length > 0 ? blocks : [text];
  for (const src of sources) {
    const whole = parseLenient(src);
    if (isObject(whole)) {
      found.push(whole);
      continue;
    }
    for (const span of findObjectSpans(src)) {
      const parsed = parseLenient(span);
      if (isObject(parsed)) found.push(parsed);
    }
  }
  // An unterminated fence (AI reply cut off) still deserves a scan of the whole text.
  if (found.length === 0 && blocks.length > 0) {
    for (const span of findObjectSpans(text)) {
      const parsed = parseLenient(span);
      if (isObject(parsed)) found.push(parsed);
    }
  }
  return found;
}

/**
 * Find the plan object in a pasted AI reply (Plan Format §2).
 * Returns the first object with `sparksquad_plan`, else the first object, else null.
 */
export function extractJson(text: string): Record<string, unknown> | null {
  const clean = text.replace(/^\uFEFF/, '');
  const found = candidates(clean).filter(isObject);
  return found.find((o) => 'sparksquad_plan' in o) ?? found[0] ?? null;
}
