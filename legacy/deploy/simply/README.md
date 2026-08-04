# BygSmart on simply.com — deployment (bygsmart.com + app.bygsmart.com)

simply.com gives us **PHP + SSH but no cPanel / no Node app manager**. So we run
the exact proven omniware pattern: static SPA served directly, and `/api/*`
bridged through **PHP → a background Node process**.

```
bygsmart.com          → ~/public_html/index.html         landing (static HTML)
app.bygsmart.com/     → ~/app/                            static React SPA (LiteSpeed)
app.bygsmart.com/api/ → ~/app/api/.htaccess → proxy.php → 127.0.0.1:3002 → Node/Express
                        Node kept alive by cron (keepalive.sh); NODE_ENV=production
```

Host facts (verified): user `bygsmart.com`, home `/var/www/bygsmart.com`,
CloudLinux 8, system Node **v23** at `/usr/bin/node`, PHP 8.5 with `curl`,
`disable_functions` empty, `crontab` available. ssh alias: **`simply_bygsmart`**.

---

## Files in this folder

| File | Deployed to | Purpose |
|------|-------------|---------|
| `api/proxy.php` | `~/app/api/proxy.php` | PHP reverse proxy → `127.0.0.1:3002` (raw body preserved for Stripe) |
| `api/.htaccess` | `~/app/api/.htaccess` | rewrites `/api/*` → `proxy.php` |
| `app/.htaccess` | `~/app/.htaccess` | SPA fallback + asset caching |
| `server/start.sh` | `~/nodeapp/bygsmart_server/start.sh` | starts Node (`NODE_ENV=production`, pidfile, log) |
| `server/keepalive.sh` | `~/nodeapp/bygsmart_server/keepalive.sh` | cron: restart Node if `/api/health` fails |

Deploy driver: [`../deploy-simply.sh`](../deploy-simply.sh) — `bash deploy/deploy-simply.sh` from repo root.

---

## First-time setup (once)

**1. Provision the server `.env`** at `~/nodeapp/bygsmart_server/.env`
(the deploy never uploads it). Values:

| Copy AS-IS from omniware (`~/apps/byggeapp_server/.env`) | Why |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | same Supabase project |
| `GEMINI_API_KEY` | unchanged |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | same push identity |
| `AI_KEYS_SECRET` | **must match** — it decrypts stored provider keys in the DB |
| `SUPABASE_AUTH_CAPTCHA_SECRET` | same Turnstile secret |

| Change for the new domain |
|---|
| `ALLOWED_ORIGIN=https://app.bygsmart.com,https://bygsmart.com` |
| `VAPID_SUBJECT=mailto:support@bygsmart.com` |
| `DEMO_LOGIN_EMAIL_DOMAIN=demo.bygsmart.com` |

| Set LIVE from the Stripe **live** dashboard |
|---|
| `STRIPE_SECRET_KEY=sk_live_…` |
| `STRIPE_WEBHOOK_SECRET=whsec_…` (the LIVE webhook → `https://app.bygsmart.com/api/stripe-webhook`) |
| `STRIPE_PRICE_PRO_MONTHLY / _PRO_YEARLY / _PREMIUM_MONTHLY / _PREMIUM_YEARLY` (LIVE price IDs — different from test) |

> Never paste live secrets into chat — edit `.env` via SSH or the panel File Manager.
> `NODE_ENV` and `PORT` are set by `start.sh`; do **not** put `NODE_ENV` in `.env`.

**2. Install the keepalive cron** (`crontab -e` over SSH, or panel → Cronjobs):
```
*/3 * * * * /var/www/bygsmart.com/nodeapp/bygsmart_server/keepalive.sh >/dev/null 2>&1
```

**3. SSL** for `bygsmart.com` + `app.bygsmart.com` — panel → HTTPS beskyttelse.

---

## Routine deploy

```bash
bash deploy/deploy-simply.sh
```
Builds the SPA (base `/`), uploads SPA + proxy + landing + server, `npm ci`,
restarts Node, and health-checks both the Node process and the public URL.

## Troubleshooting

```bash
# server log
ssh simply_bygsmart 'tail -40 /var/www/bygsmart.com/logs/bygsmart_server.log'
# is Node up?
ssh simply_bygsmart 'curl -s http://127.0.0.1:3002/api/health'
# manual (re)start
ssh simply_bygsmart '/var/www/bygsmart.com/nodeapp/bygsmart_server/start.sh'
```

- **502 from `/api`** → Node not running (check log / keepalive) or wrong port.
- **Stripe webhook `400 bad signature`** → `STRIPE_WEBHOOK_SECRET` must be the
  **live** webhook's secret; proxy must forward raw body (it does).
- **Node 23 issues** → drop a local Node 20 LTS in `~/node20` and set
  `NODE_BIN=/var/www/bygsmart.com/node20/bin/node` in `start.sh`.
