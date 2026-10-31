import { TIER_LIMITS, type ConfigResponse } from '@sparksquad/shared';
import { Hono } from 'hono';
import type { AppEnv } from '../env';

export const configRoutes = new Hono<AppEnv>();

configRoutes.get('/', (c) => {
  const env = c.env;
  const response: ConfigResponse = {
    minAppVersion: env.MIN_APP_VERSION,
    limits: TIER_LIMITS,
    features: {
      paymentsEnabled: env.PAYMENTS_ENABLED === 'true',
      emailOtp: true,
      google: Boolean(env.GOOGLE_CLIENT_ID),
      apple: Boolean(env.APPLE_CLIENT_ID),
    },
    contactEmail: env.CONTACT_EMAIL,
    prices: {
      plusMonthly: env.PRICE_PLUS_MONTHLY || null,
      plusYearly: env.PRICE_PLUS_YEARLY || null,
      squadProMonthly: env.PRICE_SQUAD_PRO_MONTHLY || null,
      squadProYearly: env.PRICE_SQUAD_PRO_YEARLY || null,
    },
  };
  c.header('Cache-Control', 'public, max-age=300');
  return c.json(response);
});
