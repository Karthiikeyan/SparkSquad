import type { Bindings } from '../env';

const APPLE = 'https://appleid.apple.com/auth';

function form(values: Record<string, string>): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(values).toString(),
  };
}

/**
 * Apple asks apps using Sign in with Apple to revoke the user's tokens when they delete their
 * account. We keep no Apple tokens, so the phone gets a fresh code and this swaps it for a token
 * and revokes that. Returns whether it worked; a failure must never block the deletion itself.
 */
export async function revokeAppleTokens(
  env: Pick<Bindings, 'APPLE_APP_BUNDLE_IDENTIFIER' | 'APPLE_CLIENT_ID' | 'APPLE_CLIENT_SECRET'>,
  code: string,
  doFetch: typeof fetch = fetch,
): Promise<boolean> {
  const clientId = env.APPLE_APP_BUNDLE_IDENTIFIER ?? env.APPLE_CLIENT_ID;
  const secret = env.APPLE_CLIENT_SECRET;
  if (!clientId || !secret) return false;
  const credentials = { client_id: clientId, client_secret: secret };
  try {
    const exchanged = await doFetch(
      `${APPLE}/token`,
      form({ ...credentials, code, grant_type: 'authorization_code' }),
    );
    if (!exchanged.ok) return false;
    const { refresh_token: refresh, access_token: access } = (await exchanged.json()) as {
      refresh_token?: string;
      access_token?: string;
    };
    const token = refresh ?? access;
    if (!token) return false;
    const revoked = await doFetch(
      `${APPLE}/revoke`,
      form({
        ...credentials,
        token,
        token_type_hint: refresh ? 'refresh_token' : 'access_token',
      }),
    );
    return revoked.ok;
  } catch {
    return false;
  }
}
