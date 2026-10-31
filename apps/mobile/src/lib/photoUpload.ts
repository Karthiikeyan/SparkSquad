import { HARD_CAPS } from '@sparksquad/shared';
import type * as FileSystemModule from 'expo-file-system';
import type * as ManipulatorModule from 'expo-image-manipulator';
import { endpoints } from './api/endpoints';
import { isApiError } from './api/errors';

type FileSystem = typeof FileSystemModule;
type Manipulator = typeof ManipulatorModule;

export interface PreparedPhoto {
  uri: string;
  size: number;
}

export interface PhotoUploadDeps {
  /** Shrinks the image to a JPEG within the upload cap; null if the file is gone. */
  compress: (uri: string) => Promise<PreparedPhoto | null>;
  presign: typeof endpoints.proofUpload;
  put: (fileUri: string, url: string, headers: Record<string, string>) => Promise<number>;
}

/** Architecture §5.5: max 1080 px, about 100 KB; never above the 300 KB hard cap. */
const TARGET_BYTES = 120_000;
const ATTEMPTS: readonly { width: number; compress: number }[] = [
  { width: 1080, compress: 0.6 },
  { width: 1080, compress: 0.45 },
  { width: 900, compress: 0.4 },
  { width: 720, compress: 0.35 },
];

async function nativeCompress(uri: string): Promise<PreparedPhoto | null> {
  /* eslint-disable @typescript-eslint/no-require-imports -- lazy native modules */
  const { ImageManipulator, SaveFormat } = require('expo-image-manipulator') as Manipulator;
  const { File } = require('expo-file-system') as FileSystem;
  /* eslint-enable @typescript-eslint/no-require-imports */
  if (!new File(uri).exists) return null;
  let best: PreparedPhoto | null = null;
  for (const a of ATTEMPTS) {
    const ref = await ImageManipulator.manipulate(uri).resize({ width: a.width }).renderAsync();
    const out = await ref.saveAsync({ compress: a.compress, format: SaveFormat.JPEG });
    const size = new File(out.uri).size;
    if (size > 0 && size <= HARD_CAPS.uploadMaxBytes && (!best || size < best.size)) {
      best = { uri: out.uri, size };
    }
    if (best && best.size <= TARGET_BYTES) break;
  }
  return best;
}

async function nativePut(fileUri: string, url: string, headers: Record<string, string>) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy native module
  const { File } = require('expo-file-system') as FileSystem;
  const res = await new File(fileUri).upload(url, {
    httpMethod: 'PUT',
    headers: { 'Content-Type': 'image/jpeg', ...headers },
  });
  return res.status;
}

const defaultDeps: PhotoUploadDeps = {
  compress: nativeCompress,
  presign: (...args) => endpoints.proofUpload(...args),
  put: nativePut,
};

/**
 * Uploads a shared proof photo and returns its storage key, or null when it can't be shared
 * (no longer Plus, file gone, too large). Network trouble throws so the outbox retries.
 */
export async function uploadProof(
  checkinId: string,
  uri: string,
  deps: PhotoUploadDeps = defaultDeps,
): Promise<string | null> {
  const photo = await deps.compress(uri);
  if (!photo) return null;
  let signed;
  try {
    signed = await deps.presign(checkinId, 'image/jpeg', photo.size);
  } catch (e) {
    // Plan lapsed or bad input: keep the check-in, the photo stays on the phone.
    if (isApiError(e) && e.status >= 400 && e.status < 500 && e.status !== 429) return null;
    throw e;
  }
  const status = await deps.put(photo.uri, signed.url, signed.headers);
  if (status < 200 || status >= 300) throw new Error(`Photo upload failed (${status})`);
  return signed.key;
}
