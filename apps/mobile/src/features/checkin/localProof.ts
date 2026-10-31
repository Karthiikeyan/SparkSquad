import { Directory, File, Paths } from 'expo-file-system';
import { getKeyed, removeKeyed, setKeyed } from '../../lib/prefs';

/**
 * Free plan photo proof stays on the phone (Product Spec §3): the picked image is copied
 * into app storage and only `hasPhoto` reaches the server.
 */
function proofsDir(): Directory {
  const dir = new Directory(Paths.document, 'proofs');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

const keyOf = (challengeId: string, date: string) => `${challengeId}:${date}`;

export async function saveLocalProof(
  challengeId: string,
  date: string,
  sourceUri: string,
): Promise<string> {
  const ext = sourceUri.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
  const dest = new File(proofsDir(), `${challengeId}-${date}-${Date.now()}.${ext}`);
  await new File(sourceUri).copy(dest);
  const previous = localProofUri(challengeId, date);
  if (previous) deleteFile(previous);
  setKeyed('photo', keyOf(challengeId, date), dest.uri);
  return dest.uri;
}

export function localProofUri(challengeId: string, date: string): string | null {
  return getKeyed<string>('photo', keyOf(challengeId, date)) ?? null;
}

export function removeLocalProof(challengeId: string, date: string): void {
  const uri = localProofUri(challengeId, date);
  if (uri) deleteFile(uri);
  removeKeyed('photo', keyOf(challengeId, date));
}

function deleteFile(uri: string): void {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Already gone.
  }
}

/** Deletes every locally kept proof photo (sign-out / account switch). */
export function clearAllLocalProofs(): void {
  try {
    const dir = new Directory(Paths.document, 'proofs');
    if (dir.exists) dir.delete();
  } catch {
    // Nothing stored yet.
  }
}
