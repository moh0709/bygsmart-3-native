# BygSmart Deploy Skill

When the user asks to deploy, ship to production, push to server, or run a deployment — follow this runbook exactly. Do not skip steps. Do not fake success.

**omniware.dk/byggeapp is retired.** bygsmart.com (landing) + app.bygsmart.com (SPA + API) are the only production targets.

---

## Trigger

Invoked when the user says: `deploy`, `ship`, `push to production`, `deploy to server`, or `/deploy`.

---

## Pre-flight

Before touching anything, run these checks in parallel:

1. **TypeScript clean?**
   ```bash
   cd "e:/01PROJEKTER/04 Mobil APPS/bygsmart 2.1/Byggeapp-2.1" && npx tsc --noEmit
   ```
   Abort if errors. Do not deploy broken TypeScript.

2. **SSH alive?**
   ```bash
   ssh simply_bygsmart 'echo ok'
   ```
   Abort if this fails. Check `~/.ssh/config` has the `simply_bygsmart` Host entry.

3. **Server currently healthy?**
   ```bash
   ssh simply_bygsmart 'curl -sf --max-time 5 -o /dev/null -w "%{http_code}" http://127.0.0.1:3002/api/health || echo 000'
   ```
   Note status. If already 000 before deploy, flag it — there may be a pre-existing issue.

---

## Step 1 — Commit pending changes

Check git status. If there are uncommitted changes, stage and commit them:

```bash
git status --short
git add <relevant files>
git commit -m "feat/fix/chore: <description>

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

**Never `git add .` blindly.** Stage specific files only. Always skip these temp/generated files:
- `tsc_out.txt` — TypeScript check artifact, never commit
- `dist/` — built output, never commit
- `services/database.types.ts` — auto-committed by `do-deploy.sh` at the end (legacy step, not run by deploy-simply.sh)

Never deploy with untracked files that belong to the release. Stash or commit them first.

---

## Step 2 — Supabase migrations (if any new .sql files)

Run this in parallel with the git status check. Get the list of already-applied migrations:

```
mcp: mcp__claude_ai_Supabase__list_migrations  project_id: pkzburssqetnlcbvabdq
```

Compare against local files in `supabase/migrations/` (sorted ascending by filename).

**Match by name, not version number.** Local filenames use the pattern `{version}_{name}.sql`.
The Supabase `list_migrations` response has `{version, name}` fields. A migration is already
applied if its `name` appears in the response — the version numbers may differ between local
and remote and that is normal.

Apply any unapplied migrations in ascending filename order:

```
mcp: mcp__claude_ai_Supabase__apply_migration
  project_id: pkzburssqetnlcbvabdq
  name: <snake_case_name from filename>
  query: <full SQL content of the file>
```

**Migrations MUST be applied before the app code is deployed.** Never reverse the order.

---

## Step 3 — Run the deploy

**Shell requirement: Git Bash only — NOT PowerShell, NOT WSL** (WSL can't resolve the `simply_bygsmart` SSH alias).

Run **in background** (deploy takes 2-4 min, mostly `npm ci` on the server):

```bash
cd "e:/01PROJEKTER/04 Mobil APPS/bygsmart 2.1/Byggeapp-2.1" && bash deploy/deploy-simply.sh
# run_in_background: true
```

If `SSH_AUTH_SOCK` isn't already set in this shell, pre-load the agent in the **same** invocation (agents started in a separate background shell can hang forever):

```bash
eval "$(ssh-agent -s)" >/dev/null && ssh-add ~/.ssh/simply_bygsmart </dev/null 2>/dev/null && bash deploy/deploy-simply.sh; ssh-agent -k >/dev/null 2>&1
```

While it runs, monitor the output file path returned by the tool. Key milestones:
- `✓ built in Xs` — Vite build done (base path `/`, NOT `/byggeapp/`)
- `SPA + proxy uploaded ✅` — app.bygsmart.com static files + PHP proxy live
- `Landing (index + subpages + assets) uploaded ✅` — bygsmart.com apex site live
- `Server files uploaded (vX.X.X) ✅` — Node source updated
- `node 127.0.0.1:3002/api/health → 200` — backend restarted and healthy ← **real gate**
- `https://app.bygsmart.com/api/health → ...` — public smoke test (see WAF note below)

`deploy/deploy-simply.sh` handles: SSH check, `VITE_PUBLIC_BASE_PATH=/` build, SPA upload (app.bygsmart.com), landing upload (bygsmart.com apex), backend upload, `npm ci --omit=dev --ignore-scripts`, restart via `start.sh`, health check (Node-direct + public).

**Timeout:** Allow up to 5 minutes.

### If Node health != 200 after restart

```bash
ssh simply_bygsmart 'tail -30 /var/www/bygsmart.com/logs/bygsmart_server.log'
```

Then manually (re)start:

```bash
ssh simply_bygsmart '/var/www/bygsmart.com/nodeapp/bygsmart_server/start.sh'
```

The cron keepalive also recovers automatically within 3 minutes (`*/3 * * * *`).

---

## Step 4 — Verify

**⚠️ WAF gotcha: simply.com returns HTTP 454/455 "Security Incident Detected" to automated `curl` traffic from a dev machine** (not a real outage — it's rate/pattern-based). Public curl checks from this machine are unreliable right after a deploy burst. **Verify via SSH, not public curl:**

```bash
# 1. Node health (internal, authoritative)
ssh simply_bygsmart 'curl -s http://127.0.0.1:3002/api/health'

# 2. On-server file freshness (confirms upload actually landed)
ssh simply_bygsmart 'ls -la /var/www/bygsmart.com/app/index.html /var/www/bygsmart.com/nodeapp/bygsmart_server/VERSION'

# 3. Server log — no crashes
ssh simply_bygsmart 'tail -20 /var/www/bygsmart.com/logs/bygsmart_server.log'

# 4. Keepalive cron is armed
ssh simply_bygsmart 'crontab -l | grep keepalive'
# Expect: */3 * * * * .../nodeapp/bygsmart_server/keepalive.sh
```

Only attempt a public `curl https://app.bygsmart.com/api/health` as a bonus check, and don't treat a 454/455 there as failure — cross-check with a browser or the SSH-side checks above before concluding anything is actually broken.

All SSH-side checks must pass before reporting success. See `deploy/simply/README.md` for the full architecture.

---

## What is NOT touched by the deploy

| Item | Status |
|------|--------|
| `~/nodeapp/bygsmart_server/.env` | Never overwritten — production secrets stay |
| `~/app/api/proxy.php`, `~/app/api/.htaccess` | Redeployed from `deploy/simply/api/` each run (tracked in repo, not hand-edited on server) |
| `~/app/.htaccess` | Redeployed from `deploy/simply/app/.htaccess` each run |
| `~/nodeapp/bygsmart_server/keepalive.sh`, `start.sh` | Redeployed from `deploy/simply/server/` each run |
| Anything under `~/public_html/` outside the landing site | N/A — apex docroot is landing-only on this host |

---

## Architecture reminder

```
Browser → bygsmart.com/            (static landing, multi-page)
Browser → app.bygsmart.com/        (React SPA, base path /)
Browser → app.bygsmart.com/api/*   (PHP proxy.php → 127.0.0.1:3002 Node.js)

Node.js backend = ~/nodeapp/bygsmart_server/index.js (port 3002, simply_bygsmart host)
  Kept alive by cron keepalive.sh every 3 min + start.sh on manual restart.
```

Full first-time setup, `.env` provisioning, and troubleshooting: `deploy/simply/README.md`.

---

## Common failures and fixes

| Failure | Fix |
|---------|-----|
| `Could not resolve hostname simply_bygsmart` | Must be Git Bash, not PowerShell/WSL |
| Public curl returns 454/455 right after deploy | simply.com WAF flagging automated traffic — verify via SSH instead, see Step 4 |
| `502` from `/api` | Node not running — check log, keepalive recovers in ≤3 min, or run `start.sh` manually |
| Node 23 quirks | Drop a local Node 20 LTS in `~/node20` and point `NODE_BIN` in `start.sh` at it (see `deploy/simply/README.md`) |
| Stripe webhook `400 bad signature` | `STRIPE_WEBHOOK_SECRET` in server `.env` must be the **live** webhook's secret pointed at `https://app.bygsmart.com/api/stripe-webhook` |

---

## Honesty contract

- Do not report "deployment complete" unless the SSH-side health check actually returned 200.
- A public-curl 454/455 right after deploy is NOT evidence of failure — cross-check via SSH before concluding anything is broken, and say so explicitly if you hit it.
- If the deploy script exits non-zero but the server is healthy (keepalive recovered), say so explicitly.
- State: `Verified with: ssh simply_bygsmart curl 127.0.0.1:3002/api/health → 200` or `Blocked by: [reason]`.
