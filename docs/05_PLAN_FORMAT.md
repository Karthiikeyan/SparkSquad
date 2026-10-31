# SparkSquad Plan Format (v1) — import, AI prompt and parser rules

A plan is one JSON object that turns into day-by-day tasks for every squad member. The same format is used for templates, file import, AI-generated plans (copy-paste and BYOK) and plan export. Design borrowed from openGym's shareable plan file: **versioned, imported defensively, never overwrites anything.**

Implement everything here in `packages/shared/src/plan/` (zod schema, `extractJson`, `parsePlan`, `buildPrompt`, `exportPlan`) and use it from both the app (preview before import) and the API (re-validate on create).

## 1. Format

```json
{
  "sparksquad_plan": 1,
  "title": "60 days of DSA",
  "goal": "Clear product-company coding rounds",
  "category": "career",
  "duration_days": 60,
  "days_per_week": 6,
  "phases": [
    { "name": "Arrays and strings", "from_day": 1, "to_day": 14 }
  ],
  "days": [
    {
      "day": 1,
      "title": "Arrays: the basics",
      "tasks": [
        { "title": "Solve 2 easy array problems", "type": "count", "target": 2, "unit": "problems", "verify": "leetcode" },
        { "title": "Watch the two-pointer lesson", "type": "minutes", "target": 30, "link": "https://example.com/two-pointers" },
        { "title": "Write notes on today's patterns", "type": "check" }
      ]
    },
    { "day": 7, "title": "Rest and review", "rest": true, "tasks": [] }
  ],
  "milestones": [
    { "day": 14, "title": "Arrays phase complete" }
  ]
}
```

| Field | Type | Rules |
|---|---|---|
| `sparksquad_plan` | integer | **Required**, must be `1`. Missing/other → not a plan. |
| `title` | string | Required, trimmed, 1–80 chars (cut at 80, record a fix). |
| `goal` | string | Optional, ≤160. |
| `category` | `career`\|`fitness`\|`learning`\|`other` | Unknown → `other` (fix). |
| `duration_days` | integer | Required, clamp 1–120 (fix if clamped). If missing, use max `day` found. |
| `days_per_week` | integer | Optional 1–7, default 7. Informational. |
| `phases[]` | `{name ≤40, from_day, to_day}` | Optional, ≤12. Drop phases outside range or overlapping (fix). |
| `days[]` | array | Required. One entry per day 1..duration. Missing days are created as empty "Open day" (fix). Duplicates: keep first (fix). Days beyond duration dropped (fix). |
| `days[].title` | string | ≤60, default "Day N". |
| `days[].rest` | boolean | Optional. Rest/review day: tasks ignored, doesn't count against streaks or score. |
| `days[].tasks[]` | array | 0–8 tasks (extra dropped, fix). 0 tasks and not rest → treated as rest (fix). |
| `task.title` | string | Required, ≤80 (cut, fix). Empty → task dropped (fix). |
| `task.type` | `check`\|`count`\|`minutes` | Unknown → `check` (fix: "Day 23: task type "quiz" changed to done-or-not"). |
| `task.target` | integer | Required for count/minutes, clamp 1–10000; missing → 1 (fix). Ignored for check. |
| `task.unit` | string | count only, ≤20, default "times". |
| `task.verify` | `leetcode`\|`github`\|`codeforces`\|`steps` | Optional. Anything else removed (fix: "Day 31: HackerRank check removed, not supported yet"). `steps` only valid with type `count`. |
| `task.link` | string | Optional, must be `https://`, ≤500; else removed (fix). |
| `milestones[]` | `{day, title ≤60}` | Optional ≤20; out-of-range dropped (fix). |
| any other field | — | Ignored silently (not counted as a fix). |

Size limits: raw input ≤ 512 KB; reject larger with a clear error.

## 2. `extractJson(text)`
Users paste the AI's **whole reply**. Find the plan:
1. If there are fenced code blocks (```json or ```), try each, in order.
2. Else find the first `{` … matching `}` span (brace-balanced, string-aware) and try it.
3. Tolerate: BOM, trailing commas, smart quotes around keys/strings (normalise “ ” → "), `// comments`. Use a forgiving parser (e.g. `json5`) as a fallback.
4. If several objects parse, take the first with `sparksquad_plan`.

## 3. `parsePlan(input) → { ok: true, plan, fixes: Fix[], stats } | { ok: false, errors: string[] }`
- Never throws. `fixes` are human-readable lines shown in the "N items were fixed" disclosure.
- `stats`: `{ days, tasks, restDays, phases, verifiedTasks }` (drives the import preview tiles).
- Hard failures (`ok:false`): no JSON found, `sparksquad_plan` missing or ≠ 1, zero usable days. Messages: "This isn't a SparkSquad plan: the "sparksquad_plan": 1 line is missing." etc.
- Output is normalised: every day 1..N present, sorted, ids assigned (`d{day}t{index}`), defaults filled.
- Server runs the same function on create; client preview and server result must match (`planHash` = SHA-256 of canonical JSON).

## 4. `exportPlan(challenge, dayEdits)`
Canonical JSON of the current plan (R2 plan + owner day edits merged) with `sparksquad_plan: 1`, pretty-printed, shareable via the share sheet as `<slug>.sparksquad.json`.

## 5. The AI prompt (`buildPrompt(goal)`)
Shown on the "Build it with your AI" screen and used as the BYOK system/first message. `{{GOAL}}` is replaced with the user's goal (or the placeholder line if empty); `{{FORMAT}}` is replaced by the example JSON from §1 (minified to keep the prompt short).

```
I use an app called SparkSquad to follow a day-by-day plan with an accountability squad. Help me design that plan.

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
- Keep links to real, well-known resources and use https.
```

BYOK only — appended system rule: "When you output the plan, output nothing else. If I say 'repair' followed by errors, return the corrected full JSON only." Repair message: `repair:\n- <error 1>\n- <error 2>`.

Placeholder for an empty goal: `[replace this line with your goal, e.g. "Crack product-company DSA interviews in 60 days"]`.

## 6. Tests (Vitest, `packages/shared/test/plan/`)
Fixtures to include and assert: valid minimal plan; full 60-day plan; reply wrapped in chatter + ```json fence; two code blocks where the second is the plan; smart quotes + trailing commas; missing `sparksquad_plan` (error); `sparksquad_plan: 2` (error); unknown task type (fix); unsupported verify (fix); 150-day plan (clamped + fix); missing days 5–9 (filled + fix); duplicate day (fix); 12 tasks in a day (trimmed + fix); `http://` link (removed + fix); 600 KB input (error); round-trip `exportPlan(parsePlan(x))` stable; client/server hash equality.

## 7. Templates (`/templates/*.sparksquad.json`)
Write real, high-quality plans (real public resources, sensible progression, review day each week), validated by the parser in a test:
- `dsa-30` — 30 days, 3 tasks/day, arrays → strings → hashing → two pointers → sliding window → stack → binary search → linked list → trees → graphs basics; LeetCode-verified counts.
- `dsa-60` — 60 days, 4 phases incl. DP and graphs.
- `aptitude-21` — 21 days quant/logical/verbal for Indian placement tests, 2 tasks/day.
- `sql-30` — 30 days, 1–2 tasks/day.
- `steps-10k` — 30 days, 1 task/day, `count` 10000 steps with `verify: steps`.
- `system-design-30` — 30 days, 1–2 tasks/day.
Seed them into the `templates` table + R2 with a script (`pnpm seed:templates`).
