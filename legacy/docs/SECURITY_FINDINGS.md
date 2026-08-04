# Security Findings — Task List

Running log of security issues discovered during other work (not part of a
dedicated audit). Each entry gets its own section with enough context to pick
up later without re-deriving it. Update **Status** as items move; don't
delete closed entries — mark them done and keep the history.

---

## Open

### 1. `profiles_update_own` RLS policy has no column restriction

- **Found:** 2026-07-03, while building the admin-granted trial feature (Phase 5 of the admin dashboard insights plan).
- **Where:** Supabase project `pkzburssqetnlcbvabdq`, table `public.profiles`, RLS policy `profiles_update_own`.
- **Status:** 🔴 Open — deferred, needs a decision before fixing.

**The issue:** The policy is `FOR UPDATE USING (auth.uid() = id)` with **no `WITH CHECK` clause and no column-level restriction**. This is what lets a normal signed-in user call `supabase.from('profiles').update({...}).eq('id', user.id)` from the browser SDK to edit their *own* row — which is the intended, existing self-edit flow (name, phone, job title, CVR, company name, via `AuthProvider.updateUser()`). The problem is that the policy has no way to say "these columns yes, those columns no" — so it equally permits writing to columns that were never meant to be user-editable, most notably **`subscription_tier`**. In principle, any authenticated user could open devtools and grant themselves `ENTERPRISE` directly, bypassing Stripe entirely.

**Why it's not fixed yet:** This is a pre-existing gap, not something introduced by the trial feature — just newly surfaced while auditing that table's RLS for a related change. Fixing it properly means either:
  - adding a `WITH CHECK` that pins protected columns to their `OLD` value (same pattern used for the new `trial_*` columns — see `protect_trial_columns()` in `supabase/migrations/20260703000005_admin_insights_trial_grants.sql`), or
  - splitting the self-editable columns into a narrower `SECURITY DEFINER` RPC and locking the table policy down further.

  Either approach touches a widely-used self-edit path (`updateUser()` in `contexts/AuthProvider.tsx`, used from Settings and onboarding), so it needs its own deliberate pass rather than a drive-by fix.

**Mitigated so far:** The four new `trial_tier`/`trial_ends_at`/`trial_granted_by`/`trial_granted_at` columns added alongside this finding are already protected by the `protect_trial_columns()` trigger, so the trial feature itself does not extend this gap. `subscription_tier` itself remains exposed exactly as before.

**Next step:** Decide whether to extend the existing trigger pattern to guard `subscription_tier` (and any other should-be-admin-only column on `profiles`), or take the RPC-based approach — then apply as its own migration + due-diligence pass, same as any other RLS change on this table (see the `security_invoker` fix on `admin_handover_reports_v` the same day for the process to follow: verify via `get_advisors`, confirm via `execute_sql`, then apply).

---

## Closed

### 0. `admin_handover_reports_v` view bypassed RLS via missing `security_invoker`

- **Found & fixed:** 2026-07-03, same session as above.
- **Where:** `public.admin_handover_reports_v` (introduced by `20260703000003_admin_insights_handover_log.sql`).
- **Status:** ✅ Fixed same day — `supabase/migrations/20260703000004_admin_insights_fix_handover_view_security_invoker.sql`.
- **Issue:** Postgres views default to `security_invoker = false`, so the view ran as its owner rather than the querying user, bypassing RLS on `task_handovers`, `member_terminations`, and `ai_handover_reports_log`. Combined with the standard `anon`/`authenticated` grants every public table gets in this project, any user (possibly even anonymous) could have read every handover report platform-wide.
- **Fix:** `ALTER VIEW public.admin_handover_reports_v SET (security_invoker = true);` — confirmed via `pg_class.reloptions` and a follow-up advisor check.
