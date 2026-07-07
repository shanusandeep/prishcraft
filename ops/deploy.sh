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

echo "==> Bundling the Together Mode relay"
npx esbuild server/server.js --bundle --platform=node --format=cjs \
  --outfile=server/dist/server.bundle.cjs --log-level=warning

echo "==> Uploading the relay"
ssh "${SSH_OPTS[@]}" "$SERVER" '
  if [ ! -d /srv/spellcraft-ws ]; then
    sudo mkdir -p /srv/spellcraft-ws && sudo chown "$USER" /srv/spellcraft-ws
  fi
'
rsync -az --delete -e "ssh ${SSH_OPTS[*]}" server/dist/ "$SERVER:/srv/spellcraft-ws/"

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

echo "==> Adding the /ws route to the Caddyfile (if not already there)"
ssh "${SSH_OPTS[@]}" "$SERVER" '
  if ! grep -q "spellcraft-ws" /srv/dailydose/Caddyfile; then
    cp /srv/dailydose/Caddyfile /srv/dailydose/Caddyfile.bak.$(date +%Y%m%d%H%M%S)
    # NEVER sed -i this file: it swaps the inode and the caddy container keeps
    # seeing the old bind-mounted content. cat > rewrites in place instead.
    TMP=$(mktemp)
    sed "/^prishcraft.shanuva.com {/,/^}/ s|^\tencode gzip$|\tencode gzip\n\thandle /ws {\n\t\treverse_proxy spellcraft-ws:8091\n\t}|" /srv/dailydose/Caddyfile > "$TMP"
    cat "$TMP" > /srv/dailydose/Caddyfile
    rm -f "$TMP"
    if grep -q "spellcraft-ws" /srv/dailydose/Caddyfile; then
      echo "   /ws route added."
    else
      echo "   !! could not add the /ws route — Caddyfile layout changed?"
      exit 1
    fi
  else
    echo "   Caddyfile already routes /ws."
  fi
'

echo "==> Updating docker-compose.override.yml (if needed)"
ssh "${SSH_OPTS[@]}" "$SERVER" '
  OVERRIDE=/srv/dailydose/repo/docker-compose.override.yml
  # "dailydose-net" doubles as the version marker: older overrides lacked it
  if ! grep -q "dailydose-net" "$OVERRIDE" 2>/dev/null; then
    cp "$OVERRIDE" "$OVERRIDE.bak.$(date +%Y%m%d%H%M%S)" 2>/dev/null || true
    cat > "$OVERRIDE" <<'"'"'EOF'"'"'
# Local-only additions; not in git. Adds the PrishCraft game + site to caddy,
# and the Together Mode relay for co-op island visits.
services:
  caddy:
    ports:
      - "8090:8090"
    volumes:
      - /srv/spellcraft:/srv/spellcraft:ro
      - /srv/spellcraft-site:/srv/spellcraft-site:ro
  spellcraft-ws:
    image: node:22-alpine
    restart: unless-stopped
    init: true
    command: ["node", "/srv/spellcraft-ws/server.bundle.cjs"]
    volumes:
      - /srv/spellcraft-ws:/srv/spellcraft-ws:ro
    ports:
      - "8091:8091"
    networks:
      - dailydose-net
EOF
    if ! (cd /srv/dailydose/repo && docker compose config -q); then
      echo "   !! new override failed validation — restoring the backup"
      LATEST=$(ls -t "$OVERRIDE".bak.* 2>/dev/null | head -1)
      [ -n "$LATEST" ] && cp "$LATEST" "$OVERRIDE"
      exit 1
    fi
    echo "   Override updated for the relay."
  else
    echo "   Override already has the relay."
  fi
'

echo "==> Validating the new Caddyfile inside the running container"
ssh "${SSH_OPTS[@]}" "$SERVER" '
  cd /srv/dailydose/repo
  DEST=$(docker inspect repo-caddy-1 --format "{{range .Mounts}}{{if eq .Source \"/srv/dailydose/Caddyfile\"}}{{.Destination}}{{end}}{{end}}" 2>/dev/null)
  DEST=${DEST:-/etc/caddy/Caddyfile}
  if docker compose exec -T caddy caddy validate --config "$DEST" --adapter caddyfile >/dev/null 2>&1; then
    echo "   Caddyfile is valid."
  else
    echo "   !! Caddyfile failed validation — restoring the backup"
    LATEST=$(ls -t /srv/dailydose/Caddyfile.bak.* | head -1)
    [ -n "$LATEST" ] && cp "$LATEST" /srv/dailydose/Caddyfile
    exit 1
  fi
'

echo "==> Opening ports 8090/8091 in the firewall (best effort)"
ssh "${SSH_OPTS[@]}" "$SERVER" 'command -v ufw >/dev/null && sudo ufw allow 8090/tcp && sudo ufw allow 8091/tcp || true'

echo "==> Restarting caddy + relay with the new mounts/config"
ssh "${SSH_OPTS[@]}" "$SERVER" 'cd /srv/dailydose/repo && docker compose up -d caddy spellcraft-ws'

echo "==> Reloading the caddy config (config changes alone do not restart it)"
ssh "${SSH_OPTS[@]}" "$SERVER" 'cd /srv/dailydose/repo && docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile'

echo "==> Verifying"
sleep 3
SITE=$(curl -s -o /dev/null -w '%{http_code}' "https://prishcraft.shanuva.com/")
GAME=$(curl -s -o /dev/null -w '%{http_code}' "https://prishcraft.shanuva.com/play/")
DOSE=$(curl -s -o /dev/null -w '%{http_code}' "http://157.173.198.113/")
WS=$(curl -s -o /dev/null -w '%{http_code}' --http1.1 \
  -H 'Connection: Upgrade' -H 'Upgrade: websocket' \
  -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' \
  "https://prishcraft.shanuva.com/ws")
echo "   Website   https://prishcraft.shanuva.com/      -> $SITE (want 200)"
echo "   Game      https://prishcraft.shanuva.com/play/ -> $GAME (want 200)"
echo "   Together  https://prishcraft.shanuva.com/ws    -> $WS (want 101)"
echo "   DailyDose http://157.173.198.113/              -> $DOSE (want 303/401/200, unchanged)"

if [ "$SITE" = "200" ] && [ "$GAME" = "200" ] && [ "$WS" = "101" ]; then
  echo "✨ Deployed! Site: https://prishcraft.shanuva.com/ · Game: /play/ · Together Mode ready"
else
  echo "⚠️  Something did not come up — check 'docker compose logs caddy spellcraft-ws' on the server."
  exit 1
fi
