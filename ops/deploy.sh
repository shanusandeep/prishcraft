#!/usr/bin/env bash
# Deploy SpellCraft to the DailyDose VPS as a static site on port 8090.
#
# What it does (idempotent, safe to re-run for every update):
#   1. Builds the production bundle (npm run build).
#   2. Uploads dist/ to /srv/spellcraft on the server.
#   3. Appends a SpellCraft site block to the Caddyfile (only once).
#   4. Adds a docker-compose.override.yml mounting /srv/spellcraft into the
#      caddy container and publishing port 8090 (only once).
#   5. Recreates the caddy container and verifies both sites.
#
# It never modifies the DailyDose :80 site block, app container, or data.
#
# Usage:  bash ops/deploy.sh
set -euo pipefail

SERVER="dailydose@157.173.198.113"
DAILYDOSE_OPS="$HOME/Work/Projects/DailyDose/ops"
KEY="$DAILYDOSE_OPS/keys/dailydose_contabo"
KNOWN_HOSTS="$DAILYDOSE_OPS/known_hosts.d/dailydose_contabo"
SSH_OPTS=(-i "$KEY" -o "UserKnownHostsFile=$KNOWN_HOSTS" -o IdentitiesOnly=yes)

cd "$(dirname "$0")/.."

echo "==> Building production bundle"
npm run build

echo "==> Preparing /srv/spellcraft on the server"
ssh "${SSH_OPTS[@]}" "$SERVER" '
  if [ ! -d /srv/spellcraft ]; then
    sudo mkdir -p /srv/spellcraft && sudo chown "$USER" /srv/spellcraft
  fi
'

echo "==> Uploading dist/"
rsync -az --delete -e "ssh ${SSH_OPTS[*]}" dist/ "$SERVER:/srv/spellcraft/"

echo "==> Adding SpellCraft site to Caddyfile (if not already there)"
ssh "${SSH_OPTS[@]}" "$SERVER" '
  if ! grep -q "SpellCraft" /srv/dailydose/Caddyfile; then
    cp /srv/dailydose/Caddyfile /srv/dailydose/Caddyfile.bak.$(date +%Y%m%d%H%M%S)
    cat >> /srv/dailydose/Caddyfile <<'"'"'EOF'"'"'

# --- SpellCraft (kids game, static files, no auth) ---
:8090 {
	encode gzip
	root * /srv/spellcraft
	file_server
}
EOF
    echo "   Caddyfile updated (backup kept)."
  else
    echo "   Caddyfile already has the SpellCraft block."
  fi
'

echo "==> Adding docker-compose.override.yml (if not already there)"
ssh "${SSH_OPTS[@]}" "$SERVER" '
  OVERRIDE=/srv/dailydose/repo/docker-compose.override.yml
  if [ ! -f "$OVERRIDE" ]; then
    cat > "$OVERRIDE" <<'"'"'EOF'"'"'
# Local-only additions; not in git. Adds the SpellCraft static site to caddy.
services:
  caddy:
    ports:
      - "8090:8090"
    volumes:
      - /srv/spellcraft:/srv/spellcraft:ro
EOF
    echo "   Override created."
  else
    echo "   Override already exists — leaving it alone."
  fi
'

echo "==> Opening port 8090 in the firewall (best effort)"
ssh "${SSH_OPTS[@]}" "$SERVER" 'command -v ufw >/dev/null && sudo ufw allow 8090/tcp || true'

echo "==> Restarting caddy with the new mount/port"
ssh "${SSH_OPTS[@]}" "$SERVER" 'cd /srv/dailydose/repo && docker compose up -d caddy'

echo "==> Verifying"
sleep 3
SPELL=$(curl -s -o /dev/null -w '%{http_code}' "http://157.173.198.113:8090/")
DOSE=$(curl -s -o /dev/null -w '%{http_code}' "http://157.173.198.113/")
echo "   SpellCraft  http://157.173.198.113:8090/  -> $SPELL (want 200)"
echo "   DailyDose   http://157.173.198.113/       -> $DOSE (want 401/200, unchanged)"

if [ "$SPELL" = "200" ]; then
  echo "✨ Deployed! Bookmark http://157.173.198.113:8090/ on the kids' devices."
else
  echo "⚠️  SpellCraft did not come up — check 'docker compose logs caddy' on the server."
  exit 1
fi
