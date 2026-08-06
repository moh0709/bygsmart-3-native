// The MEDIA UPLOADER — drains the media queue to Supabase Storage. Reads a byte blob
// from the store, ships it through an injected MediaTransport, and on success records
// the reference (onUploaded) then drops the queue entry + its bytes. Pure: no timers, no
// sockets — the app calls uploadOnce()/drainMedia() from the sync loop. Mirrors the
// outbox flusher (backoff retries, dead-letter).
import type { MediaEntry, MediaQueue, MediaStore } from './contract';

/** Ships one object to Storage. api-client implements it over uploadToStorage(). */
export interface MediaTransport {
  upload(bucket: string, path: string, bytes: Uint8Array, contentType: string): Promise<void>;
}

export interface UploadOptions {
  now: () => string;
  store: MediaStore;
  transport: MediaTransport;
  batchSize?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  maxAttempts?: number;
  /** Called after a successful upload — record the reference on the entity (append attachment). */
  onUploaded?: (entry: MediaEntry) => Promise<void>;
}

export interface MediaSummary {
  sent: number;
  uploaded: number;
  failed: number;
  deadLettered: number;
}

export function computeBackoffMs(attempts: number, baseMs: number, maxMs: number): number {
  return Math.min(maxMs, baseMs * 2 ** attempts);
}

const EMPTY: MediaSummary = { sent: 0, uploaded: 0, failed: 0, deadLettered: 0 };

export async function uploadOnce(queue: MediaQueue, opts: UploadOptions): Promise<MediaSummary> {
  const now = opts.now();
  const batchSize = opts.batchSize ?? 3;
  const baseMs = opts.baseDelayMs ?? 1000;
  const maxMs = opts.maxDelayMs ?? 300_000;
  const maxAttempts = opts.maxAttempts ?? 10;

  const batch = await queue.nextBatch(now, batchSize);
  if (batch.length === 0) return { ...EMPTY };

  await queue.markUploading(batch.map((e) => e.id));
  const retryAt = (attempts: number): string =>
    new Date(new Date(now).getTime() + computeBackoffMs(attempts, baseMs, maxMs)).toISOString();

  const summary: MediaSummary = { ...EMPTY, sent: batch.length };
  for (const entry of batch) {
    try {
      const bytes = await opts.store.get(entry.id);
      if (!bytes) {
        // Bytes vanished (store cleared) — nothing to send; drop it.
        await queue.markDone(entry.id);
        continue;
      }
      await opts.transport.upload(entry.bucket, entry.path, bytes, entry.contentType);
      if (opts.onUploaded) await opts.onUploaded(entry);
      await opts.store.remove(entry.id);
      await queue.markDone(entry.id);
      summary.uploaded += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (entry.attempts + 1 >= maxAttempts) {
        await queue.markFailed(entry.id, `dead-lettered: ${message}`, retryAt(maxAttempts));
        summary.deadLettered += 1;
      } else {
        await queue.markFailed(entry.id, message, retryAt(entry.attempts));
        summary.failed += 1;
      }
    }
  }
  return summary;
}

export async function drainMedia(
  queue: MediaQueue,
  opts: UploadOptions & { maxPasses?: number },
): Promise<MediaSummary> {
  const maxPasses = opts.maxPasses ?? 100;
  const total: MediaSummary = { ...EMPTY };
  for (let pass = 0; pass < maxPasses; pass++) {
    const s = await uploadOnce(queue, opts);
    total.sent += s.sent;
    total.uploaded += s.uploaded;
    total.failed += s.failed;
    total.deadLettered += s.deadLettered;
    if (s.sent === 0 || s.uploaded === 0) break; // stop when nothing progressed
  }
  return total;
}
