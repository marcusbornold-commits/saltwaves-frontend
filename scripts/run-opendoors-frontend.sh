#!/bin/bash
# Open Doors frontend on 127.0.0.1:3095 (launchd: studio.saltwaves.opendoors-frontend).
# Isolerad från Sjöberg (3092) och live-PodMaster. Produktionsbuild (next start).
set -e
cd "$HOME/saltwaves-frontend-opendoors"
STORAGE_ENV=${STUDIO_STORAGE_ENV:-$HOME/Saltwaves-Audiobook/.env.audiobook}
if [ -r "$STORAGE_ENV" ]; then
  while IFS='=' read -r k v; do
    case "$k" in AUDIOBOOK_STORAGE_URL|AUDIOBOOK_STORAGE_SERVICE_ROLE_KEY) export "$k=$v";; esac
  done < "$STORAGE_ENV"
fi
export NODE_ENV=production
export OPENDOORS_INVITES_FILE="${OPENDOORS_INVITES_FILE:-$HOME/opendoors-test/invites.json}"
export OPENDOORS_API_URL="${OPENDOORS_API_URL:-http://127.0.0.1:8795}"
export OPENDOORS_PUBLIC_URL="${OPENDOORS_PUBLIC_URL:-https://opendoors.saltwaves.studio}"
# Secure-cookie bakom HTTPS-tunneln. Localhost utan Cloudflare är fortfarande undantaget i proxy.ts.
export OPENDOORS_COOKIE_INSECURE=0
# Mejlnotis av tills vidare.
unset OPENDOORS_NOTIFY_ENABLED
# Do not set STUDIO_INVITES_FILE or SJOBERG_NOTIFY_* here.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
exec ./node_modules/.bin/next start --port 3095 -H 127.0.0.1
