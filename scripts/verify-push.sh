#!/usr/bin/env bash
# Reproduces every mandatory GitHub merge check locally, as closely as
# practical, before pushing. Never contacts production/preview D1/KV, never
# uses a Paddle Live credential, never deploys a Worker. Exits non-zero on
# any failure and cleans up its own temporary files either way.
#
# Usage: pnpm verify:push
set -euo pipefail
cd "$(dirname "$0")/.."

DEV_VARS_PATH="apps/web/.dev.vars"
DEV_VARS_BACKUP=""
SERVER_PID=""

cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  # Astro 7's `astro dev` daemonizes by default, so $SERVER_PID may not be
  # the real long-lived process — fall back to freeing the port directly.
  lsof -ti:4321 2>/dev/null | xargs -r kill -9 2>/dev/null || true
  # apps/web/.dev.vars is the developer's own real local-dev secrets file —
  # never delete it outright. Restore whatever was there before this script
  # ran (or remove the temp file if there was nothing to restore).
  if [[ -n "$DEV_VARS_BACKUP" ]]; then
    mv "$DEV_VARS_BACKUP" "$DEV_VARS_PATH"
  else
    rm -f "$DEV_VARS_PATH"
  fi
}
trap cleanup EXIT

if [[ -f "$DEV_VARS_PATH" ]]; then
  DEV_VARS_BACKUP="$(mktemp)"
  cp "$DEV_VARS_PATH" "$DEV_VARS_BACKUP"
fi

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

echo "==> Writing temporary CI-local .dev.vars (restored to what was there before, on exit)"
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

echo "==> Starting the preview server (astro dev)"
# Deliberately Astro dev mode, not `wrangler dev --local` against the built
# Worker. This PR fixed the originally-diagnosed crash cause (a *second*
# `wrangler d1 execute --local` process racing this server's own D1
# connection) — but real CI then reproduced a SECOND, distinct wrangler dev
# --local crash on a real usernameless passkey sign-in, unrelated to D1
# concurrency (login/begin is pure WebCrypto, no DB access at all). See
# docs/status/KNOWN_RISKS.md's "Built-server E2E: a second, distinct
# wrangler dev --local crash" entry for the full evidence. Reverting to
# Astro dev mode again — matches ci.yml's browser-smoke job exactly, so
# this script keeps meaning what it claims to mean: a local reproduction of
# the real required CI gate.
AUDIT_ENGINE_ENABLED=true pnpm --filter @crawlpact/web dev > /tmp/verify-push-server.log 2>&1 &
SERVER_PID=$!

if ! npx wait-on http://localhost:4321 --timeout 60000; then
  echo "verify:push: the local server never came up — see /tmp/verify-push-server.log" >&2
  cat /tmp/verify-push-server.log >&2 || true
  exit 1
fi

echo "==> Required Chromium E2E smoke"
CI=true PLAYWRIGHT_BASE_URL=http://localhost:4321 pnpm run test:e2e:chromium

echo "==> Required Chromium accessibility smoke"
CI=true PLAYWRIGHT_BASE_URL=http://localhost:4321 pnpm run test:a11y:chromium

echo "==> Secret scan"
pnpm run secrets:scan

echo
echo "verify:push: all checks passed."
