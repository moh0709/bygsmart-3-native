# Security Audit & Hardening — 2026-07-03

Full-app security review of BygSmart 2.1 (React SPA + Express API + Supabase/PostgREST).
Fixes applied in code are marked ✅. Items needing **your** action (secrets, DB, deploy) are marked ⛔ / ⚠️.

---

## ⛔ CRITICAL — DO THIS FIRST — leaked production secrets in git history

`.env.production` was committed in `0e1857a` and removed in `2b8918c`, but it is **still fully recoverable** from git history, and this repo has a GitHub remote (`origin` → `moh0709/Byggeapp-2.0.git`). Treat every value in it as **public/compromised**.

Exposed secrets (rotate ALL of them):

| Secret | Impact | Priority |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses ALL Row-Level Security → full read/write of every user's data | 1 |
| `AI_KEYS_SECRET` | AES master key that decrypts every stored AI-provider key & SMTP password | 1 |
| `GEMINI_API_KEY` | Billing/quota abuse | 2 |
| `STRIPE_WEBHOOK_SECRET` | Forge webhook events (grant tiers, etc.) | 2 |
| `VAPID_PRIVATE_KEY` | Send push notifications as the app | 3 |
| `STRIPE_SECRET_KEY` (test) | Test-mode only, still rotate | 3 |

**Actions (require your credentials / are destructive — not done automatically):**
1. **Rotate now**, in this order: Supabase service-role key (Dashboard → Settings → API → roll), then generate a new `AI_KEYS_SECRET` (⚠️ rotating it invalidates every stored provider key & SMTP password — owners/admins must re-enter them), then Gemini key, Stripe webhook secret, VAPID keypair, Stripe test key.
2. **Purge from history** (destructive, needs force-push + everyone re-clones):
   ```bash
   git filter-repo --path .env.production --invert-paths
   git push --force --all && git push --force --tags
   ```
   Rotation is mandatory even after purging — the data may already be cloned/cached.
3. Verify the Gitleaks CI gate (`.github/workflows/ci.yml` `secret_scan`) is enforced by branch protection — this commit should have been failing it.

---

## ✅ FIXED IN CODE (this change set)

### Privilege escalation & IDOR (RLS / API)
- **CRITICAL — self-promotion to platform admin.** Any user could run `supabase.from('profiles').update({ app_role: 'admin' })` from the browser (the update guard only pinned `subscription_tier`). Fixed in migration `supabase/migrations/20260703000007_harden_profile_and_resource_column_guards.sql` — the `protect_trial_columns` trigger now also freezes `app_role`, `team_id`, `team_role`, `is_demo`, `company_id`, `stripe_customer_id`, `stripe_subscription_id` for end-user writes. Trusted flows preserved: `accept_team_invite()` opts in via a transaction-local GUC; `company_id` may still move when driven by a `cvr`/`company_name` change (the `link_profile_company` trigger).
- **HIGH — team PII exposure via `team_id` self-assign** — closed by the same trigger.
- **HIGH — `projects_summary` view leaked all projects cross-tenant** — set `security_invoker = true` (same migration).
- **MEDIUM — Stripe tier piggyback via `stripe_customer_id` self-set** — frozen (same migration).
- **MEDIUM — in-project visibility self-escalation** on `project_resources` (a restricted member could set `visibility='all'` to read the budget/all tasks) — new `protect_project_resource_self_update` trigger freezes `visibility`/`kind` on member self-updates while leaving owner/manager updates intact.
- **MEDIUM — arbitrary-recipient in-app notification** (`POST /api/offer/notify`) — the recipient must now be a member of the same project; `projectId`/`recipientId` are UUID-validated; `link` must be a safe same-origin route.

### SSRF / injection
- **MEDIUM — SMTP SSRF** (custom SMTP host let a Premium owner scan internal addresses like `169.254.169.254`) — `assertPublicSmtpHost()` in `server/email.js` resolves the host and rejects private/loopback/link-local/metadata targets; enforced at store time (`smtpRoutes.js`) and connect time (`verifyConnection`/`sendMail`).
- **LOW — PostgREST `.or()` filter injection + storage path traversal** in `terminate-member` — `projectId`/`removedUserId` now strictly UUID-validated.
- **LOW — stored `javascript:`/off-site `contractUrl`** (`offer/update-status`) — now validated as an absolute `https://` URL.
- **LOW — SMTP error-message leakage** — PUT handlers only surface controlled 4xx messages, never raw DB errors.

### Frontend
- **OAuth `state` nonce was generated but never verified** (`services/integrationAuth.ts`) — the nonce is now persisted before redirect and checked (single-use) on callback; unknown providers rejected. Closes the token-fixation/CSRF gap.

### Deploy
- Added edge rate limiting (`limit_req`) and a dotfile `deny` block to `deploy/nginx-vps-proxy.conf`.

---

## ✨ NEW — Two-factor login (TOTP) is now enforced

TOTP MFA enrollment already existed (`components/settings/MfaEnrollModal.tsx`, Settings → "To-faktor-godkendelse") using Supabase's built-in MFA — works with **Google Authenticator, Microsoft Authenticator, 1Password**, any TOTP app, and is free. But login never checked it, so an enrolled factor was decorative.

Now:
- `contexts/AuthProvider.tsx` funnels every session through `applySession()`, which checks the Authenticator Assurance Level. If the account has a verified factor but the session is still `aal1`, the user is held in a `mfaPending` state (not logged in).
- `components/auth/MfaChallengeScreen.tsx` (rendered globally by `App.tsx` while `mfaPending`) collects the 6-digit code, runs `challenge()` + `verify()`, and upgrades the session to `aal2`. Covers fresh login **and** a mid-challenge page refresh.
- Accounts without MFA are unaffected (no behavior change).

**Recommended follow-up (optional, stronger):** to make MFA resist even an attacker who calls Supabase directly with a stolen password, add RLS policies that require `aal2` (`(auth.jwt()->>'aal') = 'aal2'`) on the most sensitive tables for users who have a factor. The app-level gate above covers the UI; RLS `aal2` covers the API. Roll out carefully to avoid locking out users.

---

## ✅ DONE (2026-07-04 follow-up)

1. **DB migration deployed & verified.** `harden_profile_and_resource_column_guards` applied to `pkzburssqetnlcbvabdq`. Verified against the **live** schema first (the local migration file's `accept_team_invite` was stale/pre-Stripe-tier — rebuilt on the deployed definition so the Stripe-backed leader tier was preserved). Functionally proved the `app_role='admin'` self-escalation is now reverted by the trigger (tested in a rolled-back transaction).
2. **Extra ERROR-level exposure found & fixed via advisors:** `public._legacy_task_offers_backup` (415 rows, a leftover backup) had RLS disabled with full `anon` SELECT/INSERT/UPDATE/DELETE — any visitor could read or wipe it. Locked down (`ENABLE`+`FORCE ROW LEVEL SECURITY`, revoked anon/authenticated grants). Migration `lock_down_legacy_task_offers_backup`. Consider dropping the table entirely later.
3. **Dependencies patched — 0 vulnerabilities** in both root and server `npm audit`:
   - `nodemailer` 6.10.1 → **9.0.3** (v7 was still flagged; 9.0.3 clears the SMTP command-injection / CRLF header-injection advisories). Verified `email.js` still builds transporters and the SSRF guard works.
   - `xlsx` 0.18.5 → **0.20.3** (patched SheetJS CDN build). Note: only used for *export* (no `XLSX.read` of untrusted input), so the parse-side advisories were not reachable anyway.
   - `react-router-dom` 6.30.3 → **6.30.4** (surfaced during audit: open-redirect via protocol-relative `//` URLs).
   - All 289 tests pass, typecheck clean, production build succeeds.
4. **`VITE_DEMO_*` confirmed clean** — present only in `.env.example`; not in `.env` / `.env.local` / `.env.production`, and not inlined in the current `dist/` bundle.

## ⚠️ Still needs your action

1. **⛔ Rotate the leaked secrets + purge git history** — see the top section. This is the one truly critical open item.
2. **Enable HaveIBeenPwned leaked-password protection** (Supabase → Authentication → Policies; advisor `auth_leaked_password_protection`). One toggle; strengthens password security.
3. **Verify the public storage bucket's list permission** (advisor `public_bucket_allows_listing`) is intended (fine for the PWA-assets bucket; not for anything user-uploaded).
4. **Regenerate/retire `supabase/schema.sql`** — it has drifted and encodes a *weaker* posture (no `app_role`/trial guards, no `security_invoker`); if ever used to rebuild it reintroduces the fixed holes. Treat `migrations/**` as authoritative.
5. **Cloud-storage OAuth (Medium):** access tokens are stored in `sessionStorage` via the deprecated implicit flow (`response_type=token`) — any XSS exfiltrates live Drive/OneDrive/Dropbox tokens. Migrate to Authorization Code + PKCE with the token held server-side. (The `state`-nonce CSRF gap is already fixed.)

---

## Verified clean (already well-hardened)

RLS enabled on every user-data table; `handle_new_user` doesn't trust client metadata for tier/role; AI keys & SMTP passwords AES-256-GCM encrypted and never serialized; Stripe webhook signature-verified; Gemini proxy authenticated + model-allowlisted + size-clamped; no mass-assignment; admin endpoints server-enforced against `app_role`; DOMPurify at both HTML sinks; no service-role key in the frontend; Docker runs non-root with digest-pinned images and runtime-injected secrets; strong CSP/HSTS at the SPA edge; extensive security CI (Gitleaks, Semgrep, OSV/Trivy, ZAP).
