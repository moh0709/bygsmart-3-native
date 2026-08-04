# BygSmart 3.0 Native — Consolidated Offline-Native Baseline (DRAFT)

**Status:** P0.3 deliverable 0.3 — authoring for human review. **Nothing here has
been provisioned, connected to Supabase, or run against any database.** Deployment
happens later against the freshly provisioned BygSmart 3.0 project.

This baseline is the **net effect** of replaying the 85 BygSmart 2.1 migrations
(`supabase/migrations/`), re-derived for the offline-native access model per
`docs/mobile-fork/01_AUDIT_MOBILE_FORK.md §7` and the P0.3 consolidation analysis.
`supabase/schema.sql` in 2.1 is stale and was NOT trusted.

## Section / file order (run strictly in this order)

| # | file | contents |
|---|---|---|
| 00 | `00_extensions.sql` | extensions + enums (`subscription_tier`, `user_role_type`, `member_status_type`, `log_level_type`, `sync_op`) |
| 10 | `10_sync_infrastructure.sql` | the offline spine: unified `set_updated_at()`; `sync_tombstones` + `emit_tombstone()`; `cascade_soft_delete()`; the unified guard primitive `parent_is_gone()`; `sync_idempotency_keys`; `purge_expired_sync_state()` |
| 20 | `20_identity.sql` | profiles, organizations, organization_members, org_module_entitlements; last-owner guard; simplified `handle_new_user()` |
| 30 | `30_projects_tasks.sql` | projects, project_resources, resource_task_access, tasks, quick_task_access; soft-delete cascade wiring |
| 40 | `40_field_quality_time.sql` | check-ins, documentation, handovers, quality, chat + reads, punch lists, purchases, reminders, activity, time_entries, time_registrations, org_time_responsibles, quotations, task_budget_rates |
| 50 | `50_documents_knowledge.sql` | documents, document_visibility, regulations |
| 60 | `60_backoffice.sql` | notifications/prefs/push, logs, connections, negotiation msgs, terminations, smtp, tool/module/org-module configs, storage usage, AI, trial codes, demo, **budget ledger** |
| 70 | `70_rls.sql` | RLS enable + DEFINER helpers + policies + grants + realtime + `security_invoker` views + storage bucket & policies |

Cross-file forward references (circular `profiles`↔`organizations`,
`resource_task_access`→`tasks`, `time_entries`→`time_registrations`) are closed with
deferred `ALTER TABLE … ADD CONSTRAINT` inside the owning section — the order above
must be preserved.

## The tombstone / retention rule

- **Canonical delete = soft delete.** The sync mutation layer never issues a raw
  `DELETE` on a syncable table; it sets `deleted_at = now()`. The row stays
  RLS-scoped and is served (with `deleted_at`) by the `(updated_at, id)` cursor
  until purged.
- **`emit_tombstone()`** (AFTER UPDATE OR DELETE on every id-PK syncable table)
  records every disappearance — soft-delete transition, physical purge, GDPR
  erasure, cascade — into **`sync_tombstones`**, so the server pull RPC can emit a
  delete event even to a user who has lost access (the AUDIT §7.4 "persists on
  devices forever" leak).
- **Retention window = 14 days** (the offline grace, AUDIT §7.5), enforced by
  `purge_expired_sync_state(interval)` which *rejects* any window `< 14 days`.
  Tombstones are kept `retention + 7 days` so a device offline for the full grace
  still receives the delete. Idempotency keys default to a 14-day TTL.

## The unified cascade-vs-guard rule (Req 4 — ONE first-class pattern)

2.1 patched two deadlocks reactively (`allow_ledger_cascade_delete`,
`allow_org_owner_cascade_delete`). Both are now expressed through a single
primitive:

> **`parent_is_gone(parent_table regclass, parent_id uuid)`** — SECURITY DEFINER,
> returns TRUE when the parent row is **logically dead** (soft-deleted:
> `deleted_at IS NOT NULL`) **or physically absent**. DEFINER so RLS cannot make a
> merely-*invisible* parent masquerade as a deleted one.

An integrity guard **rejects an ad-hoc mutation** but **allows a row to disappear
when `parent_is_gone()` is true** (i.e. it is only a cascade out of a dead parent):
- `reject_ledger_mutation()` (budget ledger) → allow delete iff parent
  budget/revision/project is gone.
- `protect_last_org_owner()` (org membership) → skip the last-owner rule iff the
  org or the member is already gone.

Syncable→syncable child FKs keep physical `ON DELETE CASCADE` **only** as the
purge/GDPR cleanup safety-net; the device-visible delete path is `cascade_soft_delete()`.

## Born-correct invariants (folded in from the 18 fix-of-fix migrations)

1. Every `SECURITY DEFINER` function pins `SET search_path = public`.
2. No RLS policy reads the table it protects — always via a DEFINER helper.
3. Views over RLS tables are `security_invoker = true` (`projects_summary`,
   `admin_handover_reports_v`).
4. Helper/RPC `GRANT EXECUTE … TO authenticated` only; `REVOKE … FROM PUBLIC, anon`.
5. The profiles overexposure fix is baked in: `shares_project_with_caller()` (both
   parties same project), never "any owner sees every profile".
6. `task_check_ins` — the canonical 2.1 bug (mutated on check-out with no
   `updated_at`) — is trigger-maintained like every other syncable table.

## Decisions that need HUMAN SIGN-OFF

1. **Soft-delete propagation mechanism** — chosen: DB trigger cascade
   (`cascade_soft_delete`) + physical `ON DELETE CASCADE` retained as purge net.
   Alternative: app/sync-layer propagation with FKs set to `NO ACTION`. Touches
   Req 1 & 4.
2. **Retention window (14 days) + purge cadence + scheduler.** `purge_expired_sync_state`
   is defined but NOT scheduled — needs pg_cron or an external job (service-role).
3. **`time_entries` kept alongside `time_registrations`** (both mirrored). Confirm
   the legacy per-task table is not retired.
4. **Budget ledger = back-office, not synced to devices.** Confirm a read-only
   device mirror is not required (S-06 budget views are online-only here).
5. **Membership re-derived onto `project_resources`; `projects.team[]` JSONB
   dropped.** Confirm the role mapping `visibility 'all' → MANAGER`, else EMPLOYEE
   (matches the 2.1 team-mirror trigger). This changes the RLS membership surface.
6. **teams / team_seats dropped**, and with them `profiles.team_id / team_role /
   company_id`, `organizations.source_team_id / source_company_id`, and the
   team-seat reconciliation in `handle_new_user()`. Confirm no native billing path
   depends on the seat model (2.1 used it as the Stripe seat vehicle).
7. **`organizations.grandfathered` default flipped to `FALSE`** (post-marketplace
   default). New orgs start lean. Confirm.
8. **Sync store design.** The baseline is store-agnostic (server owns
   `updated_at`/`deleted_at`/tombstones; client `_local_*` columns not modelled).
   D-11 (PowerSync / ElectricSQL / bespoke) may reshape §10 and how tombstones are
   delivered.
9. **The pull/mutation RPCs are NOT in this schema baseline.** Server-side RLS
   adjudication of replays under revoked entitlement (AUDIT §7.5), the 72h
   entitlement cache, and delivery of `sync_tombstones` to revoked users are all
   assumed to live in the sync endpoint layer — authored separately.
10. **`quick_task_access.invited_by` relaxed to NULLABLE.** 2.1 declared it
    `NOT NULL … ON DELETE SET NULL` (contradictory — SET NULL on a NOT NULL
    column). Resolved to nullable so inviter deletion doesn't break the row.
11. **`partner_negotiation_messages` included as back-office**, resource_id path
    only (legacy `partner_invite_id` + `is_partner_invite_party_legacy` dropped).
    Confirm it belongs in the native scope at all.
12. **Feature RPCs not ported here** (invite_partner, accept/decline, budget
    summary/baseline/revision, time submit/approve/reject, org create/switch/accept,
    connection RPCs, set_task_disabled_tabs, revoke_project_member_access, etc.).
    The RLS these RPCs assume IS in place; the RPC bodies are a separate port.

## Judgement calls where the 2.1 net state was ambiguous (flagged, not silently guessed)

- **`task_quality_controls` FK on-delete** — 2.1 left `author_id` / `responsible_id`
  FKs with no `ON DELETE`; hardened to `CASCADE` (author) / `SET NULL` (responsible).
- **`org_module_entitlements` classification** — modelled as *syncable-read* (client
  entitlement cache) rather than pure back-office, per PRD S-15 realtime flips.
- **`task_budget_rates`** — analysis lists it under syncable field tables; included
  with the treatment, but its PK is `task_id` (no `id`), so it has no direct
  tombstone — deletion derives from the parent task tombstone.
- **Composite-PK tables** (`task_chat_reads`, `document_visibility`,
  `org_time_responsibles`, `org_module_entitlements`) — get `updated_at` cursors but
  no direct tombstone; deletion derives from the parent (or is device-local, for the
  read cursor). Confirm the pull RPC reconstructs these from parent tombstones.
- **`activity_log` / `task_chat_messages` / append-only rows** — given `updated_at`
  and soft-delete anyway (uniform treatment) even though they are logically
  append-only, so the cursor and soft-cascade work consistently.

## Headline numbers

- Tables emitted: **54** (28 syncable + 24 back-office + 1 reference + 2 sync-infra
  — the reference table `regulations` and the 2 infra tables are counted separately
  from the 24 back-office application tables).
- Soft-delete columns in 2.1: **0**. In this baseline: on all 28 syncable tables.
- Soft-cascade edges wired (replacing hard syncable cascade fan-out): **23**.
- Competing `updated_at` mechanisms in 2.1: **3** → unified to **1**
  (`set_updated_at()`; `time_registrations` folds it into its workflow guard).
