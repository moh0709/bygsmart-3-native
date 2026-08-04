# BygSmart 2.1 — Deployment Guide

> **Platform:** Namecheap shared hosting (cPanel + CloudLinux)
> **Domain:** omniware.dk
> **Server user:** omnifkht
> **Supabase project:** pkzburssqetnlcbvabdq (region: eu-west-1)

---

## Quick Deploy (ongoing)

Open **Git Bash** (not PowerShell — see Windows note below) from the project root:

```bash
bash do-deploy.sh
```

That single command does everything: SSH check, build, upload frontend, upload backend, `npm ci`, restart, health check, smoke test, TypeScript type regen. Done.

> **Windows requirement:** Always run from Git Bash (`C:\Program Files\Git\git-bash.exe`).
> Running from PowerShell invokes WSL, which does not share the Windows SSH config and will
> fail with `Could not resolve hostname namecheap`.
> The included `_deploy.bat` opens Git Bash and runs `do-deploy.sh` automatically.

---

## What `do-deploy.sh` Does (step by step)

| Step | Action |
|------|--------|
| 1 | Clears any stale `.git/index.lock` |
| 2 | Commits staged `docker-compose.yml` changes if any |
| 3 | Starts ssh-agent and verifies SSH alias `namecheap` |
| 4 | `npm run build` — Vite compiles React app → `dist/` |
| 5 | Wipes `byggeapp/assets/` + `index.html` on server, uploads fresh `dist/` |
| 6 | Uploads `server/` source files to `/apps/byggeapp_server/` (`.env` never touched) |
| 7 | `npm ci --omit=dev` on server via the Node.js v20 virtualenv |
| 8 | Kills old Node process, starts fresh via `nohup node index.js` |
| 9 | Health check: `localhost:3002/api/health` must return HTTP 200 |
| 10 | Smoke test: `https://omniware.dk/byggeapp/` must return HTTP 200 |
| 11 | Regenerates `services/database.types.ts` via Supabase CLI and commits |

> The `.env` file on the server is **never overwritten**. Update it manually when new variables are needed.

---

## Prerequisites (dev machine)

`~/.ssh/config` must have the `namecheap` alias:

```
Host namecheap
  HostName 66.29.132.24
  User omnifkht
  Port 21098
  IdentityFile ~/.ssh/id_ed25519_namecheap
  IdentitiesOnly yes
  ServerAliveInterval 60
  ServerAliveCountMax 5
```

Test with: `ssh namecheap 'echo ok'`

---

## Database Migrations

**Rule: always apply migrations BEFORE deploying the app code.**

New migrations appear as `.sql` files in `supabase/migrations/`. Apply them in ascending filename order.

### Via Claude Code (preferred — uses Supabase MCP)

When deploying with Claude, use the `mcp__claude_ai_Supabase__apply_migration` tool for each new file.
Check which are already applied first:

```
mcp__claude_ai_Supabase__list_migrations  project_id: pkzburssqetnlcbvabdq
```

### Via Supabase CLI

```bash
supabase link --project-ref pkzburssqetnlcbvabdq
supabase db push
```

### Manual fallback

Open the Supabase SQL Editor and paste each new `.sql` file in ascending filename order.

---

## Architecture Overview

```
Browser
  │
  ▼
omniware.dk  (cPanel / LiteSpeed + Apache)
  │
  ├── /byggeapp/     → ~/public_html/byggeapp/          (React SPA — static files)
  │       .htaccess: everything → index.html (SPA fallback)
  │
  └── /api/          → ~/public_html/api/proxy.php       (PHP cURL reverse proxy)
          │                      ↑
          │               gemini.php (direct Gemini AI calls, bypasses Node.js)
          │
          └── proxy.php → http://localhost:3002           (Node.js backend)
                                    │
                                    └── ~/apps/byggeapp_server/index.js
                                          Node.js v20, port 3002
                                          Contains: AI routes, billing, push, tool access
                                          Managed by: cron watchdog (every 5 min)
```

### AI Backend

There is **no separate AI process**. All AI functionality lives inside the main Node.js backend:
- `aiRoutes.js` — AI orchestration API routes
- `aiProviders.js` — AI provider management

Additionally, `~/public_html/api/gemini.php` is a standalone PHP proxy for direct Gemini API calls. It is **never touched by the deploy script**.

---

## Server Process Management

The Node.js backend is managed by a **watchdog cron**, not Phusion Passenger.

**Watchdog script:** `~/bin/byggeapp-watchdog.sh`

- Primary check: `curl http://localhost:3002/api/health` (most reliable)
- Fallback: PID file + process name verification
- On failure: kills any zombie on port 3002, starts fresh `nohup node index.js`

**Crontab** (runs as `omnifkht`):

```
@reboot      ~/bin/byggeapp-watchdog.sh
*/5 * * * *  ~/bin/byggeapp-watchdog.sh
```

`@reboot` — starts after any server reboot.
`*/5 * * * *` — recovers automatically within 5 minutes if the process dies.

**Server log:** `~/logs/byggeapp_server.log`

---

## Known Deploy Quirk — SSH Restart on Windows

The restart step in `deploy/deploy.sh` issues two SSH commands (kill, then start), both with `|| true`. On Windows/Git Bash, the nohup backgrounding causes the SSH client to return exit code 255 intermittently. This is handled by making both restart commands non-fatal (`|| true`) and using the **health check as the authoritative gate**. If the server does not respond with HTTP 200 within the timeout, the deploy script exits with an error.

The watchdog cron also provides automatic recovery within 5 minutes if the restart fails.

---

## Manual Server Operations

```bash
# Check backend health
ssh namecheap 'curl -sf http://localhost:3002/api/health && echo UP || echo DOWN'

# Tail server log
ssh namecheap 'tail -30 ~/logs/byggeapp_server.log'

# Manually restart the backend (correct two-step approach)
ssh namecheap 'PID_FILE=~/apps/byggeapp_server/server.pid; [ -f "$PID_FILE" ] && kill "$(cat $PID_FILE)" 2>/dev/null; rm -f "$PID_FILE"; pkill -f "node index.js" 2>/dev/null; true' || true
ssh namecheap 'source ~/nodevenv/apps/byggeapp_server/20/bin/activate && cd ~/apps/byggeapp_server && nohup node index.js >> ~/logs/byggeapp_server.log 2>&1 </dev/null &' || true

# Or simply trigger the watchdog
ssh namecheap '~/bin/byggeapp-watchdog.sh'

# Check crontab
ssh namecheap 'crontab -l'

# Check running Node processes
ssh namecheap 'ps aux | grep node | grep -v grep'

# View recent API access
ssh namecheap 'zcat ~/logs/omniware.dk-ssl_log-*.gz 2>/dev/null | grep /api | tail -20'
```

---

## Environment Variables

Backend env file: `/home/omnifkht/apps/byggeapp_server/.env`

**Never overwritten by the deploy script.** Update manually when new vars are needed:

```bash
ssh namecheap 'nano ~/apps/byggeapp_server/.env'
# Then trigger restart:
ssh namecheap '~/bin/byggeapp-watchdog.sh'
```

| Variable | Purpose |
|----------|---------|
| `ALLOWED_ORIGIN` | CORS — must be `https://omniware.dk` |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `GEMINI_API_KEY` | Google Gemini API key |
| `AI_KEYS_SECRET` | AES-256 secret for encrypting stored AI provider keys |
| `STRIPE_SECRET_KEY` | Stripe live secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `VAPID_PUBLIC_KEY` | Web push public key |
| `VAPID_PRIVATE_KEY` | Web push private key |

Generate VAPID keys once:
```bash
cd server && npx web-push generate-vapid-keys
```

Generate `AI_KEYS_SECRET`:
```bash
openssl rand -base64 32
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Could not resolve hostname namecheap` | Running from PowerShell/WSL instead of Git Bash | Open Git Bash: `C:\Program Files\Git\git-bash.exe` |
| Build fails with `EPERM unlink dist/assets/...` | Windows filesystem permission on dist/ | `npx vite build --outDir /tmp/dist_new --emptyOutDir && cp -rf /tmp/dist_new/assets/* dist/assets/ && cp /tmp/dist_new/index.html dist/` |
| Health check returns 000 after deploy | Process didn't start in time | Watchdog recovers within 5 min; or manually: `ssh namecheap '~/bin/byggeapp-watchdog.sh'` |
| API returns 502 | Missing/invalid env var in server `.env` | `ssh namecheap 'tail -30 ~/logs/byggeapp_server.log'` to identify the var, then edit `.env` |
| TypeScript type regen fails | `supabase` CLI not in PATH | Install: `npm install -g supabase` or skip — types can be regenerated later |

---

## Post-Deploy Verification

```bash
# API health (public)
curl -sf https://omniware.dk/api/health && echo "API OK"

# Frontend
curl -s -o /dev/null -w "%{http_code}" https://omniware.dk/byggeapp/

# Backend health (via SSH)
ssh namecheap 'curl -sf http://localhost:3002/api/health'
```

---

## Directory Reference

| Path on server | Purpose |
|----------------|---------|
| `~/public_html/byggeapp/` | React SPA static files |
| `~/public_html/api/proxy.php` | PHP reverse proxy → localhost:3002 |
| `~/public_html/api/gemini.php` | PHP direct Gemini AI proxy (never overwritten) |
| `~/public_html/api/.htaccess` | Routes `/api/*` → proxy.php |
| `~/public_html/.htaccess` | SPA fallback for root domain |
| `~/apps/byggeapp_server/` | Node.js backend source |
| `~/apps/byggeapp_server/.env` | Backend secrets (never in git, never overwritten) |
| `~/apps/byggeapp_server/server.pid` | PID of running node process |
| `~/apps/byggeapp_server/start-server.sh` | Manual start helper (server-only, not in git) |
| `~/bin/byggeapp-watchdog.sh` | Process watchdog (started by cron) |
| `~/logs/byggeapp_server.log` | Backend application log |
| `~/nodevenv/apps/byggeapp_server/20/` | Node.js v20 virtual environment |

---

## First-Time Server Setup

See [SERVER_CONFIG.md](SERVER_CONFIG.md) for the complete guide to provisioning a fresh server.

---

## Port Reference

| Port | Purpose |
|------|---------|
| 80 / 443 | HTTP/HTTPS — cPanel / LiteSpeed handles SSL termination |
| 3002 | Node.js backend — localhost only, never publicly exposed |
