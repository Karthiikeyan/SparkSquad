import * as Sentry from '@sentry/react-native';
import PostHog from 'posthog-react-native';
import { env } from './env';

export type AnalyticsValue = string | number | boolean | null;
export type AnalyticsProps = Record<string, AnalyticsValue | undefined>;

/** Property names that must never leave the phone. */
const SENSITIVE_KEY = /key|token|secret|password|cookie|auth|email|note|body|comment|phone/i;
/** Values shaped like provider API keys (OpenAI, Anthropic, Gemini) or bearer tokens. */
const SENSITIVE_VALUE = /(sk-[A-Za-z0-9_-]{8,}|sk-ant-|AIza[0-9A-Za-z_-]{10,}|Bearer\s)/;

export function sanitizeProps(props: AnalyticsProps | undefined): Record<string, AnalyticsValue> {
  const out: Record<string, AnalyticsValue> = {};
  if (!props) return out;
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || SENSITIVE_KEY.test(k)) continue;
    if (typeof v === 'string' && SENSITIVE_VALUE.test(v)) continue;
    out[k] = typeof v === 'string' ? v.slice(0, 200) : v;
  }
  return out;
}

/** Removes anything secret-looking from free text (crash messages, breadcrumbs). */
export function scrubText(text: string): string {
  return text.replace(new RegExp(SENSITIVE_VALUE.source, 'g'), '[redacted]');
}

let posthog: PostHog | null = null;
let sentryReady = false;

export function initAnalytics(): void {
  if (env.posthogKey && !posthog) {
    posthog = new PostHog(env.posthogKey, {
      host: env.posthogHost,
      captureAppLifecycleEvents: true,
    });
  }
  if (env.sentryDsn && !sentryReady) {
    Sentry.init({
      dsn: env.sentryDsn,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      beforeSend(event) {
        if (event.request) {
          delete event.request.headers;
          delete event.request.cookies;
          delete event.request.data;
        }
        if (event.message) event.message = scrubText(event.message);
        for (const ex of event.exception?.values ?? []) {
          if (ex.value) ex.value = scrubText(ex.value);
        }
        return event;
      },
      beforeBreadcrumb(crumb) {
        // Network breadcrumbs could carry provider URLs with keys; drop them entirely.
        if (crumb.category === 'fetch' || crumb.category === 'xhr') return null;
        if (crumb.message) crumb.message = scrubText(crumb.message);
        return crumb;
      },
    });
    sentryReady = true;
  }
}

export function track(event: string, props?: AnalyticsProps): void {
  posthog?.capture(event, sanitizeProps(props));
}

export function identify(userId: string): void {
  posthog?.identify(userId);
  if (sentryReady) Sentry.setUser({ id: userId });
}

export function resetAnalytics(): void {
  posthog?.reset();
  if (sentryReady) Sentry.setUser(null);
}

export function setAnalyticsOptOut(optOut: boolean): void {
  if (!posthog) return;
  if (optOut) void posthog.optOut();
  else void posthog.optIn();
}

export function captureError(error: unknown): void {
  if (sentryReady) Sentry.captureException(error);
}
