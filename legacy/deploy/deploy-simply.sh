#!/bin/bash
# ============================================================
# BygSmart 2.1 — simply.com deployment  (bygsmart.com + app.bygsmart.com)
# Run from repo root in Git Bash:   bash deploy/deploy-simply.sh
#
# Target: ssh alias 'simply_bygsmart' → linux394.unoeuro.com (user bygsmart.com)
#   Landing (apex) : /var/www/bygsmart.com/public_html/index.html
#   SPA            : /var/www/bygsmart.com/app/            (app.bygsmart.com)
#   API proxy      : /var/www/bygsmart.com/app/api/        (proxy.php + .htaccess)
#   Node server    : /var/www/bygsmart.com/nodeapp/bygsmart_server/
#
# Architecture: static SPA served by LiteSpeed; /api proxied via PHP to a
# background Node process (127.0.0.1:3002) kept alive by cron. See simply/README.md.
#
# NOTE: the server .env is PRESERVED on the server (never uploaded) — it holds the
# live secrets. First-time provisioning: see deploy/simply/README.md.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."   # repo root

VPS="simply_bygsmart"
HOME_REMOTE="/var/www/bygsmart.com"
APP_DOCROOT="$HOME_REMOTE/app"
APEX_DOCROOT="$HOME_REMOTE/public_html"
SERVER_DIR="$HOME_REMOTE/nodeapp/bygsmart_server"
PORT=3002

echo "==> Verifying SSH access to $VPS ..."
ssh -o ConnectTimeout=12 "$VPS" true
echo "    SSH OK ✅"

# ── 1. Build the SPA (base '/' → served at app.bygsmart.com root) ────────────
echo "==> Building SPA (VITE_PUBLIC_BASE_PATH=/) ..."
# MSYS_NO_PATHCONV: on Git Bash (Windows) a lone '/' value is otherwise rewritten
# to the Git-install root, poisoning the build's base path. No-op on Linux.
MSYS_NO_PATHCONV=1 VITE_PUBLIC_BASE_PATH=/ npm run build

# ── 2. Frontend (SPA) → ~/app ────────────────────────────────────────────────
echo "==> Deploying SPA → $VPS:$APP_DOCROOT ..."
ssh "$VPS" "mkdir -p $APP_DOCROOT/api"
# Remove stale hashed assets + entrypoint (keep api/ in place)
ssh "$VPS" "rm -rf $APP_DOCROOT/assets $APP_DOCROOT/index.html"
tar cf - -C dist . | ssh "$VPS" "tar xf - -C $APP_DOCROOT"
scp deploy/simply/api/proxy.php  "$VPS:$APP_DOCROOT/api/proxy.php"
scp deploy/simply/api/.htaccess  "$VPS:$APP_DOCROOT/api/.htaccess"
scp deploy/simply/app/.htaccess  "$VPS:$APP_DOCROOT/.htaccess"
echo "    SPA + proxy uploaded ✅"

# ── 3. Landing site (multi-page) → apex ~/public_html ────────────────────────
echo "==> Deploying landing → $VPS:$APEX_DOCROOT ..."
ssh "$VPS" "mkdir -p $APEX_DOCROOT"
tar cf - -C deploy/landing . | ssh "$VPS" "tar xf - -C $APEX_DOCROOT"
echo "    Landing (index + subpages + assets) uploaded ✅"

# ── 4. Backend (Node/Express) → ~/nodeapp/bygsmart_server ────────────────────
echo "==> Deploying server → $VPS:$SERVER_DIR ..."
ssh "$VPS" "mkdir -p $SERVER_DIR $HOME_REMOTE/logs"
tar cf - \
  --exclude='server/node_modules' \
  --exclude='server/Dockerfile' \
  --exclude='server/*.test.js' \
  --exclude='server/package-lock.json' \
  server \
| ssh "$VPS" "tar xf - --strip-components=1 -C $SERVER_DIR"
scp server/package.json server/package-lock.json "$VPS:$SERVER_DIR/" 2>/dev/null \
  || scp server/package.json "$VPS:$SERVER_DIR/"
scp deploy/simply/server/start.sh deploy/simply/server/keepalive.sh "$VPS:$SERVER_DIR/"
ssh "$VPS" "chmod +x $SERVER_DIR/start.sh $SERVER_DIR/keepalive.sh"
APP_VERSION="$(node -p "require('./package.json').version")"
ssh "$VPS" "printf '%s' '$APP_VERSION' > $SERVER_DIR/VERSION"
echo "    Server files uploaded (v$APP_VERSION) ✅"
echo "    NOTE: server .env preserved — see deploy/simply/README.md if new vars are needed."

# ── 5. Install deps + (re)start via keepalive ────────────────────────────────
echo "==> Installing backend deps ..."
ssh "$VPS" "cd $SERVER_DIR && npm ci --omit=dev --ignore-scripts"

echo "==> Restarting backend ..."
ssh "$VPS" "[ -f $SERVER_DIR/server.pid ] && kill \$(cat $SERVER_DIR/server.pid) 2>/dev/null; pkill -f 'nodeapp/bygsmart_server/index.js' 2>/dev/null; true" || true
sleep 2
ssh "$VPS" "$SERVER_DIR/start.sh" || true
sleep 3

# ── 6. Health checks ─────────────────────────────────────────────────────────
echo "==> Health check (Node direct) ..."
HTTP_NODE=$(ssh "$VPS" "curl -sf --max-time 8 -o /dev/null -w '%{http_code}' http://127.0.0.1:$PORT/api/health || echo 000")
echo "    node 127.0.0.1:$PORT/api/health → $HTTP_NODE"

echo "==> Health check (public, via proxy + SSL) ..."
HTTP_PUB=$(curl -sf --max-time 12 -o /dev/null -w '%{http_code}' https://app.bygsmart.com/api/health || echo 000)
echo "    https://app.bygsmart.com/api/health → $HTTP_PUB"

if [ "$HTTP_NODE" = "200" ]; then
  echo ""
  echo "Deployment complete."
  echo "  Landing : https://bygsmart.com/"
  echo "  App     : https://app.bygsmart.com/"
  echo "  API     : https://app.bygsmart.com/api/health   (public → $HTTP_PUB)"
else
  echo "    ⚠️  Node health != 200 — check: ssh $VPS 'tail -30 $HOME_REMOTE/logs/bygsmart_server.log'"
  exit 1
fi
