# P5-A — Live backend proof (offline-first vertical slice, end-to-end)

The screens run on the **real** backend: local Supabase (Postgres + RLS) behind the
Express sync API. The full offline↔online loop is verified against real infrastructure
on **both** targets (Android emulator + web/OPFS), not mocks.

## What was proven

| Path | Emulator | Web | Verified in Postgres |
|------|----------|-----|----------------------|
| **Pull** (hydrate from `GET /api/sync/:entity`) | ✅ Villa Nord + tasks | ✅ same state | seeded rows |
| **Update** (toggle task done → outbox → `POST /api/sync/mutations`) | ✅ | ✅ sees it | `Støbe fundament = done` |
| **Create** (new project, RLS `owner_id = auth.uid()`) | ✅ | ✅ sees "Nyt projekt 2" | inserted w/ owner |
| **Cross-client** | write on emulator → **read on web** | ✅ | same DB |
| **Conflict** (two writers edit one row) | ✅ detected + parked + resolved | — | keep-mine landed in DB |

### Conflict resolution (two-writer, proven live on the emulator)

A "colleague" edited **Rejse spær** directly in Postgres (new `updated_at`); the app then
marked the same task done against its stale version and synced. The server rejected the
write on optimistic concurrency (`update … where updated_at = baseVersion` → 0 rows), the
outbox parked it with the server's row, and the app surfaced a **Konflikt** banner showing
*Min* vs *Server*. Choosing **Behold min** re-queued the write rebased on the server
version; the next sync applied it and Postgres showed the resolved row (`Rejse spær = done`).

## Integration issues found + fixed while making it real

1. **UUID ids** — row ids are `uuid` PK columns; the app now generates valid UUIDs
   (`newMutationId`, RFC-4122 v4 fallback for Hermes without `crypto.randomUUID`).
2. **RLS on create** — `projects_insert_own` needs `owner_id = auth.uid()`; the app
   stamps `owner_id` (and `scope` for tasks) from the signed-in user id.
3. **Separate live db** — backend mode uses `bygsmart-live` so real keyset cursors
   never inherit the offline seed's fake ids/cursors.
4. **CORS** — the web PWA calls the API cross-origin; the server now sends
   `Access-Control-Allow-*` (bearer is a header, not a cookie, so wildcard is safe in
   dev; tighten via `CORS_ORIGIN` in prod).

## Run it locally (zero-cost)

```bash
# 1. Local Supabase (Docker). Images are cached after the first run.
cd bygsmart-3-native
npx supabase start
npx supabase db reset            # applies the baseline migrations

# 2. Express sync API on :3100, pointed at local Supabase.
eval "$(npx supabase status -o env | sed 's/^/export /')"
export SUPABASE_URL="$API_URL" SUPABASE_ANON_KEY="$ANON_KEY" \
       SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
       SUPABASE_JWT_SECRET="$JWT_SECRET" PORT=3100
( cd server && npx tsx src/index.ts & )

# 3. Seed a demo user + project + tasks and mint a 24h dev token.
#    Prints the EXPO_PUBLIC_SYNC_* env the app reads.
( cd server && node dev-seed.mjs )        # copy its EXPO_PUBLIC_SYNC_* output

# 4a. Native: reverse both ports, start Metro WITH the env, open the app.
adb reverse tcp:8081 tcp:8081 && adb reverse tcp:3100 tcp:3100
cd apps/app
EXPO_PUBLIC_SYNC_URL=... EXPO_PUBLIC_SYNC_USER_ID=... EXPO_PUBLIC_SYNC_TOKEN=... \
  npx expo start --port 8081

# 4b. Web: build WITH the env, then serve.
EXPO_PUBLIC_SYNC_URL=... EXPO_PUBLIC_SYNC_USER_ID=... EXPO_PUBLIC_SYNC_TOKEN=... \
  npx expo export --platform web
npx serve -s dist -l 5055
```

Without the `EXPO_PUBLIC_SYNC_*` vars the app runs **offline-first on the local seed**
(no backend) — the same screens, no server needed.

## Still owner-gated / later phase (not blocking this slice)

- Real **login screens** replace the dev token; the token plumbing is intentionally
  dev-only (`dev-seed.mjs`, `EXPO_PUBLIC_SYNC_*`).
- Provisioning the **hosted** Supabase (free tier is a one-command `supabase db push`).
- Remaining P3b UI folded into screens: **conflict resolution**, **photo/attachment
  media queue**, single-writer **write-gating**.
- Full 23-entity hydration (this slice pulls `projects` + `tasks`).
