#!/bin/bash
# Cron keepalive for the BygSmart API. Add via `crontab -e` (or the panel Cronjobs):
#   */3 * * * * /var/www/bygsmart.com/nodeapp/bygsmart_server/keepalive.sh >/dev/null 2>&1
#
# Restarts Node if the health endpoint stops responding (covers both a crashed
# process and a hung-but-alive one).
SERVER_DIR="/var/www/bygsmart.com/nodeapp/bygsmart_server"
PORT="${PORT:-3002}"
PIDF="$SERVER_DIR/server.pid"

# Healthy → nothing to do.
if curl -sf --max-time 6 "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
  exit 0
fi

# Unhealthy or down → clean restart.
[ -f "$PIDF" ] && kill "$(cat "$PIDF" 2>/dev/null)" 2>/dev/null
pkill -f "nodeapp/bygsmart_server/index.js" 2>/dev/null
sleep 1
exec "$SERVER_DIR/start.sh"
