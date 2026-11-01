import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { exportPlan, parsePlan } from '../src/plan';

const dir = join(__dirname, '..', '..', '..', 'templates');
const files = readdirSync(dir).filter((f) => f.endsWith('.sparksquad.json'));

const expected: Record<string, { days: number; category: string }> = {
  'dsa-30': { days: 30, category: 'career' },
  'dsa-60': { days: 60, category: 'career' },
  'aptitude-21': { days: 21, category: 'career' },
  'sql-30': { days: 30, category: 'career' },
  'steps-10k': { days: 30, category: 'fitness' },
  'system-design-30': { days: 30, category: 'career' },
  'reading-30': { days: 30, category: 'reading' },
  'meditation-21': { days: 21, category: 'mindfulness' },
  'sleep-water-14': { days: 14, category: 'health' },
  'exam-revision-45': { days: 45, category: 'exams' },
  'spoken-english-30': { days: 30, category: 'languages' },
  'gym-starter-28': { days: 28, category: 'fitness' },
  'no-spend-30': { days: 30, category: 'finance' },
};

describe('templates', () => {
  it('has every documented template', () => {
    expect(files.map((f) => f.replace('.sparksquad.json', '')).sort()).toEqual(
      Object.keys(expected).sort(),
    );
  });

  for (const file of files) {
    const slug = file.replace('.sparksquad.json', '');
    it(`${slug} parses cleanly with no fixes`, () => {
      const text = readFileSync(join(dir, file), 'utf8');
      const r = parsePlan(text);
      if (!r.ok) throw new Error(r.errors.join('; '));
      expect(r.fixes).toEqual([]);
      expect(r.plan.duration_days).toBe(expected[slug]!.days);
      expect(r.plan.category).toBe(expected[slug]!.category);
      // Every week has a rest/review or easy day; every active day has 1–6 tasks.
      for (const d of r.plan.days) {
        if (!d.rest) expect(d.tasks.length).toBeGreaterThanOrEqual(1);
        expect(d.tasks.length).toBeLessThanOrEqual(6);
        for (const t of d.tasks) expect(t.title.length).toBeLessThanOrEqual(60);
      }
      // Files are stored in canonical export form.
      expect(exportPlan(r.plan)).toBe(text.replace(/\r\n/g, '\n'));
    });
  }
});
