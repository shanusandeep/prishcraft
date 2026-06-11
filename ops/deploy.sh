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

echo "==> Uploading website"
ssh "${SSH_OPTS[@]}" "$SERVER" '
  if [ ! -d /srv/spellcraft-site ]; then
    sudo mkdir -p /srv/spellcraft-site && sudo chown "$USER" /srv/spellcraft-site
  fi
'
rsync -az --delete -e "ssh ${SSH_OPTS[*]}" site/ "$SERVER:/srv/spellcraft-site/"

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
  if ! grep -q "spellcraft-site" /srv/dailydose/Caddyfile; then
    cp /srv/dailydose/Caddyfile /srv/dailydose/Caddyfile.bak.$(date +%Y%m%d%H%M%S)
    # drop the old domain block (it was appended last) and write the site+game layout
    sed -i "/# --- PrishCraft on its own domain/,\$d" /srv/dailydose/Caddyfile
    cat >> /srv/dailydose/Caddyfile <<'"'"'EOF'"'"'
# --- PrishCraft: website at the root, the game under /play ---
prishcraft.shanuva.com {
	encode gzip
	handle_path /play* {
		root * /srv/spellcraft
		file_server
	}
	handle {
		root * /srv/spellcraft-site
		file_server
	}
}
EOF
    echo "   Domain block now serves site + /play."
  fi
'

echo "==> Updating docker-compose.override.yml (if needed)"
ssh "${SSH_OPTS[@]}" "$SERVER" '
  OVERRIDE=/srv/dailydose/repo/docker-compose.override.yml
  if ! grep -q "spellcraft-site" "$OVERRIDE" 2>/dev/null; then
    cat > "$OVERRIDE" <<'"'"'EOF'"'"'
# Local-only additions; not in git. Adds the PrishCraft game + site to caddy.
services:
  caddy:
    ports:
      - "8090:8090"
    volumes:
      - /srv/spellcraft:/srv/spellcraft:ro
      - /srv/spellcraft-site:/srv/spellcraft-site:ro
EOF
    echo "   Override updated."
  else
    echo "   Override already current."
  fi
'

echo "==> Opening port 8090 in the firewall (best effort)"
ssh "${SSH_OPTS[@]}" "$SERVER" 'command -v ufw >/dev/null && sudo ufw allow 8090/tcp || true'

echo "==> Restarting caddy with the new mounts/config"
ssh "${SSH_OPTS[@]}" "$SERVER" 'cd /srv/dailydose/repo && docker compose up -d caddy'

echo "==> Verifying"
sleep 3
SITE=$(curl -s -o /dev/null -w '%{http_code}' "https://prishcraft.shanuva.com/")
GAME=$(curl -s -o /dev/null -w '%{http_code}' "https://prishcraft.shanuva.com/play/")
DOSE=$(curl -s -o /dev/null -w '%{http_code}' "http://157.173.198.113/")
echo "   Website   https://prishcraft.shanuva.com/      -> $SITE (want 200)"
echo "   Game      https://prishcraft.shanuva.com/play/ -> $GAME (want 200)"
echo "   DailyDose http://157.173.198.113/              -> $DOSE (want 303/401/200, unchanged)"

if [ "$SITE" = "200" ] && [ "$GAME" = "200" ]; then
  echo "✨ Deployed! Site: https://prishcraft.shanuva.com/ · Game: /play/"
else
  echo "⚠️  Something did not come up — check 'docker compose logs caddy' on the server."
  exit 1
fi
