// Seeds plan templates into R2 and the D1 `templates` table.
// Usage: pnpm seed:templates            (local wrangler dev storage)
//        pnpm seed:templates -- --remote (your Cloudflare account)
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const apiDir = join(here, '..');
const templatesDir = join(apiDir, '..', '..', 'templates');
const remote = process.argv.includes('--remote');
const target = remote ? '--remote' : '--local';
const bucket = process.env.R2_BUCKET_NAME || 'sparksquad';
const database = process.env.D1_DATABASE_NAME || 'sparksquad';

function wrangler(args) {
  execFileSync('pnpm', ['exec', 'wrangler', ...args], {
    cwd: apiDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

const sqlEscape = (s) => String(s).replace(/'/g, "''");
const files = readdirSync(templatesDir).filter((f) => f.endsWith('.sparksquad.json'));
const statements = [];

for (const file of files) {
  const slug = file.replace('.sparksquad.json', '');
  const path = join(templatesDir, file);
  const plan = JSON.parse(readFileSync(path, 'utf8'));
  const active = plan.days.filter((d) => !d.rest);
  const tasksPerDay = Math.max(
    1,
    Math.round(active.reduce((n, d) => n + d.tasks.length, 0) / Math.max(active.length, 1)),
  );
  const key = `templates/${slug}.json`;
  console.log(`Uploading ${key}`);
  wrangler([
    'r2',
    'object',
    'put',
    `${bucket}/${key}`,
    '--file',
    path,
    '--content-type',
    'application/json',
    target,
  ]);
  statements.push(
    `INSERT INTO templates (id, slug, title, category, duration_days, tasks_per_day, plan_key, published) VALUES ('tpl_${sqlEscape(slug)}', '${sqlEscape(slug)}', '${sqlEscape(plan.title)}', '${sqlEscape(plan.category)}', ${Number(plan.duration_days)}, ${tasksPerDay}, '${sqlEscape(key)}', 1) ON CONFLICT(slug) DO UPDATE SET title = excluded.title, category = excluded.category, duration_days = excluded.duration_days, tasks_per_day = excluded.tasks_per_day, plan_key = excluded.plan_key, published = 1;`,
  );
}

const sqlFile = join(mkdtempSync(join(tmpdir(), 'sparksquad-')), 'templates.sql');
writeFileSync(sqlFile, statements.join('\n'));
wrangler(['d1', 'execute', database, target, '--file', sqlFile, '--yes']);
console.log(`Seeded ${files.length} templates (${remote ? 'remote' : 'local'}).`);
