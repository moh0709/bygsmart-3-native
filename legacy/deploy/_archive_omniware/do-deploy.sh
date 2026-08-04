#!/bin/bash
# ============================================================
# BygSmart 2.1 — One-shot deployment script
# Run from project root in Git Bash:   bash do-deploy.sh
#
# Deploys to: namecheap (ssh alias → omniware.dk)
#   Frontend : /home/omnifkht/public_html/byggeapp/
#   Backend  : /home/omnifkht/apps/byggeapp_server/
# ============================================================

set -euo pipefail
cd "$(dirname "$0")"

# ── 1. Clear stale git lock ──────────────────────────────────
if [ -f .git/index.lock ]; then
  echo "==> Removing stale .git/index.lock..."
  rm -f .git/index.lock
fi

# ── 2. Commit any staged docker-compose changes ─────────────
echo "==> Checking git status..."
git add docker-compose.yml 2>/dev/null || true

if git diff --cached --quiet; then
  echo "    (nothing to commit)"
else
  git commit -m "chore: update docker-compose.yml"
  echo "==> Committed."
fi

# ── 3. Verify SSH access ─────────────────────────────────────
echo "==> Verifying SSH access to namecheap..."
# Auto-start ssh-agent if no agent is running
if [ -z "${SSH_AUTH_SOCK:-}" ] || ! ssh-add -l &>/dev/null 2>&1; then
  echo "    Starting ssh-agent..."
  eval "$(ssh-agent -s)" > /dev/null 2>&1
  for key in ~/.ssh/id_ed25519 ~/.ssh/id_rsa ~/.ssh/id_ecdsa; do
    [ -f "$key" ] && ssh-add "$key" 2>/dev/null && break
  done
fi
if ! ssh -o ConnectTimeout=10 namecheap true; then
  echo "ERROR: Cannot reach 'namecheap' SSH alias."
  echo "       Check ~/.ssh/config and your network."
  exit 1
fi
echo "    SSH OK ✅"

# ── 4. Run the deploy ────────────────────────────────────────
bash deploy/deploy.sh

# ── 5. Smoke test ────────────────────────────────────────────
echo ""
echo "==> Smoke testing production URL..."
sleep 4

PROD_URL="https://omniware.dk/byggeapp/"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$PROD_URL" 2>/dev/null || echo "000")

if [ "$HTTP" = "200" ]; then
  echo "    $PROD_URL → $HTTP ✅"
else
  echo "    $PROD_URL → $HTTP  (check: ssh namecheap 'cat ~/logs/byggeapp_server.log | tail -20')"
fi

# ── 6. Regenerate TypeScript database types ──────────────────
echo ""
echo "==> Regenerating TypeScript database types..."
if command -v supabase &>/dev/null; then
  supabase gen types typescript \
    --project-id pkzburssqetnlcbvabdq \
    --schema public \
    > services/database.types.ts && \
  echo "    services/database.types.ts updated ✅" && \
  git add services/database.types.ts && \
  git commit -m "chore: regenerate database.types.ts" || \
  echo "    (no type changes)"
else
  echo "    supabase CLI not found — skipping type regen"
fi

echo ""
echo "All done. Visit: https://omniware.dk/byggeapp/"
