// Native byte store — expo-file-system (documentDirectory). Bytes are base64-bridged
// (the classic FS API is string-based). Kept out of the web bundle by the .ts/.web.ts
// split. Bytes survive an app kill.
import * as FileSystem from 'expo-file-system/legacy';
import type { MediaStore } from './contract';

const DIR = `${FileSystem.documentDirectory ?? ''}media/`;
const path = (key: string): string => `${DIR}${key}.bin`;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    out += B64[a >> 2]! + B64[((a & 3) << 4) | (b >> 4)]!;
    out += i + 1 < bytes.length ? B64[((b & 15) << 2) | (c >> 6)]! : '=';
    out += i + 2 < bytes.length ? B64[c & 63]! : '=';
  }
  return out;
}

function fromBase64(str: string): Uint8Array {
  const clean = str.replace(/[^A-Za-z0-9+/]/g, '');
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]!) << 18) | (B64.indexOf(clean[i + 1]!) << 12) |
      (B64.indexOf(clean[i + 2] ?? 'A') << 6) | B64.indexOf(clean[i + 3] ?? 'A');
    out.push((n >> 16) & 0xff);
    if (clean[i + 2] !== undefined) out.push((n >> 8) & 0xff);
    if (clean[i + 3] !== undefined) out.push(n & 0xff);
  }
  return new Uint8Array(out);
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
}

export function createMediaStore(): MediaStore {
  return {
    put: async (key, bytes) => {
      await ensureDir();
      await FileSystem.writeAsStringAsync(path(key), toBase64(bytes), { encoding: FileSystem.EncodingType.Base64 });
    },
    get: async (key) => {
      try {
        const s = await FileSystem.readAsStringAsync(path(key), { encoding: FileSystem.EncodingType.Base64 });
        return fromBase64(s);
      } catch {
        return null;
      }
    },
    remove: async (key) => {
      await FileSystem.deleteAsync(path(key), { idempotent: true });
    },
  };
}
