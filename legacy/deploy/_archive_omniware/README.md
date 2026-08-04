# Archived — omniware.dk/byggeapp (retired 2026-07-12)

omniware.dk/byggeapp is decommissioned. bygsmart.com (landing) and
app.bygsmart.com (SPA + API) are the only supported production targets —
see `deploy/deploy-simply.sh` and `deploy/simply/README.md`.

These files drove the old Namecheap cPanel deployment and are kept for
reference/rollback only. Do not run them — the server-side files they
depend on (`~/apps/byggeapp_server`, `~/public_html/byggeapp`,
`~/public_html/api`, `~/bin/byggeapp-watchdog.sh`, its cron entries) were
removed from the Namecheap host on 2026-07-12. A full server-side backup
(including the untracked `.env`) is at
`~/decommission_backups/byggeapp_omniware_20260712_173855.tar.gz` on the
`namecheap` host.

| File | Was |
|---|---|
| `do-deploy.sh` | One-shot deploy entrypoint (`bash do-deploy.sh`) |
| `deploy.sh` | The actual upload/restart driver `do-deploy.sh` called |
| `DEPLOY_GUIDE.md` | Full deploy guide for the Namecheap host |
| `SERVER_CONFIG.md` | From-scratch server setup guide |
| `SERVER_ARCHITECTURE.md` | Topology/runbook doc (moved from `docs/`) |
| `public_html_api/` | `gemini.php` + `proxy.php` + `.htaccess` pulled from the live server before deletion — never tracked in git before this archive |
