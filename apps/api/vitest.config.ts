import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.toml' },
      miniflare: {
        bindings: {
          APP_ENV: 'test',
          BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-32',
          REVENUECAT_WEBHOOK_SECRET: 'test-rc-secret',
          ADMIN_EMAILS: 'admin@example.com',
        },
      },
    }),
  ],
  test: {
    include: ['test/**/*.test.ts'],
  },
});
