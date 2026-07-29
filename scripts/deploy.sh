#!/usr/bin/env bash
# Deploys the already-built Worker config for one target environment.
# Usage: deploy.sh <preview|production>
#
# Always run scripts/build.sh for the same target immediately before this —
# the preview/production distinction is baked in at build time (via
# CLOUDFLARE_ENV), not at deploy time. Never add --env to the wrangler
# deploy call below: confirmed empirically that passing --env against this
# already-flattened generated config does nothing but silently deploy
# whatever the config was built as, which is exactly the kind of mistake
# that left Cloudflare Workers Builds' own deploy command broken.
set -euo pipefail
cd "$(dirname "$0")/.."

target="${1:-}"
if [[ "$target" != "preview" && "$target" != "production" ]]; then
  echo "Usage: deploy:<preview|production>" >&2
  exit 1
fi

if [[ "$target" == "production" ]]; then
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "deploy:production: refusing — working tree is not clean." >&2
    exit 1
  fi
  # Deliberately checks the current commit against origin/main's tip by SHA,
  # not by symbolic branch name (git rev-parse --abbrev-ref HEAD): CI checks
  # out an exact commit SHA via actions/checkout's `ref:`, which is always a
  # detached HEAD — abbrev-ref would report literally "HEAD" there, refusing
  # every real CI-driven deploy outright even when it genuinely is main's
  # tip. Confirmed live 2026-07-29: this was the first thing to ever exercise
  # a CI-driven production deploy, and the branch-name check failed it.
  git fetch origin main --quiet || true
  if [[ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]]; then
    echo "deploy:production: refusing — HEAD is not origin/main's current tip. Push or pull first." >&2
    exit 1
  fi
fi

config_path="apps/web/dist/server/wrangler.json"
if [[ ! -f "$config_path" ]]; then
  echo "deploy:$target: refusing — $config_path not found. Run 'pnpm build:$target' first." >&2
  exit 1
fi

pnpm exec wrangler deploy --config "$config_path"
echo "deploy:$target: OK."
