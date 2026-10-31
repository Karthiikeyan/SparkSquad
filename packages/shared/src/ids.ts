const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function randomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  // globalThis.crypto exists in Workers, Node 20+, and React Native with expo-crypto's polyfill.
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

/** ULID: 48-bit ms timestamp + 80 bits of randomness, Crockford base32, 26 chars. */
export function ulid(now: number = Date.now()): string {
  let time = now;
  let timePart = '';
  for (let i = 0; i < 10; i++) {
    timePart = CROCKFORD[time % 32] + timePart;
    time = Math.floor(time / 32);
  }
  const rand = randomBytes(16);
  let randPart = '';
  for (let i = 0; i < 16; i++) {
    randPart += CROCKFORD[rand[i]! % 32];
  }
  return timePart + randPart;
}

export function isUlid(value: string): boolean {
  return /^[0-9A-HJKMNP-TV-Z]{26}$/.test(value);
}

/** Invite codes avoid look-alike characters (0/O, 1/I/L). */
const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function inviteCode(length = 6): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += INVITE_ALPHABET[bytes[i]! % INVITE_ALPHABET.length];
  return out;
}

export function normalizeInviteCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function isInviteCode(value: string): boolean {
  return /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/.test(value);
}
