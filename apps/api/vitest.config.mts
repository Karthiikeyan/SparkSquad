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
            TEST_MIGRATIONS: migrations,
          },
        },
      }),
    ],
    test: {
      include: ['test/**/*.test.ts'],
      setupFiles: ['./test/setup.ts'],
    },
  };
});
