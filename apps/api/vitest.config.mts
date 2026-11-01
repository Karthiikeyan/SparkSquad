import { fileURLToPath } from 'node:url';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
  const migrations = await readD1Migrations(
    fileURLToPath(new URL('./src/db/migrations', import.meta.url)),
  );
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          bindings: {
            APP_ENV: 'test',
            BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-32',
            REVENUECAT_WEBHOOK_SECRET: 'test-rc-secret',
            ADMIN_EMAILS: 'admin@example.com',
            PUBLIC_API_URL: 'http://localhost',
            REVIEW_ACCOUNT: 'review@example.com:246810',
            TEST_MIGRATIONS: migrations,
          },
        },
      }),
    ],
    test: {
      include: ['test/**/*.test.ts'],
      // Each test signs in several users through a local Worker and D1. In a parallel run that can
      // pass the default 5 s, which failed tests at random (rules.test.ts most often).
      testTimeout: 30_000,
      hookTimeout: 30_000,
      setupFiles: ['./test/setup.ts'],
    },
  };
});
