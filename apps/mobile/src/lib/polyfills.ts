import { getRandomValues } from 'expo-crypto';

interface CryptoGlobal {
  crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array };
}

/** Shared ULID/invite helpers need crypto.getRandomValues, which Hermes may not provide. */
const g = globalThis as unknown as CryptoGlobal;
if (!g.crypto?.getRandomValues) {
  g.crypto = {
    ...g.crypto,
    getRandomValues: (array: Uint8Array) => getRandomValues(array),
  };
}
