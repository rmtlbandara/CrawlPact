#!/usr/bin/env bash
# Reproduces every mandatory GitHub merge check locally, as closely as
# practical, before pushing. Never contacts production/preview D1/KV, never
# uses a Paddle Live credential, never deploys a Worker. Exits non-zero on
# any failure and cleans up its own temporary files either way.
#
# Usage: pnpm verify:push
set -euo pipefail
cd "$(dirname "$0")/.."

DEV_VARS_PATH="apps/web/dist/server/.dev.vars"
SERVER_PID=""

cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$DEV_VARS_PATH"
}
trap cleanup EXIT

echo "==> Checking Node/pnpm versions"
node_version="$(node --version)"
pnpm_version="$(pnpm --version)"
if [[ "$node_version" != v22.12.* && "$node_version" != v22.1[3-9].* && "$node_version" != v22.2*.* ]]; then
  echo "verify:push: expected Node 22.12.x, found $node_version — continuing, but CI pins 22.12.0." >&2
fi
echo "    node $node_version / pnpm $pnpm_version"

echo "==> Confirming no real production/Live credential is present in this shell"
for var in CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID PADDLE_API_KEY PADDLE_WEBHOOK_SECRET; do
  if [[ -n "${!var:-}" ]]; then
    echo "verify:push: refusing — \$$var is set in this shell. Unset it before running verify:push (this command must never be able to reach a real Cloudflare/Paddle account)." >&2
    exit 1
  fi
done

echo "==> Preparing a disposable local D1 database"
pnpm run db:migrate
pnpm run db:seed || echo "    (seed:local reported an error — usually just already-seeded data from a prior local run; continuing)"

echo "==> Format check"
pnpm run format:check

echo "==> Lint"
pnpm run lint

echo "==> Type check"
pnpm run typecheck

echo "==> Unit tests"
pnpm run test:unit

echo "==> Integration tests"
pnpm run test:integration

echo "==> Validate D1 migrations against Drizzle schema"
pnpm run db:validate

echo "==> Production build"
pnpm run build

echo "==> Writing temporary CI-local .dev.vars (git-ignored, deleted on exit)"
mkdir -p apps/web/dist/server
cat > "$DEV_VARS_PATH" << 'DEVVARS'
PUBLIC_APP_ENV=local
PUBLIC_SITE_URL=http://localhost:4321
SESSION_SIGNING_SECRET=ci-placeholder-secret-value-not-real-00000000
WEBAUTHN_RP_ID=localhost
WEBAUTHN_RP_ORIGIN=http://localhost:4321
PADDLE_API_KEY=ci-placeholder
PADDLE_ENVIRONMENT=sandbox
PADDLE_WEBHOOK_SECRET=ci-placeholder
PADDLE_PRICE_ID_SOLO=pri_ci_placeholder
PADDLE_PRICE_ID_PRO=pri_ci_placeholder
PADDLE_PRICE_ID_AGENCY=pri_ci_placeholder
PUBLIC_PADDLE_CLIENT_TOKEN=ci-placeholder
BILLING_ENABLED=false
AUDIT_ENGINE_ENABLED=true
DEVVARS

echo "==> Starting the production-like local Worker (wrangler dev --local)"
# X_LOCAL_EXPLORER disabled: wrangler 4.114.0 enables this AI-agent-oriented
# feature by default; it's not needed for an automated test run, and an
# earlier (since corrected) hypothesis suspected it in a dev-server crash
# found while building this script — disabled defensively regardless of
# whether that suspicion held up. See docs/status/KNOWN_RISKS.md for the
# crash's actual confirmed root cause (global-setup.ts's warmup, now fixed).
X_LOCAL_EXPLORER=false pnpm exec wrangler dev \
  --config apps/web/dist/server/wrangler.json \
  --local \
  --persist-to apps/web/.wrangler/state \
  --port 4321 \
  > /tmp/verify-push-wrangler-dev.log 2>&1 &
SERVER_PID=$!

if ! npx wait-on http://localhost:4321 --timeout 60000; then
  echo "verify:push: the local Worker never came up — see /tmp/verify-push-wrangler-dev.log" >&2
  cat /tmp/verify-push-wrangler-dev.log >&2 || true
  exit 1
fi

echo "==> Required Chromium E2E smoke"
# CI=true matters here, not just cosmetically: without it, playwright.config.ts
# uses its local defaults — multiple parallel workers and its own spawned
# webServer (astro dev) — instead of the single-worker, already-running-
# built-server config this script actually set up. Running many concurrent
# workers against wrangler dev --local this way is what reproduced a real
# Miniflare crash while building this script — see docs/status/KNOWN_RISKS.md.
CI=true PLAYWRIGHT_BASE_URL=http://localhost:4321 pnpm run test:e2e:chromium

echo "==> Required Chromium accessibility smoke"
CI=true PLAYWRIGHT_BASE_URL=http://localhost:4321 pnpm run test:a11y:chromium

echo "==> Secret scan"
pnpm run secrets:scan

echo
echo "verify:push: all checks passed."
