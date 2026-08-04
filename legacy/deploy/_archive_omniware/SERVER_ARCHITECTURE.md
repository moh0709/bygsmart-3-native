# BygSmart 2.1 — Technical Server Architecture

**Status:** Production. Verified 2026-07-08 (backend health 200, `@reboot` + watchdog cron confirmed live).
**Companion docs:** `deploy/SERVER_CONFIG.md` (from-scratch setup), `.claude/skills/deploy/SKILL.md` (deploy runbook), `.claude/skills/testing/SKILL.md` (test runbook).

This document is the single source of truth for *how the running system is wired* — hosts, ports, processes, files, restart/reboot behaviour, secrets, and the request path. Keep it in sync when infrastructure changes.

---

## 1. Topology at a glance

```
                              ┌──────────────────────────── Namecheap shared host ─────────────────────────────┐
                              │  premium196.web-hosting.com  (cPanel + CloudLinux + LiteSpeed/Apache)           │
                              │  cPanel user: omnifkht   ·   SSH: 66.29.132.24:21098                            │
  Browser                     │                                                                                 │
    │  https://omniware.dk/byggeapp/   ──────────────►  ~/public_html/byggeapp/   (static React SPA, Vite build)│
    │                         │                                                                                 │
    │  https://omniware.dk/api/*        ──►  ~/public_html/api/proxy.php  ──►  http://localhost:3002  (Node.js)  │
    │                         │              (PHP reverse proxy + .htaccess)         │                          │
    │  https://omniware.dk/api/gemini.php ──►  ~/public_html/api/gemini.php  (direct PHP → Gemini, NOT Node.js)  │
                              │                                                      │                          │
                              │   Node.js v20 backend  ~/apps/byggeapp_server/index.js  (port 3002, localhost)  │
                              │     process manager: cron watchdog (@reboot + every 5 min)                      │
                              └───────────────────────────────────┬─────────────────────────────────────────────┘
                                                                  │
                                                     Supabase (hosted, external)  project pkzburssqetnlcbvabdq
                                                     PostgreSQL 17 · Auth · Storage · Edge Functions (Stripe webhook)
                                                                  │
                                          Stripe (payments) · Google Gemini (AI) · Web Push (VAPID)
```

**Two independent tiers, each with its own uptime story:**
- **Frontend** — static files. Served by the host's LiteSpeed/Apache. Zero app process to keep alive; it is up whenever the web server is up (host-managed, survives reboot automatically).
- **Backend** — a single Node.js process on `localhost:3002`, kept alive by a cron watchdog (see §5).

---

## 2. Components & responsibilities

| Component | Tech | Location | Port | Notes |
|---|---|---|---|---|
| Frontend SPA | React 18 + Vite build (static) | `~/public_html/byggeapp/` | 443 (via web server) | `index.html` + `assets/*`. SPA routing via root `.htaccess`. |
| API reverse proxy | PHP + Apache `.htaccess` | `~/public_html/api/proxy.php` + `~/public_html/api/.htaccess` | 443 | Rewrites `/api/*` → `localhost:3002`, forwards method/headers/body, strips hop-by-hop headers. |
| AI proxy (Gemini) | PHP | `~/public_html/api/gemini.php` | 443 | **Bypasses Node.js** — direct PHP→Gemini. Independent of backend uptime. |
| Backend API | Node.js v20, Express, ESM | `~/apps/byggeapp_server/index.js` | 3002 (localhost only, not exposed) | Routes incl. `aiRoutes.js`, `aiProviders.js`, `billingSync.js`, `toolAccessRoutes.js`, `routes/contactRoutes.js`. |
| Node runtime env | CloudLinux `nodevenv` | `~/nodevenv/apps/byggeapp_server/20/` | — | Activate with `source ~/nodevenv/apps/byggeapp_server/20/bin/activate`. |
| Process manager | Bash watchdog + cron | `~/bin/byggeapp-watchdog.sh` | — | The **only** process manager. Passenger is NOT relied upon. |
| Database / Auth / Storage | Supabase (external) | `pkzburssqetnlcbvabdq.supabase.co` | 443 | PostgreSQL 17, region eu-west-1. |
| Stripe webhook | Supabase Edge Function (dual-mode) | Supabase | — | Handles both test/live signing secrets + price sets. |
| Logs | Flat files | `~/logs/byggeapp_server.log` | — | App stdout/stderr + watchdog events. |

---

## 3. Request paths (exact)

1. **App shell / any SPA route** → `GET https://omniware.dk/byggeapp/...`
   → Apache serves `~/public_html/byggeapp/index.html` (root `.htaccess` rewrites non-file paths to `index.html` so React Router works on refresh).

2. **App API call** → `... https://omniware.dk/api/<path>`
   → `~/public_html/api/.htaccess` rewrites to `proxy.php?__path=/api/<path>`
   → `proxy.php` curls `http://localhost:3002/api/<path>` (forwards method, headers minus host/content-length, body; adds `X-Forwarded-For`)
   → returns Node's status/body; on connect failure returns **502 `{"error":"Bad Gateway"}`**.

3. **AI (Gemini)** → `... https://omniware.dk/api/gemini.php`
   → PHP calls Gemini directly. **Does not touch Node.js** — so AI stays up even if the backend is down.

4. **Auth / DB / Storage** → the SPA and backend talk to Supabase directly over HTTPS (anon key in the frontend; service-role key server-side only).

---

## 4. Filesystem layout (server)

```
~/public_html/
  byggeapp/                 # frontend build (deploy target)
    index.html
    assets/*
  api/
    proxy.php               # reverse proxy → localhost:3002   (NOT touched by deploy)
    gemini.php              # direct AI proxy                  (NOT touched by deploy)
    .htaccess               # rewrites /api/* → proxy.php       (NOT touched by deploy)
  .htaccess                 # SPA fallback → index.html         (NOT touched by deploy; cPanel may regen)

~/apps/byggeapp_server/     # backend (deploy target for source)
  index.js                  # entry (port 3002)
  routes/, *.js             # aiRoutes, aiProviders, billingSync, toolAccessRoutes, contactRoutes, ...
  package.json / package-lock.json
  node_modules/             # CloudLinux-managed symlink (npm ci --omit=dev --ignore-scripts)
  .env                      # PRODUCTION SECRETS — never overwritten by deploy, never committed
  server.pid                # PID written by watchdog
  start-server.sh           # server-only helper (NOT touched by deploy)

~/nodevenv/apps/byggeapp_server/20/   # CloudLinux Node v20 virtualenv
~/bin/byggeapp-watchdog.sh            # process manager (chmod +x)
~/logs/byggeapp_server.log            # app + watchdog log
```

---

## 5. Uptime & auto-restart — "never offline" model

The system is designed to recover from crashes **and** full host reboots without human action. There are three layers:

### 5.1 Frontend — always up
Static files served by the host's LiteSpeed/Apache. No app process. Comes back with the web server automatically after any reboot. There is nothing to keep alive.

### 5.2 Backend — cron watchdog (the only process manager)
`~/bin/byggeapp-watchdog.sh` checks health and (re)starts the Node process if it is down:
- Health probe: `curl -sf http://localhost:3002/api/health`; fallback: PID-file + `ps` check for `node index.js`.
- If down: kill any zombie on `:3002`, `source` the nodevenv, `nohup node index.js >> log &`, write new PID.
- Because it probes before acting, running it often is safe (it only restarts a genuinely-dead server).

### 5.3 Cron entries (verified live 2026-07-08)
```
@reboot        /home/omnifkht/bin/byggeapp-watchdog.sh   # start on host reboot
*/2 * * * *    /home/omnifkht/bin/byggeapp-watchdog.sh   # self-heal every 2 min
```
> Interval was tightened from 5 → **2 min** on 2026-07-08 to shrink the max backend-only outage after an unexpected crash. `@reboot` handles reboots.

### 5.4 Recovery windows (honest numbers)
| Event | Frontend | Backend |
|---|---|---|
| Backend process crash | unaffected (static) | recovered by the next watchdog tick (≤ 2 min) |
| Full host reboot | auto (web server) | `@reboot` starts it; watchdog is the backstop if `@reboot` is skipped by the host |
| AI (Gemini) during backend downtime | works (separate PHP path) | n/a |

> **Realistic expectation on shared hosting:** true *zero*-downtime is not achievable (no systemd/PM2, host controls reboots). What is guaranteed is **self-healing within the watchdog interval** and **automatic start on reboot**. The interval is the max backend-only outage after an unexpected crash; the frontend and the AI proxy stay up throughout. Tighten the interval to shrink that window (see §5.5).

### 5.5 Tuning the recovery window
Interval is a cron trade-off (more frequent = faster recovery, negligible extra load since the probe is a 3 s curl). To set every 2 minutes while keeping `@reboot`:
```bash
ssh namecheap '(crontab -l 2>/dev/null | grep -v byggeapp-watchdog; \
  echo "@reboot /home/omnifkht/bin/byggeapp-watchdog.sh"; \
  echo "*/2 * * * * /home/omnifkht/bin/byggeapp-watchdog.sh") | crontab -'
ssh namecheap 'crontab -l | grep watchdog'
```

---

## 6. Environment / secrets (backend `~/apps/byggeapp_server/.env`)

Never committed; never overwritten by deploy. Required keys (see `.env.example` for descriptions):

| Key | Purpose |
|---|---|
| `ALLOWED_ORIGIN` | CORS origin (`https://omniware.dk`) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin access (server-only) |
| `GEMINI_API_KEY` | Google Gemini |
| `AI_KEYS_SECRET` | Encrypts stored per-user AI keys (`openssl rand -base64 32`) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe (dual test/live handled per `profiles.user_type`) |
| `STRIPE_PRICE_PRO_*`, `STRIPE_PRICE_PREMIUM_*` | Price IDs (monthly/yearly) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push |
| `DEMO_LOGIN_EMAIL_DOMAIN` | Demo-account domain |

> Frontend build-time env (Vite `VITE_*`, e.g. Supabase URL + anon key) is baked into the static bundle at build time — a rebuild+redeploy is required to change it.

---

## 7. Deploy pipeline (`do-deploy.sh`, Git Bash only)

One command from the project root: `bash do-deploy.sh`. Stages:
1. Git status check → SSH agent + connectivity.
2. `vite build` → `dist/`.
3. Upload frontend → `~/public_html/byggeapp/` (replaces `assets/` + `index.html`).
4. Upload backend source → `~/apps/byggeapp_server/` (excludes node_modules, tests, Dockerfile).
5. `npm ci --omit=dev --ignore-scripts` in the nodevenv.
6. Restart backend (recycle process).
7. **Health-check gate: HTTP 200 on `/api/health`** — the real success signal.
8. Public smoke test: `https://omniware.dk/byggeapp/` → 200.
9. Regenerate `services/database.types.ts` from Supabase.

**Never touched by deploy:** `.env`, `proxy.php`, `gemini.php`, root/api `.htaccess`, `start-server.sh`, and every other app on the host.
**DB migrations** (`supabase/migrations/*.sql`) are applied via the Supabase MCP **before** code deploy — never after. See the deploy skill.

---

## 8. Security posture

- Backend binds `localhost:3002` only — never exposed publicly; all external access goes through the PHP proxy over TLS.
- Service-role key + Stripe secret live only in the server `.env`; the frontend holds only the Supabase anon key.
- SSL: cPanel AutoSSL (Let's Encrypt), auto-renewed.
- Supabase RLS + a column-guard model protect user data; TOTP MFA available. (See the security memories/docs.)
- ⚠️ Known open item tracked separately: rotate any historically-leaked secrets and purge from git history.

---

## 9. Monitoring & recovery quick-reference

```bash
# Backend health (internal)
ssh namecheap 'curl -sf http://localhost:3002/api/health && echo OK'
# Public API (through proxy)
curl -sf https://omniware.dk/api/health && echo "API OK"
# Frontend
curl -s -o /dev/null -w "%{http_code}\n" https://omniware.dk/byggeapp/
# Logs
ssh namecheap 'tail -50 ~/logs/byggeapp_server.log'
# Force a watchdog cycle (manual recover)
ssh namecheap '~/bin/byggeapp-watchdog.sh'
# Port stuck (EADDRINUSE)
ssh namecheap 'lsof -ti:3002 | xargs kill -9; rm -f ~/apps/byggeapp_server/server.pid; ~/bin/byggeapp-watchdog.sh'
# Verify reboot survival is armed
ssh namecheap 'crontab -l | grep -E "reboot|watchdog"'
```

| Symptom | Cause | Fix |
|---|---|---|
| `/api/*` → 502 | Node down on 3002 | watchdog recovers ≤ interval; or run it manually |
| API 502 persists | bad/missing env var | `tail ~/logs/byggeapp_server.log` |
| 404 on SPA refresh | root `.htaccess` regen by cPanel | restore SPA fallback rule |
| `Could not resolve hostname namecheap` | wrong shell | use Git Bash, not PowerShell/WSL |

---

## 10. Change log

- 2026-07-08 — Deployed calculator engineering release (health 200, frontend 200). Verified reboot survival (`@reboot`) and **tightened the watchdog from 5 → 2 min** for faster crash recovery. Authored this doc + the testing/deploy skills.
