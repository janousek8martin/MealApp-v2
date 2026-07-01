/**
 * App-generated UUIDs keep the data model sync-ready (no autoincrement ids).
 * Node/Jest provide crypto.randomUUID natively; on device we fall back to
 * expo-crypto, required lazily so tests never touch native modules.
 */
export function newId(): string {
  const webCrypto = globalThis.crypto;
  if (webCrypto?.randomUUID) {
    return webCrypto.randomUUID();
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const expoCrypto = require('expo-crypto') as typeof import('expo-crypto');
  return expoCrypto.randomUUID();
}
