# BygSmart 3.0 Native — Sync Design Document

## Part 6 (v0.1 · draft for two-engineer review) — the client/engine side of offline sync

**Status:** P0 deliverable · Build Plan §11 item 8 · **hard G0 exit criterion**
**Date:** 4 August 2026 · **Owner:** Moh · **Author role:** Architect (Winston)
**Scope:** CLIENT / ENGINE side. The Postgres schema and the server sync endpoints are
designed separately (PRD epic E2, Build Plan P2); this document *references* them and
*does not redefine tables*.

> **What this document is.** Audit `01_AUDIT_MOBILE_FORK.md` §7 called itself "the
> skeleton" of the sync design document and said explicitly it "is not a substitute
> for the sync design document — it is its skeleton." This is that document. It
> carries §7 forward verbatim where §7 decided something, cites it when it does, and
> fleshes out the parts §7 left open. Where §7 was written before the tri-target
> decision (§7 is native-only), the three-runtime reality is supplied from
> `05_PLAN_HARDENING_REVIEW.md` S1/S8 and PRD §6.

> **Governing precedence.** `03_BUILD_PLAN.md` v4.1 governs. Audit **§8 and §11 are
> void** (no users) and are not cited here. Where the audit and the later documents
> disagree, the later documents win; every such case is called out in §13.

---

## 0. Contents

1. Principles this design serves, and the failure it exists to prevent
2. Sync metadata model — the per-row contract
3. Delta pull — cursor, paging, tombstones, hydration budget · `GET /api/sync/:entity`
4. Outbox — durable, ordered, dependency-aware, idempotent · `POST /api/sync/mutations`
5. Retry mechanics — backoff, per-status policy, poison, session refresh
6. Media queue — capture-to-disk, downscale, background upload, reconcile-on-launch
7. Conflict engine — per-entity policy
8. The repository contract — one interface, three runtimes, AR-05 enforcement
9. Three-runtime storage — native SQLite ×2, wasm/OPFS, graded web tiers, single-writer election
10. Session & grace model — 14-day native / 72-hour web / 72-hour entitlement TTL
11. Client sync telemetry heartbeat
12. Buy-vs-build surface map (D-11) — what a bought engine supplies vs. what stays bespoke
13. Contradictions between governing documents
14. Places audit §7 was silent — calls made here, flagged for human review
15. How this design is tested (Build Plan §5 layers 4, 5, 6, 6b)

Every numbered subsection states, in order: **the decision**, **the rationale**, and
**the failure mode it prevents** — the format the task requires.

---

## 1. Principles this design serves

The design is downstream of four things it may not contradict:

- **PRD P1** — *offline is the substrate, not a feature.* Every field flow in PRD §6.2
  completes with the radio off; where a runtime cannot guarantee that, the app says so.
- **PRD P3** — *the app never lies about state.* Pending / syncing / synced / failed are
  always visible; **the app refuses work it cannot durably hold** rather than pretending.
  This single principle decides the Online-only web tier (§9) and the poison/park
  behaviour (§5).
- **PRD P4** — *same rules, one place.* The **server is the authority**; the client never
  invents authorisation (RLS is the sole boundary — PRD §9.4).
- **AR-05** — *no screen may import a sync-engine type directly.* This is why the whole
  thing is swappable in a week (§8), and it is the reason D-11 (buy vs build) can stay
  open without blocking screen work.

**The failure this whole subsystem exists to prevent:** a tradesperson does a full day's
work in a basement with no signal, and one record — a photo, a check-out, a punch item —
is silently lost. PRD G-1 and success metric "outbox items ending in unresolved failure
< 0.1 %" make *zero unrecoverable loss on a functional device* the bar. Device loss,
theft and browser eviction are accepted, disclosed risks (PRD §9.2); everything else is a
defect.

---

## 2. Sync metadata model — the per-row contract

**Decision.** Every mirrored ("synced") local table carries the sync-metadata columns
defined in audit §7.3, carried forward verbatim:

```sql
-- applied to every synced local table (from audit §7.3)
_local_id        TEXT PRIMARY KEY,   -- client UUIDv7, generated at row creation
id               TEXT,               -- server uuid, NULL until first successful push
_dirty           INTEGER NOT NULL DEFAULT 0,   -- 1 = has unsynced local changes
_deleted         INTEGER NOT NULL DEFAULT 0,   -- 1 = local tombstone
_server_version  TEXT,               -- server updated_at at last successful pull
_synced_at       INTEGER,            -- epoch ms of last successful sync of this row
_conflict        TEXT                -- NULL | 'pending' | serialized rival row (JSON)
```

Two clarifications this document adds on top of §7.3, because the outbox and the puller
both depend on them being unambiguous:

- **`_local_id` is the stable identity; `id` is a late-bound alias.** A row is created
  offline with a client UUIDv7 as `_local_id` and `id = NULL`. On first successful push
  the server assigns (or confirms) `id`; the client stores it but **never repoints its
  primary key or its foreign keys**. All local FKs reference `_local_id`, never `id`.
  This is what makes `dependsOn` (§4) resolvable before any server id exists.
- **`base_version` for optimistic concurrency is derived, not stored separately.** The
  `baseVersion` sent with a mutation (§4) is the `_server_version` the row held at the
  moment the mutation was enqueued — captured into the outbox row, not read live at
  replay time. A live read would defeat the point (it would always look current).

**UUIDv7, not v4** (this is a call §7.3 implies with "UUIDv7" but does not justify): v7 is
time-ordered, so `_local_id` doubles as a coarse creation-order key, insert locality is
good, and it sorts sensibly in the outbox. The randomness budget is still collision-safe
across devices.

**Type mapping** (carried verbatim from audit §7.3 — this is load-bearing and must not
drift): Postgres `uuid` → `TEXT`; `timestamptz` → `INTEGER` epoch-ms UTC (**never a
string** — the cursor arithmetic in §3 depends on integer comparison); `jsonb` → `TEXT`
with a Zod parse at the repository boundary; `numeric` → `TEXT` (**never `REAL`** — money
and quantities); `boolean` → `INTEGER`.

**Rationale.** Sync metadata *per row* rather than a side journal means the read path,
the outbox and conflict state are all answerable by indexing the row itself. `(_dirty)`
and `(_server_version)` indexes (audit §7.3) make "what is pending" and "what is the pull
cursor position" O(index) rather than table scans — which matters on a Samsung A54 with a
90-day database near the 200 MB PRD §9.1 budget.

**Failure mode prevented.** Without a client-owned stable id, a row created offline has no
identity until the server grants one — so a photo attached to a not-yet-synced task has
nothing to point at, and replay ordering collapses. Without integer epoch-ms timestamps,
the `(updated_at, id)` cursor silently mis-orders across string/number coercion and drops
rows. Both are correctness bugs that surface only under offline authoring — i.e. exactly
where there is no network round-trip to paper over them.

---

## 3. Delta pull — cursor, paging, tombstones, hydration

### 3.1 The pull contract — `GET /api/sync/:entity`

**Decision.** Carried forward verbatim from audit §7.4:

```
GET /api/sync/:entity?since=<cursor>&limit=500
Authorization: Bearer <jwt>

200 {
  "entity":     "tasks",
  "rows":       [ { ...row, updated_at, deleted_at } ],
  "cursor":     "1785712345678:9f3c...",   -- (updated_at_epoch_ms, id) — monotonic
  "hasMore":    true,
  "serverTime": 1785712400000
}
```

- **The cursor is the pair `(updated_at, id)`, not `updated_at` alone.** Ties on
  `updated_at` are common (bulk writes, trigger cascades) and a timestamp-only cursor
  silently drops every row that shares a millisecond with the last row of a page. The
  client treats the cursor as **opaque** (it does not parse it); the string form
  `"<epoch_ms>:<id>"` is a server implementation detail the client only echoes back.
- **The server applies RLS** (PRD S-02, P4). The client asks only for what it can already
  see; there is no client-side filtering to trust. A row that leaves the user's RLS scope
  (project access revoked, seat removed) is delivered as a **tombstone** (below), not
  simply omitted — omission would leave it resident on the device forever.

### 3.2 Paging and the puller loop

**Decision.** Page size `limit=500` rows (audit §7.4's value, kept). The puller loops
per entity: `GET ?since=<lastCursor>` until `hasMore=false`, applying each page
transactionally before advancing the stored cursor. The cursor is persisted **after** the
page is committed, so a crash mid-pull re-fetches the last page rather than skipping it —
pulls are idempotent by construction because applying a row is an upsert keyed on `id`.

**Pull triggers** (PRD S-03): app foreground, network regain, pull-to-refresh, and a
background schedule. Realtime (`postgres_changes`) is an **accelerator, not the
authority** (audit R8): a Realtime event schedules a delta pull of the affected entity;
it never writes to the local DB directly. This keeps one code path for correctness and
makes a missed socket event a latency issue, not a data-loss issue.

**Entity pull order at hydration** respects referential dependency so foreign keys resolve
as they land: `orgs` → `profiles` → `org_module_entitlements` → `projects` →
`project_resources` / `task_access` → `tasks` / `quick_tasks` → children
(`task_check_ins`, `task_documentation`, `task_chat_messages`, `task_chat_reads`,
`punch_list_items`, `task_quality_control`, `time_registrations`) → `documents`
(metadata only). Mirrored entity set is audit §7.3's R1 list; `media_queue` is
local-only and never pulled.

### 3.3 Tombstone application

**Decision.** Tombstones are **mandatory** (audit §7.4 — "entirely absent from v1.0").
A pulled row carrying a non-null `deleted_at` is applied by setting `_deleted = 1`
locally and cascading the local-only consequences (drop it from list queries, release any
marked-for-offline media). The server soft-deletes with a retention window **at least as
long as the offline grace** (§10) — i.e. ≥ 14 days — so a 14-day-offline device is
guaranteed to still find the tombstone on reconnect (PRD E2 AC④).

**Rationale & failure mode prevented.** Without tombstones, a deleted task or a revoked
project access persists on the device forever: a correctness bug *and* an RLS leak (the
device shows tenant data the user is no longer entitled to). Tombstones are also the only
channel by which a **GDPR erasure** reaches a device (audit §7.5) — hard deletes are
structurally invisible to an offline client (Build Plan §2).

### 3.4 Initial hydration and its budget

**Decision.** First sign-in pulls the user's entire RLS scope in paged batches with
visible progress, **over Wi-Fi by default** (audit §7.3). This document sets the two
numbers §7.3 explicitly deferred to it ("Specify the page size and the maximum acceptable
first-sync duration"):

- **Page size:** 500 rows/entity (as §3.2).
- **Budget:** **≤ 60 s to interactive on a typical scope over 4G**, where "typical scope"
  = one active org, ≤ 25 projects, ≤ 2 000 tasks and their children, **metadata only**
  (media and the knowledge corpus are *not* part of first hydration — they stream lazily
  and on-demand, PRD K-02/D-03). Hydration is **resumable**: it advances per-entity
  cursors as it goes, so a dropped connection continues rather than restarts.
- **Progressive unlock:** the app becomes usable as soon as `orgs`, `profiles`,
  `entitlements`, `projects` and `tasks` have landed; children hydrate in the background
  behind a non-blocking progress indicator. This is what makes the 60 s a "to interactive"
  budget rather than a "to complete" one.

> **⚑ Flag for human review (§14-A).** The ≤ 60 s / 4G / "typical scope" budget and the
> 500-row page size are *this document's* calls — audit §7.3 explicitly left them open.
> They should be validated against the real P0 baseline schema row counts and against the
> tri-target spike's measured throughput before G0 sign-off. If a real org's scope blows
> the budget, the fix is scope-narrowing the initial pull (e.g. only *active* projects),
> not raising the number.

**Failure mode prevented.** First sync is the first impression the app makes (audit §7.3);
an unbounded or non-resumable hydration on 4G in a van is an abandonment event. A stated,
resumable, progressively-unlocking budget makes "it's still loading" a measurable defect
rather than a vibe.

---

## 4. Outbox — durable, ordered, dependency-aware, idempotent

### 4.1 The push contract — `POST /api/sync/mutations`

**Decision.** Carried forward verbatim from audit §7.4:

```
POST /api/sync/mutations
Idempotency-Key: <client uuid, unique per mutation>

{ "mutations": [
    { "id":"<uuid>", "entity":"tasks", "op":"update",
      "localId":"<uuid>", "serverId":"<uuid|null>",
      "baseVersion":"<server updated_at at read time>",
      "payload":{...}, "createdAt":1785712000000, "dependsOn":["<uuid>"] }
]}

200 { "results":[ { "id":"<uuid>", "status":"applied|conflict|rejected",
                    "serverId":"...", "serverRow":{...}, "reason":"..." } ] }
```

- **Idempotency key = the mutation's client UUID**, one per mutation, sent as both the
  `Idempotency-Key` header (batch-level dedupe hint) and each mutation's `id`
  (row-level). The server stores keys with a **TTL ≥ the offline grace window** (audit
  §7.4) — concretely **14 days** (§10), so a mutation authored on day 0 and replayed on
  day 13 is still deduplicated. Replay of an already-applied mutation returns its prior
  result, not a second row.
- **`dependsOn`** makes ordering explicit: a photo attached to an offline-created task
  lists that task's mutation id in `dependsOn`, so it replays after it (PRD S-05).
- **`baseVersion`** is the `_server_version` captured at enqueue (§2), enabling
  server-side optimistic concurrency — the server can detect the client read was stale
  and return `conflict` (§7).

### 4.2 Durability and ordering

**Decision.** The outbox is a **local SQLite table**, written in the *same transaction* as
the local row mutation it represents. There is no in-memory queue that a mutation passes
through first — the durable write *is* the enqueue. Fields:

```
outbox(
  id           TEXT PRIMARY KEY,   -- client UUID = idempotency key
  entity       TEXT NOT NULL,
  op           TEXT NOT NULL,      -- 'insert' | 'update' | 'delete'
  local_id     TEXT NOT NULL,      -- FK to the local row's _local_id
  server_id    TEXT,               -- NULL until the row has a server id
  base_version TEXT,               -- optimistic-concurrency token (§2)
  payload      TEXT NOT NULL,      -- JSON, Zod-validated at boundary
  depends_on   TEXT,               -- JSON array of outbox ids
  created_at   INTEGER NOT NULL,   -- epoch ms, authoring time
  seq          INTEGER NOT NULL,   -- monotonic per-device enqueue order
  attempts     INTEGER NOT NULL DEFAULT 0,
  next_at      INTEGER,            -- epoch ms, earliest next attempt (§5)
  state        TEXT NOT NULL       -- 'pending'|'inflight'|'needs-attention'|'rejected'|'poison'|'conflict'
)
```

- **Replay order:** topological over `depends_on`, then by `seq` (FIFO within a
  dependency level). A mutation whose dependencies are not all `applied` is not sent.
- **Batching:** the replayer sends dependency-closed mutations in `seq` order, up to a
  batch size cap; the server returns a per-mutation result array so a partial failure
  parks only the failed items, not the batch.

### 4.3 Survives force-quit, reboot, tab close

**Decision.** Because enqueue is a durable SQLite write co-transacted with the data
mutation, the outbox survives process death by construction — there is no "flush on
background" step that could be skipped. On **every launch** the engine runs a
**reconcile sweep** (see §6 for the media half): it re-reads the outbox, resets any
`inflight` rows left dangling by a crash back to `pending` (safe — the server dedupes on
the idempotency key), and resumes the replayer.

**On web**, "survives tab close" holds only in the **Full** and **Session-durable** tiers
(OPFS-backed); in **Online-only** the app *refuses to enqueue at all* (§9), which is the
honest behaviour, not a durability failure.

**Failure mode prevented.** The classic offline-app bug: a mutation lives in memory,
"sync on background" races the OS killing the app, and the write is lost with no trace.
Co-transacting the enqueue with the data write makes the mutation as durable as the data
it describes — you cannot have one without the other.

---

## 5. Retry mechanics

**Decision.** Carried forward from audit §7.4, made concrete:

**Backoff schedule** (per outbox item, driven by `next_at`): **2 s → 8 s → 30 s → 2 m →
10 m → 1 h**, then capped at 1 h. Full jitter (±20 %) is applied to avoid a thundering
herd when a whole crew regains signal at the same site gate. Attempts are **unlimited
while the item stays valid** — a transient server outage must never cause discard.

**Per-status policy** (verbatim from audit §7.4, plus the session-refresh detail the task
asks for):

| Server response | Action |
|---|---|
| `5xx`, network error, timeout | Retry on the backoff schedule. Unlimited while valid. |
| `401` | **Refresh the Supabase session, retry once.** On refresh failure, **park the whole outbox** and prompt for sign-in — never discard. The 14-day grace (§10) means a legitimately-authored batch can outlive an access token by days. |
| `403` (RLS / entitlement) | Park item as `needs-attention`. Never discard — the user's access may have changed *after* they did legitimate work; the server adjudicates replay (§10). |
| `409` (conflict) | Apply the per-entity conflict policy (§7). |
| `422` (validation) | Park as `rejected`; show the reason in the Sync Centre with the original payload viewable. |
| Same item fails **20 times** | Mark **poison**; stop retrying; raise it in the Sync Centre; include it in the diagnostic bundle. |

**Session refresh on replay** (the task's explicit ask): the replayer treats a `401` as a
signal to run the standard Supabase refresh-token flow *once* before the next attempt,
inside the FetchAdapter (§8). Because `detectSessionInUrl:false` and the refresh token
lives in secure storage (PRD A-02), this works offline-to-online without a redirect. A
second consecutive `401` means the refresh token itself is dead (expired grace, revoked
session) — at which point the outbox parks and the app degrades to the read-only /
sign-in state of §10, **with the outbox intact**.

**Poison handling.** A poison item is *quarantined, not deleted*. It stays visible and
exportable (Sync Centre diagnostic bundle, PRD S-08) so a human can see exactly what
failed. Only an **explicit user discard-with-confirmation** (PRD S-08) removes it.

**Failure mode prevented.** "Exponential backoff" as v1.0 left it (audit §7.4) is
under-specified in exactly the ways that lose data: discarding a `403` that was actually a
mid-day entitlement change, retrying a `422` forever, or throwing away a batch because an
access token expired overnight. Each row of the table above is a specific way a naïve
retry loop eats a legitimate mutation.

---

## 6. Media queue

**Decision.** A dedicated, **local-only** `media_queue` table (audit §7.3) plus an
on-disk file store, kept deliberately separate from the row outbox because binary upload
has different durability, ordering and background-execution needs — and because **no
bought sync engine covers it** (§12). The pipeline, carried from audit §7.4 and PRD S-06:

1. **Capture-to-disk first.** The camera writes bytes to `expo-file-system` (native) /
   OPFS-backed file (web) **before anything else**, and a `media_queue` row is inserted in
   the same transaction. Nothing is held only in memory.
2. **Immediate thumbnail.** A thumbnail is generated on capture so the photo is visible in
   the task within the PRD §9.1 budget (< 0.5 s local write) regardless of upload state.
3. **Downscale before upload.** **Long edge 2048 px, JPEG q80, EXIF stripped except
   orientation** (audit §7.4, PRD S-06). The **original is retained locally until the
   server confirms** the upload; only then may LRU eviction reclaim it (PRD S-12 — LRU
   evicts *synced* media only).
4. **Background upload.** Native uses an iOS **`URLSession` background configuration** and
   Android **`WorkManager`**; web uses a foreground/Background-Sync upload (Chromium only —
   nothing resumes after a web tab close, PRD §6.1, disclosed).
5. **Reconcile-on-launch.** **This is the known trap:** `expo-file-system` background
   upload **survives suspension but NOT termination** (audit §3.3, §7.4; +8–12 dev-days).
   Every launch runs a reconcile sweep over the durable `media_queue`: for each row not
   confirmed by the server, re-enqueue the background upload; for each row the server
   *did* receive but whose confirmation the client missed (crash between upload and ack),
   reconcile by content hash (below) and mark it done without re-uploading.

**Content-addressing.** Each media item is hashed (e.g. SHA-256 of the downscaled bytes)
and the hash is the dedupe key (audit §7.4 conflict table — "Media … content-addressed by
hash to suppress duplicates"). This makes the whole pipeline idempotent across the
force-quit/reconcile boundary: a re-uploaded file the server already holds is recognised
and dropped, not duplicated.

**Ordering vs. the row outbox.** A photo's `media_queue` row `dependsOn` the task's outbox
mutation (via the same `dependsOn` mechanism, §4) so it never uploads before its parent
task exists server-side. The *file bytes* upload independently of the row mutations, but
the **metadata row** that references the stored object obeys outbox ordering.

**Quota rejection** (PRD S-10): a `413`/quota response **never loses the media** — the
file is retained locally, the user is told, and pointed at the web to resolve
(audit §7.5). This is a `needs-attention` park, not a discard.

**Wi-Fi-only toggle** (PRD S-11): a user setting gates background upload to Wi-Fi with a
manual "upload now over cellular" override. Capture-to-disk and thumbnailing are never
gated — only the upload leg.

**Failure mode prevented.** Two specific, expensive traps: (a) a full-resolution 12 MP
photo × 40/day × a crew, uploaded raw, blows the org storage quota and the field
bandwidth (audit §7.4) — downscale-before-upload fixes it; (b) the app is force-quit with
photos queued, and because Expo background upload does not survive termination, they never
send — reconcile-on-launch over a durable queue is the only thing that recovers them.

---

## 7. Conflict engine

**Decision.** A per-entity policy table, carried forward verbatim from audit §7.4 and
matching PRD S-07. The engine never merges silently.

| Entity | Policy |
|---|---|
| `task_check_ins`, `time_registrations`, `task_documentation`, `task_chat_messages` | **Append-only.** No conflict is possible; each is a new immutable row. Duplicate suppression by idempotency key (and by content hash for media). |
| `tasks` (status, assignee, dates) | **Last-writer-wins with a server guard.** The **server** rejects transitions illegal from the *current* state (the existing state machine, PRD T-05); the client **surfaces the rejection rather than retrying** it. LWW resolves the benign concurrent-edit case; the guard prevents an offline client forcing an illegal transition. |
| `projects` (light edit) | LWW with server guard. |
| `punch_list_items`, `task_quality_control` | **Explicit user resolution.** The rival row is stored in the local `_conflict` column; the Sync Centre shows **both versions side by side** and requires a choice (PRD Q-03). Never merged silently. |
| Media | Append-only; content-addressed by hash to suppress duplicates. |

**Mechanics.** A `409` (or a `baseVersion` mismatch reported as `conflict`) returns the
authoritative `serverRow` in the result (§4.1). The client:

- **Append-only:** cannot occur; if the server still reports one it is a duplicate — drop
  the local outbox item, keep the server row.
- **LWW-with-guard:** if the server *accepted* a newer write, adopt `serverRow` and drop
  the local mutation (the other writer won); if the server *rejected* the transition as
  illegal, park as `needs-attention` and show the reason — do **not** auto-retry (retrying
  an illegal transition just loops).
- **Explicit resolution:** write `serverRow` into `_conflict`, set the outbox item and the
  local row to `conflict` state, and surface it. The user's choice produces a *new*
  mutation (a fresh idempotency key) that supersedes both.

**Rationale.** Append-only is the safest policy and the PRD deliberately routes the
highest-volume field writes (check-ins, time, chat, documentation) through it — no
conflict is *possible*, so the hardest correctness problem is avoided by data modelling,
not solved by cleverness. LWW-with-guard is right for tasks/projects because the *server*
owns the legal-transition rule (P4). Explicit resolution is reserved for the two entities
where a silent LWW would destroy signed compliance work (punch list, quality sign-off).

**Failure mode prevented.** A blanket LWW (the tempting simplification) silently discards a
punch item or a quality sign-off that two people edited on the same day — unacceptable for
records tradespeople sign against. A blanket "explicit resolution" would drown the user in
prompts for chat messages that cannot conflict. The per-entity mapping is the point.

---

## 8. The repository contract — one interface, three runtimes

This is the abstraction that "swap the sync engine in a week" (AR-05, Build Plan §10)
depends on, and the audit named a repository layer (§4.3, §7.3) but **never typed it** —
so the shape below is this document's contribution (flagged §14-B).

### 8.1 The contract shape

**Decision.** Screens and business logic depend on a small set of **entity repository
interfaces** and a **sync-control interface** — never on a sync-engine type, a SQL string,
or `expo-sqlite`. TypeScript sketch:

```ts
// packages/core — depends on NOTHING platform-specific, NOTHING sync-specific.

// A read/write handle to one entity's local mirror. Reactive by design:
// reads return an observable so screens re-render when sync lands new data.
export interface Repository<T> {
  get(localId: string): Promise<T | null>;
  // query() takes a declarative spec, never SQL — the runtime compiles it.
  query(spec: QuerySpec<T>): Promise<T[]>;
  observe(spec: QuerySpec<T>): Observable<T[]>;   // fires on local write AND on pulled deltas
  create(input: NewRow<T>): Promise<T>;           // assigns _local_id, enqueues outbox, co-transacted
  update(localId: string, patch: Partial<T>): Promise<T>;
  softDelete(localId: string): Promise<void>;     // sets _deleted, enqueues a delete mutation
  // conflict surface — used only by the Sync Centre, never by feature screens:
  pendingConflicts(): Observable<ConflictView<T>[]>;
  resolveConflict(localId: string, choice: 'local' | 'server' | T): Promise<void>;
}

// The engine control surface. The Sync Centre and the app shell talk to THIS,
// not to PowerSync / ElectricSQL / the bespoke engine.
export interface SyncController {
  status(): Observable<SyncStatus>;               // tier, pending count, oldest age, poison count...
  syncNow(): Promise<void>;                        // manual pull+push
  retry(outboxId: string): Promise<void>;
  discard(outboxId: string): Promise<void>;        // requires explicit confirmation upstream
  exportDiagnostics(): Promise<DiagnosticBundle>;  // PRD S-08
}

// Media is its own port — no bought engine covers binary upload (§12).
export interface MediaQueue {
  capture(bytes: Uint8Array | FileRef, meta: MediaMeta): Promise<MediaHandle>; // disk-first + thumbnail
  observe(taskLocalId: string): Observable<MediaItem[]>;
  usage(): Promise<{ bytes: number; evictableBytes: number }>;  // PRD S-12
}
```

- **`QuerySpec` is declarative** (entity, filters, order, limit) and is compiled by the
  runtime into either SQL (bespoke / expo-sqlite) or the bought engine's query API. No
  screen ever writes SQL. This is what lets the underlying engine change without touching
  a screen.
- **Reads are observable.** `observe()` fires both on a local write and when a delta pull
  lands new rows — so a screen showing a task list updates when sync brings a colleague's
  change, without the screen knowing sync exists (PRD S-09 freshness indicators read off
  `SyncController.status()`, not off engine internals).
- **The `SyncController` is the only thing the Sync Centre imports.** Everything the Sync
  Centre displays (PRD S-08) is a projection of `status()` and the telemetry heartbeat
  (§11) — no engine type crosses into the UI.

### 8.2 How AR-05 is enforced

**Decision.** AR-05 ("no screen may import a sync-engine type directly") is enforced
mechanically, not by convention — the same discipline that makes the 2.1 registry portable
(`eslint-plugin-boundaries`, audit §4.1, PRD AR-07):

1. **The engine lives behind a package boundary.** The concrete engine (bespoke or
   PowerSync/Electric adapter) lives in `apps/app/src/sync` and `apps/app/src/db`; the
   **interfaces** (`Repository`, `SyncController`, `MediaQueue`, `QuerySpec`) live in
   `packages/core`. Screens import only from `packages/core`.
2. **A lint rule bans the concrete imports.** `eslint-plugin-boundaries` (or a
   `no-restricted-imports` rule) forbids any file under `src/screens/**` or
   `packages/ui/**` from importing `@powersync/*`, `@electric-sql/*`, `expo-sqlite`, or
   `apps/app/src/sync/**`/`src/db/**`. A violation fails the per-PR gate (Build Plan §5.3,
   layers 1/2/4/7 per PR).
3. **Dependency injection at the app root.** The concrete engine is constructed once at the
   app root and provided via context; screens receive `Repository<Task>` etc., never the
   implementation. Same construction pattern as the platform adapters (audit §7.6).

**Failure mode prevented.** If one screen imports `@powersync/react-native` directly, the
"swap the engine in a week" property is silently dead — and you discover it only when you
try to swap, i.e. at the worst possible time. A lint rule turns that latent architectural
decay into a red PR check on day one. It also keeps D-11 (§12) genuinely open: because no
screen knows which engine is underneath, the P0 spike can choose bespoke vs. bought without
a single screen change.

---

## 9. Three-runtime storage

Audit §7 is **native-only** (§7.3 speaks of SQLCipher and `expo-secure-store` and nothing
else). The three-runtime reality is the CRITICAL finding S1 of the hardening review and
PRD §6.1; this section is where it is designed. It is the single biggest thing the audit
skeleton did not contain.

### 9.1 The two substrates

**Decision.** The `Repository`/`SyncController`/`MediaQueue` contract (§8) is satisfied by
**three storage runtimes over two substrates**:

| Runtime | Substrate | Encryption | Notes |
|---|---|---|---|
| iOS | native SQLite (via `expo-sqlite`) | **SQLCipher**, key in `expo-secure-store`, re-derived on biometric unlock (audit §7.3) | app-container file; yours until app deleted |
| Android | native SQLite | SQLCipher, same | same |
| Web | **wasm SQLite over OPFS** | **none** — OPFS is origin-scoped but not encrypted (hardening §1, PRD §9.4, disclosed) | browser may evict; Safari private browsing has no OPFS at all |

**Encryption decision (closing audit §7.3's open "or"):** native uses **SQLCipher** (not
platform file-protection alone) — audit §7.3 said "SQLCipher *or* platform file-protection
— 'or' is not a decision"; this document decides **SQLCipher**, because it gives a single
cross-platform (iOS+Android) at-rest story and does not depend on the OS keeping a file
class locked while the app is backgrounded and holding the DB open. The key is small and
fits `expo-secure-store` comfortably (audit §7.3). Web OPFS is unencrypted and this is
disclosed in the consent/privacy screen (PRD §9.4) — a shared machine is a different threat
model (hardening §1) and the honest answer is to say so, not to pretend wasm gives us
encryption it does not.

**Corruption recovery** (audit §7.3, PRD E3 AC③): on `SQLITE_CORRUPT`, **quarantine** the
DB file, export the outbox and `media_queue` if readable, **re-hydrate from the server**,
and surface what could not be recovered. **Never silently re-create** — a silent re-create
looks like data loss to the user and hides a bug from us.

### 9.2 Graded web tiers

**Decision.** Detect at startup, degrade explicitly, **never pretend** (PRD §6.1, S-13,
Build Plan §4.1). Three tiers:

| Tier | Condition | Behaviour |
|---|---|---|
| **Full** | OPFS available **and** `navigator.storage.persist()` granted | Identical to native (minus at-rest encryption and background-upload-after-tab-close). |
| **Session-durable** | OPFS available, persistence **not** granted | Works; **warns the browser may reclaim data**; prompts to install the PWA (installed PWAs are far less likely to be evicted). |
| **Online-only** | **No OPFS** (Safari private browsing; some locked-down browsers) | App runs, clearly labelled, and **refuses to queue mutations it cannot durably hold**. |

- **`navigator.storage.persist()`** is requested at **first meaningful use** (first
  mutation, not first launch), and the result is surfaced in the Sync Centre
  (PRD S-13, Build Plan §4.2).
- **The Online-only tier's refusal to queue is a designed behaviour, not a failure.** The
  `Repository.create/update` calls in this tier return a typed "cannot persist offline"
  outcome that the UI renders as "you must be online to save this" — it **never** enqueues
  into memory that vanishes on tab close (PRD P3, Build Plan §4.1). Silently queueing into
  volatile memory is the single worst behaviour available and is exactly what the web
  chaos arm (layer 6b) exists to catch.

### 9.3 Multi-tab single-writer election

**Decision.** On web, **one tab is elected writer** via the **Web Locks API**; other tabs
**read through the leader** (PRD S-14, hardening §1, Build Plan §4.2). The leader holds a
named lock (`bygsmart-sync-writer`); follower tabs observe the same OPFS-backed DB
read-only and route their mutations to the leader via `BroadcastChannel`/`MessageChannel`.
If the leader tab closes, the lock releases and a follower is promoted.

**This is designed in from P3a, not retrofitted** — the hardening review is explicit
(hardening §1.4, Build Plan §4.2): "retrofitting multi-tab safety into a working
single-tab implementation is a rewrite."

**Failure mode prevented.** Several wasm-SQLite VFS implementations permit only one
connection at a time (hardening §1); two tabs writing the same OPFS database concurrently
corrupt it or silently drop writes. Single-writer election makes concurrency a routing
problem, not a corruption problem — and it is a P3a contract test (three runtimes, layer
4) plus a web chaos scenario ("two tabs mutating one record", layer 6b).

---

## 10. Session & grace model

Audit §7.5 specified the **native** grace model; it predates the tri-target decision and
says nothing about web. The web half comes from hardening §8 and PRD A-06/§6.1. Three
**independent clocks** (audit §7.5's key insight — "the two are different clocks", D-08):

| Control | Native | Web | Source |
|---|---|---|---|
| **Session grace** (read + queue) | **14 days**, held in secure storage, **mandatory biometric lock when unsynced work exists** | **72 hours** (storage is neither secure nor durable) | audit §7.5 · hardening §8 · PRD A-06 |
| **Entitlement cache TTL** | **72 hours**, independent of session grace | 72 hours | audit §7.5 · PRD S-15 |
| **Replay under revoked entitlement** | **server adjudicates** | server adjudicates | audit §7.5 |

**Decision — session grace.** Native holds 14 days of read+queue; past 14 days the app is
**read-only until an online authentication succeeds** — the outbox is **never discarded**,
it parks (§5). **Biometric lock is mandatory, not a toggle, when the device holds unsynced
work** (audit §7.5, PRD A-04) — because a lost device with a 14-day local mirror of tenant
data is the threat. Web holds **72 hours** because `localStorage`/IndexedDB/OPFS are
clearable by the browser or the user at any time and there is no biometric lock available
(PRD §4 platform matrix); a shorter grace matches the weaker durability guarantee.

**Decision — entitlement cache TTL.** Entitlements are cached with a **72-hour TTL,
independent of the session grace** (audit §7.5, PRD S-15). Past TTL, affected modules
degrade to **read-only / sync-only** — *not a lockout, but no new work in that module*.
This is the fix for the false equivalence audit §7.5 identified: the web's fail-open (an
API outage of seconds) must **not** be stretched across a 14-day offline window, which
would let a revoked org retain full local capability for two weeks.

**Decision — replay adjudication.** A mutation authored **before** an entitlement was
revoked and replayed **after** is accepted **iff `createdAt` precedes the revocation
timestamp**, rejected with a clear reason otherwise. **The server decides this; the client
never adjudicates** (audit §7.5, PRD P4). This is why `createdAt` is a first-class,
server-trusted-with-guard field in the outbox (§4) — though the server must treat a
client clock as advisory and cross-check against server-side revocation records (clock
skew is a chaos-suite scenario, Build Plan §5.1 layer 6).

**Kill switch & force-upgrade** (audit §7.5): both take effect on the *next successful
sync*; neither can reach a device that never connects, and the design **states that
exposure rather than implying a guarantee**. Force-upgrade is native-only, from v1.1
(PRD AR-08).

**Failure mode prevented.** Without three separate clocks, "offline grace" collapses into
one number that is simultaneously too long for entitlements (revoked orgs keep working for
14 days) and — if you shorten it — too short for the session (a crew loses a day's queued
work because a token expired overnight). Splitting the clocks lets each be right: 14-day
session durability *and* 72-hour authorisation freshness, with the server as the final
arbiter of replay legitimacy.

---

## 11. Client sync telemetry heartbeat

**Decision.** On each successful sync the client emits a **heartbeat** (audit §7.7,
PRD §9.5) reporting:

- **pending outbox count**
- **oldest pending age** (now − min(`created_at`) over pending items)
- **poison count**
- **media queue depth** (unconfirmed `media_queue` rows)
- **last successful pull cursor age** (now − `serverTime` of last pull)
- **offline-authored share** (was the last mutation batch created offline?)
- plus **storage tier** (Full / Session-durable / Online-only / native), so web durability
  is observable in aggregate.

Server-side aggregation raises alerts at the thresholds audit §7.7 sets: **p95
oldest-pending-age > 1 h**, **poison rate > 0.05 %**, **sync error rate > 2 %**. The Sync
Centre's **diagnostic export** (device state, outbox contents *redacted of payload bodies*,
last 200 sync breadcrumbs) attaches to a support ticket (audit §7.7, PRD S-08). Sentry
release health is tagged with the same `__APP_VERSION__` convention as web (audit §7.7).

**Rationale & failure mode prevented.** PRD §12 sets launch metrics — "outbox items ending
in unresolved failure < 0.1 %", "≥ 20 % of mutations created offline" — that are
**unmeasurable without this pipeline** (audit §7.7 caught v1.0 setting exactly these gates
with no telemetry to report them). The heartbeat is the instrument that makes the success
criteria and the R2 reliability risk observable *before* a support ticket, not after.

---

## 12. Buy-vs-build surface map (D-11)

**This section does NOT decide D-11.** Per the task and audit §7.2 / PRD D-11 / Build Plan
P0.1, D-11 (bespoke on `expo-sqlite` vs. PowerSync / ElectricSQL / Legend-State) is
resolved by the **P0 tri-target spike**, on iOS + Android + **React Native Web** against
the real schema — because PowerSync's RNW support is in **beta** (hardening §1, PRD R-02).
This section maps the surface so the spike knows what it is buying and what it must build
regardless.

| Design area (this doc) | A bought engine (PowerSync / Electric) would supply | **Bespoke regardless of D-11** |
|---|---|---|
| §2 Sync metadata model | Its own metadata columns / shadow tables | The **field entity selection** and the type-mapping rules; mapping our `_conflict`/`_dirty` semantics onto its model |
| §3 Delta pull + cursor | ✅ delta replication, cursor, paging, consistency | The **hydration UX/budget** and RLS-scoped bucket/stream definitions (server side) |
| §3.3 Tombstones | ✅ (soft-delete propagation) | Server-side retention window ≥ grace |
| §4 Outbox | ✅ durable upload queue, idempotency, ordering | `dependsOn` semantics may need explicit modelling; **the `POST /api/sync/mutations` contract shape** if server stays custom |
| §5 Retry mechanics | ✅ backoff + retry | **Per-status policy** (401/403/409/422 handling, session refresh, poison park) is largely still ours to define on top |
| **§6 Media queue** | ❌ **Not covered.** Row-sync engines do **not** move binary blobs | **Entirely bespoke**: capture-to-disk, downscale, background upload, reconcile-on-launch, content-addressing, quota handling |
| §7 Conflict engine | ✅ generic LWW / CRDT / last-write | **Per-entity policy** (append-only vs LWW-with-guard vs **explicit user resolution**) and the **resolution UI** are ours |
| §8 Repository contract | Supplies an implementation *behind* it | **The contract itself, and AR-05 enforcement**, are ours — and are what keep D-11 reversible |
| **§9 Graded web tiers + Web Locks** | Partial (PowerSync has RNW beta) | **Tier detection, persistence request, Online-only refusal, single-writer election** — mostly ours; the spike must prove the engine tolerates them |
| §10 Session & grace | ❌ Not an engine concern | **Entirely bespoke**: 14d/72h grace, biometric lock, 72h entitlement TTL, replay adjudication |
| §11 Telemetry heartbeat | Some engine metrics exist | **The field-facing heartbeat and Sync Centre** are ours |

**Reading of the map:** buying compresses §3, §4 and the mechanical half of §5/§7 (this is
the 35–55 dev-days vs 100–160 saving, audit §0.2/§7.2). It compresses **none** of §6
(media), §8 (the contract + AR-05), §9's web-tier UX and single-writer election, §10
(authorisation/session), or §11 (telemetry). Those remain the programme's own work under
*any* D-11 outcome — which is precisely why this design doc is engine-agnostic and why
AR-05 keeps the choice open.

> **⚑ Flag for human review (§14-C).** The map assumes row-level replication engines do
> not carry binary media — true for PowerSync and ElectricSQL as of the audit. The P0
> spike must confirm the *current* capability of each candidate and confirm RNW beta
> behaviour before D-11 is signed.

---

## 13. Contradictions between the governing documents

Called out as the task requires. In every case the later/governing document wins (Build
Plan v4.1 governs; audit §8/§11 are void).

1. **Session grace — audit §7.5 is native-only and pre-tri-target.** Audit §7.5 gives a
   14-day session grace and 72-hour entitlement TTL with **no web tier at all**. PRD A-06
   and hardening §8 add **web = 72-hour** grace and the per-runtime threat model. *Not a
   true contradiction — a gap the later docs fill.* This document carries the later model
   (§10) and treats audit §7.5 as the native half only.

2. **Idempotency-key TTL — "≥ offline grace window" is ambiguous now that grace differs by
   runtime.** Audit §7.4 says the server stores idempotency keys "with a TTL at least as
   long as the offline grace window." With grace now 14 days (native) vs 72 h (web), the
   binding constraint is the **longest** grace. This document resolves it to **14 days**
   (§4.1) so a native-authored mutation replayed on day 13 still dedupes. *Flagged because
   audit §7.4 predates the split and does not say which grace it means.*

3. **Calculator bit-identity vs. "fix the wrong ones" — not a sync concern, noted for
   completeness.** Audit §8.3 mandates bit-identical calculator results; Build Plan §1
   **voids** that rule ("where a formula is wrong, fix it") and audit §8 is void anyway.
   This affects the calc-engine, not sync, and does not touch this document — but a reader
   cross-referencing the audit should know §8.3 is dead.

4. **Effort/estimate drift across documents (audit R15).** The audit itself flags that
   dev-days and person-months are quoted inconsistently across documents. It does not
   affect the *design*, but it means any schedule reference in this doc (e.g. media
   +8–12 dev-days) should be read as the audit's figure, not a re-estimate.

No hard, unresolved contradiction was found that blocks the design. All divergences are
"audit was written earlier / native-only; later docs extend it", and the later docs
govern.

---

## 14. Places audit §7 was silent — calls made here (for human review)

These are the points where §7 decided nothing and this document had to. Each needs a human
sign-off at the two-engineer review (Build Plan §11 item 8; risk R11 — "design doc reviewed
by two engineers before code").

- **§14-A · Hydration budget & page size (§3.4).** ≤ 60 s to interactive on 4G for a
  "typical scope" (1 org, ≤ 25 projects, ≤ 2 000 tasks, metadata only), 500-row pages,
  resumable, progressive unlock. Audit §7.3 explicitly deferred these two numbers to this
  document. **Validate against real P0 schema row counts and the spike's measured
  throughput.**
- **§14-B · The repository contract shape (§8).** `Repository<T>`, `SyncController`,
  `MediaQueue`, `QuerySpec` interfaces, reactive reads, and DI + lint enforcement of
  AR-05. Audit named a repository layer but typed only the *platform* adapters (§7.6),
  never the repository/sync contract. **This is the load-bearing "swap in a week"
  abstraction — it deserves the most scrutiny.**
- **§14-C · Buy-vs-build surface map (§12).** The claim that media, the contract, web
  tiers, session/grace and telemetry are bespoke under *any* D-11 outcome. **Confirm
  against each candidate engine's current capabilities in the P0 spike.**
- **§14-D · SQLCipher over platform file-protection (§9.1).** Audit §7.3 left this an
  explicit "or"; this doc decides SQLCipher. **Confirm the SQLCipher + `expo-sqlite`
  New-Architecture path in the spike (it is a native-module concern).**
- **§14-E · UUIDv7 justification and FK-on-`_local_id` rule (§2).** Audit §7.3 wrote
  "UUIDv7" without stating why or how FKs resolve before a server id exists; this doc makes
  local FKs reference `_local_id` and never repoint. **Confirm this against the bought
  engine's identity model if D-11 lands "buy" — some engines own id assignment.**
- **§14-F · Backoff jitter and the 20-attempt poison threshold applied per-item vs.
  per-batch (§5).** Audit §7.4 gave the schedule and the "20 times" threshold but not
  jitter or the per-item scoping; both are this doc's calls.
- **§14-G · Web Locks single-writer + BroadcastChannel routing (§9.3).** Entirely absent
  from audit §7 (native-only); sourced from hardening §1/§8 and PRD S-14. The *mechanism*
  (named lock + follower routing + leader promotion) is this doc's design.
- **§14-H · Media↔outbox dependency coupling (§6).** The rule that a media metadata row
  `dependsOn` its parent task's outbox mutation while file bytes upload independently is
  this doc's synthesis of audit §7.4's separate statements about `dependsOn` and the media
  queue.

---

## 15. How this design is tested (Build Plan §5 layers 4, 5, 6, 6b)

The design is deliberately shaped so the Build Plan's test layers can target it:

- **Layer 4 — repository/sync contract tests** run the *same* suite against **all three
  runtimes** (native SQLite ×2, wasm/OPFS) behind the §8 contract. This is the executable
  proof of §8 and §9.1, and of "swap the engine in a week" (Build Plan §5.1).
- **Layer 5 — property-based tests** (`fast-check`, 10 000 cases/run) assert **convergence
  under any interleaving** of the §4 outbox and §3 pull — the mathematical backstop for
  the cursor logic (§3), dependency ordering (§4.2) and the conflict engine (§7).
- **Layer 6 — native chaos arm** (100 randomised runs, **zero loss**): kill mid-upload,
  reboot with a full outbox, disk full, airplane flapping, **clock skew** (tests §10's
  replay adjudication), session expiry offline, two-device conflict.
- **Layer 6b — web chaos arm** (100 runs): **storage eviction mid-outbox, quota exceeded,
  tab closed mid-upload, two tabs mutating one record, OPFS unavailable at startup,
  private-browsing session** — the direct tests of §9.2 tiers, §9.3 election and §6 media.

The **G3b hard stop** is both chaos arms passing 100 consecutive runs with zero data loss,
plus a reference offline day (8 h, 40 photos, 12 check-ins, 30 mutations, no signal)
draining to an empty outbox within 5 minutes of reconnection (Build Plan §7 P3b,
PRD E4 AC①/②). **No offline-write flow is "done" until this passes.** This design exists to
make that gate achievable — and every "failure mode prevented" note above names a specific
run in layers 6/6b it is meant to survive.

---

*Prepared as the P0 sync design document (Build Plan §11 item 8). Ready for
two-engineer review per risk R11. Audit §7 carried forward and cited throughout; §8 and
§11 treated as void; three-runtime reality supplied from `05_PLAN_HARDENING_REVIEW.md`
and PRD §6. Author: Winston (Architect).*
