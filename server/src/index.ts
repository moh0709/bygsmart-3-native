// @bygsmart/server — Express API, redesigned for sync. Endpoints land in P2 (E2):
// GET /api/sync/:entity (cursor, RLS-applied, tombstones, paged) · POST /api/sync/mutations
// (idempotency keys, dependsOn ordering, baseVersion optimistic concurrency) · three-provider
// push (web VAPID, expo/APNs, expo/FCM). The server is the authority; RLS is the boundary.
export const PLACEHOLDER_SERVER = 'bygsmart-server' as const;
