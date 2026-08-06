// Sync configuration from the environment. EXPO_PUBLIC_SYNC_URL points at the Express
// sync API; when set (Metro inlines EXPO_PUBLIC_* at build) the app runs in backend
// mode, otherwise offline-first on the local seed. The user's TOKEN and id are no longer
// env vars — they come from the live auth session (see AuthProvider). Real login
// replaced the dev-token plumbing.
export function readSyncBaseUrl(): string | null {
  return process.env.EXPO_PUBLIC_SYNC_URL ?? null;
}

/** Entities the current screens pull. Full 23-entity hydration comes with more screens. */
export const SYNC_ENTITIES = ['projects', 'tasks'];
