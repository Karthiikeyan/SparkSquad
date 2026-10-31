import { Hono } from 'hono';
import type { AppEnv } from './env';

const app = new Hono<AppEnv>();

app.get('/health', (c) => c.json({ ok: true }));

export default {
  fetch: app.fetch,
  async scheduled(
    _controller: ScheduledController,
    _env: AppEnv['Bindings'],
    _ctx: ExecutionContext,
  ) {
    // Hourly cron is implemented in Phase 2.
  },
} satisfies ExportedHandler<AppEnv['Bindings']>;

export { app };
