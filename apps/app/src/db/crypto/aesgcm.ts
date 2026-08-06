// AES-256-GCM for encrypting the local database at rest (P3a 3a.1). Built on WebCrypto
// (crypto.subtle) — present on web and in node; native supplies it via a polyfill. The
// key lives in the platform keystore (expo-secure-store on native), never beside the
// data. GCM is authenticated: a tampered or wrong-key blob fails to decrypt rather than
// returning garbage — which is exactly the signal the corruption-quarantine path needs.
const IV_BYTES = 12;

// A loose local view of crypto.subtle so this platform-shim code doesn't depend on
// the DOM lib and sidesteps TS 6's Uint8Array<ArrayBuffer> generic strictness.
interface SubtleLike {
  generateKey(algo: { name: string; length: number }, extractable: boolean, usages: string[]): Promise<unknown>;
  exportKey(format: 'raw', key: unknown): Promise<ArrayBuffer>;
  importKey(format: 'raw', key: Uint8Array, algo: string, extractable: boolean, usages: string[]): Promise<unknown>;
  encrypt(algo: { name: string; iv: Uint8Array }, key: unknown, data: Uint8Array): Promise<ArrayBuffer>;
  decrypt(algo: { name: string; iv: Uint8Array }, key: unknown, data: Uint8Array): Promise<ArrayBuffer>;
}

function subtle(): SubtleLike {
  const s = (globalThis as { crypto?: { subtle?: unknown } }).crypto?.subtle;
  if (!s) throw new Error('WebCrypto subtle unavailable');
  return s as SubtleLike;
}

function randomBytes(n: number): Uint8Array {
  return (globalThis as { crypto: { getRandomValues(a: Uint8Array): Uint8Array } }).crypto.getRandomValues(
    new Uint8Array(n),
  );
}

/** A fresh 256-bit key (raw bytes) to stash in the platform keystore. */
export async function generateKey(): Promise<Uint8Array> {
  const key = await subtle().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  return new Uint8Array(await subtle().exportKey('raw', key));
}

/** Encrypt; the random IV is prepended to the ciphertext. */
export async function encryptBytes(keyBytes: Uint8Array, plain: Uint8Array): Promise<Uint8Array> {
  const key = await subtle().importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
  const iv = randomBytes(IV_BYTES);
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, key, plain));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return out;
}

/** Decrypt; throws if the blob was tampered with or the key is wrong (GCM auth). */
export async function decryptBytes(keyBytes: Uint8Array, blob: Uint8Array): Promise<Uint8Array> {
  const key = await subtle().importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
  const iv = blob.subarray(0, IV_BYTES);
  const ct = blob.subarray(IV_BYTES);
  return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv }, key, ct));
}
