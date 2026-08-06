// Sync configuration from the environment. When all three EXPO_PUBLIC_SYNC_* vars are
// present (Metro inlines EXPO_PUBLIC_* at build), the app talks to the real backend
// (HTTP pull + flush); otherwise it runs offline-first on the local seed. The token is
// supplied at runtime — never baked into the repo — and real login screens replace this
// dev plumbing in a later phase.
export interface SyncConfig {
  /** API origin incl. /api, e.g. http://127.0.0.1:3100/api. */
  baseUrl: string;
  /** Bearer token for the current user (dev: a locally-minted JWT). */
  token: string;
  /** The authenticated user's id (JWT sub) — needed to stamp owner_id on creates. */
  userId: string;
}

export function readSyncConfig(): SyncConfig | null {
  const baseUrl = process.env.EXPO_PUBLIC_SYNC_URL;
  const token = process.env.EXPO_PUBLIC_SYNC_TOKEN;
  const userId = process.env.EXPO_PUBLIC_SYNC_USER_ID;
  if (baseUrl && token && userId) return { baseUrl, token, userId };
  return null;
}

/** Entities the current screens pull. Full 23-entity hydration comes with more screens. */
export const SYNC_ENTITIES = ['projects', 'tasks'];
