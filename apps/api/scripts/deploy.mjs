#!/usr/bin/env node
/**
 * `pnpm run deploy`: applies pending D1 migrations to the remote database, then deploys the Worker.
 * Migrations run first and must succeed, so new code never runs against an old schema.
 * Extra arguments are passed to `wrangler deploy` (for example `--env staging`).
 */
import { spawnSync } from 'node:child_process';

/** Quotes one argument for cmd.exe (wrangler is a .cmd shim on Windows, so a shell is needed). */
const quote = (a) => (/^[\w@%+=:,./-]+$/.test(a) ? a : `"${a.replace(/"/g, '""')}"`);

function wrangler(args, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  const res =
    process.platform === 'win32'
      ? spawnSync(['wrangler', ...args].map(quote).join(' '), {
          stdio: 'inherit',
          shell: true,
          env,
        })
      : spawnSync('wrangler', args, { stdio: 'inherit', env });
  if (res.status !== 0) {
    console.error(`\nwrangler ${args.join(' ')} failed; deploy stopped.`);
    process.exit(res.status ?? 1);
  }
}

const deployArgs = process.argv.slice(2);
const envIndex = deployArgs.indexOf('--env');
const envArgs = envIndex >= 0 ? deployArgs.slice(envIndex, envIndex + 2) : [];

// CI=true makes wrangler apply without the interactive "continue?" prompt.
wrangler(['d1', 'migrations', 'apply', 'DB', '--remote', ...envArgs], { CI: 'true' });
wrangler(['deploy', ...deployArgs]);
