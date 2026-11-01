import { describe, expect, it, vi } from 'vitest';
import { revokeAppleTokens } from '../src/services/appleRevoke';
import { raw, signIn } from './helpers';

describe('public pages the stores require', () => {
  const pages: [string, string][] = [
    ['/privacy', 'Privacy Policy'],
    ['/terms', 'Terms of Use'],
    ['/guidelines', 'Community guidelines'],
    ['/child-safety', 'Child safety standards'],
    ['/delete-account', 'Delete your SparkSquad account'],
    ['/support', 'Support'],
  ];

  for (const [path, heading] of pages) {
    it(`${path} loads without signing in and names the app`, async () => {
      const res = await raw(path);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      const html = await res.text();
      expect(html).toContain(heading);
      expect(html).toContain('SparkSquad');
      expect(html).not.toContain('{{');
    });
  }

  it('offers deletion without needing the app', async () => {
    const html = await (await raw('/delete-account')).text();
    expect(html).toContain('mailto:');
    expect(html).toContain('reinstall');
  });

  it('publishes CSAE standards with a contact', async () => {
    const html = await (await raw('/child-safety')).text();
    expect(html).toContain('zero tolerance');
    expect(html).toContain('can be reached at');
  });
});

describe('child safety reports', () => {
  it('accepts child_safety as a reason', async () => {
    const a = await signIn('cs-reporter@example.com');
    const b = await signIn('cs-target@example.com');
    const res = await a.req('POST', '/v1/reports', {
      targetType: 'user',
      targetId: b.id,
      reason: 'child_safety',
    });
    expect(res.status).toBeLessThan(300);
  });
});

describe('store review sign-in', () => {
  const otpSignIn = (email: string, otp: string) =>
    raw('/api/auth/sign-in/email-otp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });
  const send = (email: string) =>
    raw('/api/auth/email-otp/send-verification-otp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, type: 'sign-in' }),
    });

  it('lets the configured review account in with its fixed code', async () => {
    expect((await send('review@example.com')).status).toBe(200);
    expect((await otpSignIn('review@example.com', '246810')).status).toBe(200);
  });

  it('does not give that code to anyone else', async () => {
    expect((await send('someone@example.com')).status).toBe(200);
    expect((await otpSignIn('someone@example.com', '246810')).status).not.toBe(200);
  });
});

describe('Sign in with Apple revocation', () => {
  const env = { APPLE_APP_BUNDLE_IDENTIFIER: 'app.id', APPLE_CLIENT_SECRET: 'jwt' };

  it('swaps the code for a token, then revokes it', async () => {
    const calls: string[] = [];
    const doFetch = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${url} ${String(init?.body)}`);
      return new Response(url.endsWith('/token') ? '{"refresh_token":"r1"}' : '', { status: 200 });
    }) as unknown as typeof fetch;
    expect(await revokeAppleTokens(env, 'c1', doFetch)).toBe(true);
    expect(calls[0]).toContain('/auth/token');
    expect(calls[0]).toContain('code=c1');
    expect(calls[1]).toContain('/auth/revoke');
    expect(calls[1]).toContain('token=r1');
    expect(calls[1]).toContain('token_type_hint=refresh_token');
  });

  it('reports failure instead of throwing, so deletion still goes ahead', async () => {
    const down = (async () => {
      throw new Error('down');
    }) as unknown as typeof fetch;
    expect(await revokeAppleTokens(env, 'c1', down)).toBe(false);
    const refused = (async () => new Response('', { status: 400 })) as unknown as typeof fetch;
    expect(await revokeAppleTokens(env, 'c1', refused)).toBe(false);
  });

  it('does nothing when Apple is not set up', async () => {
    const doFetch = vi.fn() as unknown as typeof fetch;
    expect(await revokeAppleTokens({}, 'c1', doFetch)).toBe(false);
    expect(doFetch).not.toHaveBeenCalled();
  });
});
