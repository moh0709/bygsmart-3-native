#!/bin/bash
# ============================================================
# BygSmart 2.1 - Namecheap/cPanel Deployment Script
# Run from the project root:   bash deploy/deploy.sh
#
# Target server : namecheap  (ssh alias → omniware.dk)
# Frontend      : /home/omnifkht/public_html/byggeapp/
# Backend       : /home/omnifkht/apps/byggeapp_server/
# ============================================================

set -euo pipefail

VPS="namecheap"
REMOTE_FRONTEND="/home/omnifkht/public_html/byggeapp"
REMOTE_BACKEND="/home/omnifkht/apps/byggeapp_server"

echo "==> Building production bundle..."
npm run build

# ── Frontend ────────────────────────────────────────────────
echo ""
echo "==> Deploying frontend → $VPS:$REMOTE_FRONTEND ..."
ssh "$VPS" "mkdir -p $REMOTE_FRONTEND"
# Wipe stale JS/CSS chunks so old assets don't accumulate
ssh "$VPS" "rm -rf ${REMOTE_FRONTEND}/assets ${REMOTE_FRONTEND}/index.html"
tar cf - dist | ssh "$VPS" "tar xf - --strip-components=1 -C ${REMOTE_FRONTEND}"
echo "    Frontend uploaded ✅"

# ── Backend ─────────────────────────────────────────────────
echo ""
echo "==> Deploying backend → $VPS:$REMOTE_BACKEND ..."
ssh "$VPS" "mkdir -p ${REMOTE_BACKEND}/tmp"

# Upload JS source files only (exclude Dockerfile, tests, node_modules)
tar cf - \
  --exclude='server/node_modules' \
  --exclude='server/Dockerfile' \
  --exclude='server/*.test.js' \
  --exclude='server/package-lock.json' \
  server \
| ssh "$VPS" "tar xf - --strip-components=1 -C ${REMOTE_BACKEND}"

# Upload the server's own package.json (NOT the frontend root one)
scp server/package.json server/package-lock.json "$VPS:${REMOTE_BACKEND}/" 2>/dev/null || \
  scp server/package.json "$VPS:${REMOTE_BACKEND}/"

echo "    Backend files uploaded ✅"
echo "    NOTE: .env on server is preserved — update manually if new vars are needed."

echo ""
echo "==> Installing backend dependencies..."
# cPanel Node.js uses a virtual environment — source it to get npm in PATH
ssh "$VPS" "source ~/nodevenv/apps/byggeapp_server/20/bin/activate && cd ${REMOTE_BACKEND} && npm ci --omit=dev --ignore-scripts"

# Restart backend — kill old, start fresh.
# NOTE: The SSH restart commands use || true because on Windows/Git Bash the
# backgrounded nohup command causes the SSH client to exit 255 (PTY detach
# quirk). The health check below is the real gate — it will fail the deploy
# if the server does not come up within the timeout.
echo ""
echo "==> Restarting backend..."
ssh "$VPS" 'PID_FILE=~/apps/byggeapp_server/server.pid; [ -f "$PID_FILE" ] && kill "$(cat $PID_FILE)" 2>/dev/null; rm -f "$PID_FILE"; pkill -f "node index.js" 2>/dev/null; true' || true
sleep 3
# APP_VERSION is read from the local (repo-root) package.json — the backend's
# own deploy payload is a standalone directory with no root package.json
# alongside it, so it can't read the file itself (see server/index.js).
APP_VERSION="$(node -p "require('./package.json').version")"
ssh "$VPS" "source ~/nodevenv/apps/byggeapp_server/20/bin/activate && cd ~/apps/byggeapp_server && APP_VERSION='${APP_VERSION}' nohup node index.js >> ~/logs/byggeapp_server.log 2>&1 </dev/null & echo \$! > server.pid" || true
echo "    Backend restart issued ✅"

# Health check
echo ""
echo "==> Verifying backend is up..."
sleep 4
HTTP_CODE=$(ssh "$VPS" 'curl -sf --max-time 8 -o /dev/null -w "%{http_code}" http://localhost:3002/api/health 2>/dev/null || echo "000"')
if [ "$HTTP_CODE" = "200" ]; then
  echo "    Health check passed (HTTP $HTTP_CODE) ✅"
else
  echo "    ⚠️  Health check returned HTTP $HTTP_CODE — check server log:"
  echo "    ssh namecheap 'tail -20 ~/logs/byggeapp_server.log'"
  exit 1
fi

echo ""
echo "Deployment complete."
echo "  Frontend : https://omniware.dk/byggeapp/"
echo "  API      : https://omniware.dk/api/health"
