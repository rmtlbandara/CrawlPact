#!/usr/bin/env bash
# Builds the deployable Astro/Cloudflare Worker for one target environment.
# Usage: build.sh <preview|production>
set -euo pipefail
cd "$(dirname "$0")/.."

target="${1:-}"
if [[ "$target" != "preview" && "$target" != "production" ]]; then
  echo "Usage: build:<preview|production>" >&2
  exit 1
fi

# A machine-local .dev.vars silently overrides apps/web/wrangler.jsonc's
# committed vars during Astro's static prerendering (@astrojs/cloudflare's
# platformProxy reads it ahead of anything else, regardless of any shell
# env var passed to this script) — confirmed live: the current production
# deploy was built from a machine with .dev.vars present, and every
# prerendered marketing page shipped with a "Local Development environment"
# banner baked into its static HTML as a result. Building for
# preview/production must only ever happen from a checkout with no
# .dev.vars at all — exactly what a fresh GitHub Actions checkout is.
if [[ -f .dev.vars || -f apps/web/.dev.vars ]]; then
  echo "build:$target: refusing to build — a .dev.vars file exists in this checkout." >&2
  echo "  Building preview/production from a machine with local dev vars present" >&2
  echo "  silently bakes those local values into every prerendered page (see" >&2
  echo "  docs/status/KNOWN_RISKS.md). Run this from a clean checkout instead." >&2
  exit 1
fi

if [[ "$target" == "preview" ]]; then
  export CLOUDFLARE_ENV=preview
  export PUBLIC_SITE_URL="https://crawlpact-web-preview.rmtlbandara.workers.dev"
else
  export PUBLIC_SITE_URL="https://crawlpact.com"
fi

pnpm --filter @crawlpact/web run build
echo "build:$target: OK — apps/web/dist/server/wrangler.json is ready to deploy."
