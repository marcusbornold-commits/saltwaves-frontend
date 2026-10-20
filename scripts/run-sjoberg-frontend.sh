#!/bin/bash
# Sjöberg-sidan (sjoberg.saltwaves.studio → localhost:3092) som produktionsbuild för launchd (studio.saltwaves.sjoberg-frontend).
# Bygg först: cd ~/saltwaves-frontend-sjoberg && npx next build
set -e
cd "$HOME/saltwaves-frontend-sjoberg"
STORAGE_ENV=${STUDIO_STORAGE_ENV:-$HOME/Saltwaves-Audiobook/.env.audiobook}
if [ -r "$STORAGE_ENV" ]; then  # bara Storage-nycklarna för tus; skrivs aldrig ut
  while IFS='=' read -r k v; do case "$k" in AUDIOBOOK_STORAGE_URL|AUDIOBOOK_STORAGE_SERVICE_ROLE_KEY) export "$k=$v";; esac; done < "$STORAGE_ENV"
fi
export NODE_ENV=production
export STUDIO_INVITES_FILE="$HOME/Saltwaves-Audiobook-studio/studio-data/invites.json"
export AUDIOBOOK_STUDIO_API_URL="http://127.0.0.1:8791"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
exec ./node_modules/.bin/next start --port 3092 -H 0.0.0.0
