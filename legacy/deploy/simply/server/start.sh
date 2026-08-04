#!/bin/bash
# Start the BygSmart Express API as a background process on app.bygsmart.com.
# Bound to 127.0.0.1:$PORT and fronted by api/proxy.php. simply.com has no panel
# process manager for Node, so keepalive.sh (cron) restarts it if it dies.
#
# NODE_ENV=production is set HERE (not in .env) on purpose: env.js reads it to
# decide dotenv override precedence and to run assertRequiredEnv() at boot.
set -euo pipefail

SERVER_DIR="/var/www/bygsmart.com/nodeapp/bygsmart_server"
NODE_BIN="${NODE_BIN:-/usr/bin/node}"        # override to a local Node 20 LTS if needed
PORT="${PORT:-3002}"
LOG="/var/www/bygsmart.com/logs/bygsmart_server.log"
PIDF="$SERVER_DIR/server.pid"

mkdir -p "$(dirname "$LOG")"
cd "$SERVER_DIR"

# Already running (pid alive)? do nothing.
if [ -f "$PIDF" ] && kill -0 "$(cat "$PIDF" 2>/dev/null)" 2>/dev/null; then
  echo "already running (pid $(cat "$PIDF"))"
  exit 0
fi

APP_VERSION="$(cat "$SERVER_DIR/VERSION" 2>/dev/null || echo unknown)"
NODE_ENV=production PORT="$PORT" APP_VERSION="$APP_VERSION" \
  nohup "$NODE_BIN" index.js >>"$LOG" 2>&1 </dev/null &
echo $! > "$PIDF"
echo "started (pid $(cat "$PIDF")) on 127.0.0.1:$PORT via $NODE_BIN"
