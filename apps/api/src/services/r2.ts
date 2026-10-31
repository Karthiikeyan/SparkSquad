import { AwsClient } from 'aws4fetch';
import type { Bindings } from '../env';

const encoder = new TextEncoder();

function hasS3Credentials(env: Bindings): boolean {
  return Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY);
}

function bucketName(env: Bindings): string {
  return env.R2_BUCKET_NAME || 'sparksquad';
}

/** Longest-lived file URL we ever issue (data exports, 24 h) plus clock-skew slack. */
export const MAX_FILE_TOKEN_TTL_SECONDS = 24 * 3600 + 300;

/** Object keys we issue: `segment/segment/...` with no empty, `.` or `..` segments. */
const SAFE_KEY_SEGMENT = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,127}$/;

export function isSafeObjectKey(key: string): boolean {
  if (key.length === 0 || key.length > 512) return false;
  return key.split('/').every((s) => SAFE_KEY_SEGMENT.test(s) && s !== '.' && s !== '..');
}

async function hmacRaw(keyBytes: Uint8Array, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

const fileKeyCache = new Map<string, Uint8Array>();

/**
 * File tokens use a key derived from BETTER_AUTH_SECRET with a fixed label, never the raw secret,
 * so nothing Better Auth signs with that secret can double as a file token.
 */
async function fileTokenKey(secret: string): Promise<Uint8Array> {
  const cached = fileKeyCache.get(secret);
  if (cached) return cached;
  const derived = await hmacRaw(encoder.encode(secret), 'sparksquad/file-token/v1');
  fileKeyCache.clear();
  fileKeyCache.set(secret, derived);
  return derived;
}

async function fileTokenSig(secret: string, message: string): Promise<string> {
  const sig = await hmacRaw(await fileTokenKey(secret), message);
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
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
  if (!Number.isSafeInteger(exp)) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  if (exp < nowSec || exp > nowSec + MAX_FILE_TOKEN_TTL_SECONDS) return false;
  if (!/^[0-9a-f]{64}$/.test(sig) || !isSafeObjectKey(key)) return false;
  const expected = await fileTokenSig(
    env.BETTER_AUTH_SECRET,
    fileTokenMessage(method, key, exp, contentType),
  );
  return timingSafeEqual(expected, sig);
}

/**
 * A short-lived URL to read or write an R2 object.
 * Reads use R2's S3 presigning when API credentials exist. Writes always go through the Worker
 * (`PUT /files/*`), because S3 presigned URLs cannot bind the content type or size.
 */
export async function signedUrl(
  env: Bindings,
  method: 'GET' | 'PUT',
  key: string,
  ttlSeconds: number,
  contentType?: string,
): Promise<{ url: string; headers: Record<string, string>; expiresAt: string }> {
  if (!isSafeObjectKey(key)) throw new Error('Refusing to sign an unsafe object key');
  if (ttlSeconds <= 0 || ttlSeconds > MAX_FILE_TOKEN_TTL_SECONDS - 300) {
    throw new Error('Signed URL lifetime out of range');
  }
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const headers: Record<string, string> = contentType ? { 'Content-Type': contentType } : {};
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  if (method === 'GET' && hasS3Credentials(env)) {
    const client = new AwsClient({
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      service: 's3',
      region: 'auto',
    });
    const target = new URL(
      `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucketName(env)}/${encodedKey}`,
    );
    target.searchParams.set('X-Amz-Expires', String(ttlSeconds));
    const signed = await client.sign(new Request(target, { method, headers }), {
      aws: { signQuery: true },
    });
    return { url: signed.url, headers, expiresAt: new Date(exp * 1000).toISOString() };
  }
  const sig = await fileTokenSig(
    env.BETTER_AUTH_SECRET,
    fileTokenMessage(method, key, exp, contentType ?? ''),
  );
  const url = new URL(`${env.PUBLIC_API_URL}/files/${encodedKey}`);
  url.searchParams.set('exp', String(exp));
  url.searchParams.set('sig', sig);
  return { url: url.toString(), headers, expiresAt: new Date(exp * 1000).toISOString() };
}
