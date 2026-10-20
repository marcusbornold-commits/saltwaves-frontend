#!/bin/bash
# Sjöberg-portalen v1 som dev-server på Mac Minin (port 3093, via Tailscale http://100.125.138.87:3093/tools/audiobook/sjoberg/portal).
set -e
cd "$HOME/saltwaves-frontend-sjoberg-portal"
STORAGE_ENV=${STUDIO_STORAGE_ENV:-$HOME/Saltwaves-Audiobook/.env.audiobook}
if [ -r "$STORAGE_ENV" ]; then  # bara Storage-nycklarna; skrivs aldrig ut
  while IFS='=' read -r k v; do case "$k" in AUDIOBOOK_STORAGE_URL|AUDIOBOOK_STORAGE_SERVICE_ROLE_KEY) export "$k=$v";; esac; done < "$STORAGE_ENV"
fi
export STUDIO_INVITES_FILE="$HOME/Saltwaves-Audiobook-studio/studio-data/invites.json"
export AUDIOBOOK_STUDIO_API_URL="http://127.0.0.1:8791"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
exec ./node_modules/.bin/next dev --port 3093 -H 0.0.0.0
