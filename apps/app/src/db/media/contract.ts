// The MEDIA pipeline (P3b) — the offline path for binary attachments (photos/docs).
// Mirrors the outbox, but for bytes: a durable QUEUE of pending uploads (metadata) plus
// a byte STORE that holds the file contents until they reach Supabase Storage. A photo
// taken offline is stored locally + queued, then uploaded (in order, with retries) when
// back online. Keeping bytes out of the queue means the queue stays a small, swappable
// metadata store (in-memory / SQLite) while the bytes live in a platform byte store
// (native file system / web OPFS).

export type MediaStatus = 'pending' | 'uploading' | 'failed' | 'done';

/** A queued upload in the shape the uploader needs. Bytes are keyed by `id` in the store. */
export interface MediaUpload {
  /** Client-generated id — also the byte-store key. */
  id: string;
  /** Storage bucket (e.g. 'task-docs'). */
  bucket: string;
  /** Object path; must satisfy the bucket RLS (task-docs: `<projectId>/<taskId>/<file>`). */
  path: string;
  contentType: string;
  size: number;
  /** What the file is attached to (for recording the reference after upload). */
  entity: string;
  entityId: string;
}

export interface MediaEntry extends MediaUpload {
  seq: number;
  status: MediaStatus;
  attempts: number;
  nextAttemptAt: string | null;
  lastError?: string;
  enqueuedAt: string;
}

/** Storage-only queue (no networking) — one shared suite proves every runtime. */
export interface MediaQueue {
  enqueue(upload: MediaUpload): Promise<MediaEntry>;
  all(): Promise<MediaEntry[]>;
  get(id: string): Promise<MediaEntry | null>;
  /** Count still owed to Storage (everything not yet done). */
  pendingCount(): Promise<number>;
  /** Eligible uploads in FIFO order: pending, or failed past its backoff window. */
  nextBatch(now: string, limit: number): Promise<MediaEntry[]>;
  markUploading(ids: string[]): Promise<void>;
  /** Uploaded — drop it from the queue. */
  markDone(id: string): Promise<void>;
  markFailed(id: string, error: string, nextAttemptAt: string): Promise<void>;
}

/** The byte store the queue's file contents live in (platform-split: FS native / OPFS web). */
export interface MediaStore {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  remove(key: string): Promise<void>;
}
