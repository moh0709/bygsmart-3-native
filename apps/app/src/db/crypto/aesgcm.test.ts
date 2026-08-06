import { describe, it, expect } from 'vitest';
import { generateKey, encryptBytes, decryptBytes } from './aesgcm';

const bytes = (s: string) => new TextEncoder().encode(s);

describe('AES-256-GCM at-rest encryption', () => {
  it('generates a 256-bit key', async () => {
    expect((await generateKey()).length).toBe(32);
  });

  it('round-trips plaintext', async () => {
    const key = await generateKey();
    const plain = bytes('CREATE TABLE rows(...); -- a local db snapshot');
    const blob = await encryptBytes(key, plain);
    expect(blob).not.toEqual(plain); // actually encrypted
    expect(new TextDecoder().decode(await decryptBytes(key, blob))).toBe(
      'CREATE TABLE rows(...); -- a local db snapshot',
    );
  });

  it('uses a fresh IV each time (ciphertexts differ)', async () => {
    const key = await generateKey();
    const p = bytes('same input');
    const a = await encryptBytes(key, p);
    const b = await encryptBytes(key, p);
    expect(Buffer.from(a).toString('hex')).not.toBe(Buffer.from(b).toString('hex'));
  });

  it('rejects a tampered blob (GCM authentication)', async () => {
    const key = await generateKey();
    const blob = await encryptBytes(key, bytes('secret'));
    blob[blob.length - 1] ^= 0xff; // flip a ciphertext byte
    await expect(decryptBytes(key, blob)).rejects.toBeTruthy();
  });

  it('rejects the wrong key', async () => {
    const blob = await encryptBytes(await generateKey(), bytes('secret'));
    await expect(decryptBytes(await generateKey(), blob)).rejects.toBeTruthy();
  });
});
