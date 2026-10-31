/** Plan fixtures for tests. */

export const minimalPlan = {
  sparksquad_plan: 1,
  title: 'Tiny plan',
  duration_days: 1,
  days: [{ day: 1, title: 'Start', tasks: [{ title: 'Do one thing', type: 'check' }] }],
};

export function fullPlan(days = 60): Record<string, unknown> {
  return {
    sparksquad_plan: 1,
    title: '60 days of DSA',
    goal: 'Clear product-company coding rounds',
    category: 'career',
    duration_days: days,
    days_per_week: 6,
    phases: [
      { name: 'Arrays and strings', from_day: 1, to_day: 14 },
      { name: 'Hashing and pointers', from_day: 15, to_day: 28 },
      { name: 'Trees and graphs', from_day: 29, to_day: 45 },
      { name: 'Dynamic programming', from_day: 46, to_day: days },
    ],
    days: Array.from({ length: days }, (_, i) => {
      const day = i + 1;
      if (day % 7 === 0) return { day, title: 'Rest and review', rest: true, tasks: [] };
      return {
        day,
        title: `Day ${day} practice`,
        tasks: [
          {
            title: 'Solve 2 problems',
            type: 'count',
            target: 2,
            unit: 'problems',
            verify: 'leetcode',
          },
          {
            title: 'Watch a lesson',
            type: 'minutes',
            target: 30,
            link: 'https://neetcode.io/roadmap',
          },
          { title: 'Write notes', type: 'check' },
        ],
      };
    }),
    milestones: [
      { day: 14, title: 'Arrays phase complete' },
      { day: days, title: 'Plan complete' },
    ],
  };
}

export const chatterReply = `Great, here's your plan! Let me know if you want changes.

\`\`\`json
${JSON.stringify(minimalPlan, null, 2)}
\`\`\`

Good luck with your squad!`;

export const twoBlocksReply = `First, a summary in JSON:

\`\`\`json
{ "summary": "five lines", "days": 30 }
\`\`\`

And here is the plan:

\`\`\`json
${JSON.stringify(fullPlan(14), null, 2)}
\`\`\``;

export const smartQuotesReply = `Here you go:
{
  “sparksquad_plan”: 1,
  “title”: “Smart quotes plan”,
  “duration_days”: 2,
  // a comment the AI added
  “days”: [
    { “day”: 1, “title”: “One”, “tasks”: [ { “title”: “Read”, “type”: “check”, }, ], },
    { “day”: 2, “title”: “Two”, “tasks”: [ { “title”: “Run”, “type”: “minutes”, “target”: 20 } ] },
  ],
}`;
