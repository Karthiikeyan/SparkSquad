import { AwsClient } from 'aws4fetch';
import type { Bindings } from '../env';

const encoder = new TextEncoder();

function hasS3Credentials(env: Bindings): boolean {
  return Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY);
}

function bucketName(env: Bindings): string {
  return env.R2_BUCKET_NAME || 'sparksquad';
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function fileTokenMessage(
  method: 'GET' | 'PUT',
  key: string,
  exp: number,
  contentType = '',
): string {
  return `${method}\n${key}\n${exp}\n${contentType}`;
}

export async function verifyFileToken(
  env: Bindings,
  method: 'GET' | 'PUT',
  key: string,
  exp: number,
  sig: string,
  contentType = '',
): Promise<boolean> {
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  const expected = await hmacHex(
    env.BETTER_AUTH_SECRET,
    fileTokenMessage(method, key, exp, contentType),
  );
  return timingSafeEqual(expected, sig);
}

/**
 * A short-lived URL to read or write an R2 object.
 * Uses R2's S3 presigning when API credentials exist; otherwise a Worker URL signed with HMAC.
 */
export async function signedUrl(
  env: Bindings,
  method: 'GET' | 'PUT',
  key: string,
  ttlSeconds: number,
  contentType?: string,
): Promise<{ url: string; headers: Record<string, string>; expiresAt: string }> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const headers: Record<string, string> = contentType ? { 'Content-Type': contentType } : {};
  if (hasS3Credentials(env)) {
    const client = new AwsClient({
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      service: 's3',
      region: 'auto',
    });
    const target = new URL(
      `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucketName(env)}/${key}`,
    );
    target.searchParams.set('X-Amz-Expires', String(ttlSeconds));
    const signed = await client.sign(new Request(target, { method, headers }), {
      aws: { signQuery: true },
    });
    return { url: signed.url, headers, expiresAt: new Date(exp * 1000).toISOString() };
  }
  const sig = await hmacHex(
    env.BETTER_AUTH_SECRET,
    fileTokenMessage(method, key, exp, contentType ?? ''),
  );
  const url = new URL(
    `${env.PUBLIC_API_URL}/files/${key.split('/').map(encodeURIComponent).join('/')}`,
  );
  url.searchParams.set('exp', String(exp));
  url.searchParams.set('sig', sig);
  return { url: url.toString(), headers, expiresAt: new Date(exp * 1000).toISOString() };
}
