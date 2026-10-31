import {
  AI_DEFAULTS,
  buildRepairMessage,
  extractJson,
  parsePlan,
  type ParsePlanResult,
} from '@sparksquad/shared';
import { getPref, setPref } from '../../lib/prefs';

export type ReplyOutcome =
  | { kind: 'message'; text: string; choices: string[] }
  | { kind: 'plan'; result: Extract<ParsePlanResult, { ok: true }> }
  | { kind: 'invalid'; errors: string[] };

/** Short bullet or numbered options in a question become quick-reply chips (design AIBuild). */
export function quickReplies(text: string): string[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^([-*•]|\d+[.)])\s+/.test(l))
    .map((l) =>
      l
        .replace(/^([-*•]|\d+[.)])\s+/, '')
        .replace(/\*\*/g, '')
        .trim(),
    );
  if (lines.length < 2 || lines.length > 5) return [];
  return lines.every((l) => l.length > 0 && l.length <= 40) ? lines : [];
}

/** Classifies a model reply: plain message, a valid plan, or a plan with errors. */
export function readReply(text: string): ReplyOutcome {
  if (extractJson(text) === null) return { kind: 'message', text, choices: quickReplies(text) };
  const result = parsePlan(text);
  return result.ok ? { kind: 'plan', result } : { kind: 'invalid', errors: result.errors };
}

export { buildRepairMessage };

/** Questions asked so far (assistant turns), capped for the "Question n of about 6" line. */
export function questionNumber(assistantTurns: number): number {
  return Math.max(1, Math.min(6, assistantTurns));
}

/* ---------- daily request cap, counted on the phone (Architecture §9) ---------- */

export function dailyLimit(): number {
  return getPref('aiDailyLimit') ?? AI_DEFAULTS.dailyRequestCap;
}

export function usedToday(today: string): number {
  const usage = getPref('aiUsage');
  return usage && usage.date === today ? usage.count : 0;
}

/** Records one request; returns false (and records nothing) when today's cap is reached. */
export function takeRequest(today: string): boolean {
  const used = usedToday(today);
  if (used >= dailyLimit()) return false;
  setPref('aiUsage', { date: today, count: used + 1 });
  return true;
}
