/** The AI prompt from Plan Format §5. Used by the copy-prompt screen and BYOK builder. */

export const PROMPT_GOAL_PLACEHOLDER =
  '[replace this line with your goal, e.g. "Crack product-company DSA interviews in 60 days"]';

export const PROMPT_EXAMPLE_PLAN = {
  sparksquad_plan: 1,
  title: '60 days of DSA',
  goal: 'Clear product-company coding rounds',
  category: 'career',
  duration_days: 60,
  days_per_week: 6,
  phases: [{ name: 'Arrays and strings', from_day: 1, to_day: 14 }],
  days: [
    {
      day: 1,
      title: 'Arrays: the basics',
      tasks: [
        {
          title: 'Solve 2 easy array problems',
          type: 'count',
          target: 2,
          unit: 'problems',
          verify: 'leetcode',
        },
        {
          title: 'Watch the two-pointer lesson',
          type: 'minutes',
          target: 30,
          link: 'https://example.com/two-pointers',
        },
        { title: "Write notes on today's patterns", type: 'check' },
      ],
    },
    { day: 7, title: 'Rest and review', rest: true, tasks: [] },
  ],
  milestones: [{ day: 14, title: 'Arrays phase complete' }],
} as const;

const TEMPLATE = `I use an app called SparkSquad to follow a day-by-day plan with an accountability squad. Help me design that plan.

My goal: {{GOAL}}

Before you write anything, interview me. Ask one question at a time and wait for my answer. Find out:
1. What exactly I want to achieve, and how I will know I succeeded
2. My current level and what I have already tried
3. How many days the plan should run
4. Which days of the week I can work on it, and how many minutes a day
5. Resources I use or want to use (books, websites, courses, problem lists)
6. Anything that limits me (exams, travel, health, budget)
Ask a follow-up if an answer is vague. When you have enough, summarise the plan in five lines and ask me to confirm.

After I confirm, reply with only one JSON object inside a json code block, in exactly this format:
{{FORMAT}}

Rules:
- "sparksquad_plan" is always 1.
- Include every day from 1 to duration_days. Mark rest days with "rest": true and no tasks.
- 1 to 6 tasks per day, each doable in one sitting, titles under 60 characters starting with a verb.
- "type" is "check", "count" or "minutes". Use "verify" only for leetcode, github, codeforces or steps.
- Increase difficulty gradually and end each week with a review day.
- Keep links to real, well-known resources and use https.`;

export const BYOK_SYSTEM_RULE =
  "When you output the plan, output nothing else. If I say 'repair' followed by errors, return the corrected full JSON only.";

export function buildPrompt(goal: string, options: { byok?: boolean } = {}): string {
  const g = goal.replace(/\s+/g, ' ').trim();
  const prompt = TEMPLATE.replace('{{GOAL}}', () => g || PROMPT_GOAL_PLACEHOLDER).replace(
    '{{FORMAT}}',
    () => JSON.stringify(PROMPT_EXAMPLE_PLAN),
  );
  return options.byok ? `${prompt}\n\n${BYOK_SYSTEM_RULE}` : prompt;
}

/** The single repair round message sent back to a BYOK model. */
export function buildRepairMessage(errors: readonly string[]): string {
  return `repair:\n${errors.map((e) => `- ${e}`).join('\n')}`;
}
