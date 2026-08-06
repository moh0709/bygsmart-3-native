// Web byte store — OPFS. Attachment bytes survive reloads. Kept out of the native
// bundle by the .ts/.web.ts split.
import type { MediaStore } from './contract';
import { opfsReadBytes, opfsWriteBytes, opfsRemove } from '../opfs/opfs';

const file = (key: string): string => `media-${key}.bin`;

export function createMediaStore(): MediaStore {
  return {
    put: (key, bytes) => opfsWriteBytes(file(key), bytes),
    get: (key) => opfsReadBytes(file(key)),
    remove: (key) => opfsRemove(file(key)),
  };
}
