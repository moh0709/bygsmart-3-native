// Supabase Storage access. Uploads run through the authed client, so bucket RLS (the
// task-docs policies scope by <projectId>/<taskId>/… path) is the authorisation
// boundary — this never invents authorisation. The offline media queue (db/media) is
// what makes uploads durable + retried; these are the raw one-shot calls it drives.
import type { SupabaseClient } from '@supabase/supabase-js';

export async function uploadToStorage(
  client: SupabaseClient,
  bucket: string,
  path: string,
  bytes: Uint8Array | ArrayBuffer | Blob,
  contentType: string,
): Promise<void> {
  const { error } = await client.storage.from(bucket).upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(error.message);
}

/** A short-lived signed URL to display a private object (RLS-checked). */
export async function signedUrl(
  client: SupabaseClient,
  bucket: string,
  path: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  return error ? null : (data?.signedUrl ?? null);
}
