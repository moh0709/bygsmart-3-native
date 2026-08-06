// Minimal OPFS (Origin Private File System) byte storage for the web runtime — used
// to persist the wasm-SQLite database file across reloads. Uses the async OPFS API on
// the main thread (no worker, no COOP/COEP), and is typed with a local shim so the
// app needn't pull in the DOM lib. On native these APIs are absent → opfsAvailable() false.
interface OpfsFile {
  arrayBuffer(): Promise<ArrayBuffer>;
}
interface OpfsWritable {
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
}
interface OpfsFileHandle {
  getFile(): Promise<OpfsFile>;
  createWritable(): Promise<OpfsWritable>;
}
interface OpfsDir {
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<OpfsFileHandle>;
  removeEntry?(name: string): Promise<void>;
}
interface StorageLike {
  getDirectory?(): Promise<OpfsDir>;
}

function storage(): StorageLike | undefined {
  return (globalThis as { navigator?: { storage?: StorageLike } }).navigator?.storage;
}

export function opfsAvailable(): boolean {
  return typeof storage()?.getDirectory === 'function';
}

export async function opfsReadBytes(name: string): Promise<Uint8Array | null> {
  const s = storage();
  if (!s?.getDirectory) return null;
  try {
    const root = await s.getDirectory();
    const handle = await root.getFileHandle(name);
    const file = await handle.getFile();
    return new Uint8Array(await file.arrayBuffer());
  } catch {
    return null; // not present yet
  }
}

export async function opfsWriteBytes(name: string, bytes: Uint8Array): Promise<void> {
  const s = storage();
  if (!s?.getDirectory) return;
  const root = await s.getDirectory();
  const handle = await root.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(bytes);
  await writable.close();
}

export async function opfsRemove(name: string): Promise<void> {
  const s = storage();
  if (!s?.getDirectory) return;
  try {
    const root = await s.getDirectory();
    await root.removeEntry?.(name);
  } catch {
    /* already gone */
  }
}
