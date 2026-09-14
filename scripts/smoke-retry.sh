#!/usr/bin/env bash
# Bounded, propagation-aware retry wrapper for a read-only smoke command.
#
# Real Stage-A deployment evidence (2026-09-14, deploy-production.yml run
# 34835290020) showed the smoke step observing stale pre-deploy Worker
# behavior for a few seconds immediately after `wrangler deploy` returns —
# ordinary Cloudflare edge-propagation lag, not a routing defect (confirmed
# by an independent re-run of the identical smoke suite ~18 minutes later:
# 43/43 passed with no redeploy in between). This wrapper retries the SAME
# complete command a bounded number of times with a short delay/backoff, so
# a transient propagation window doesn't fail an otherwise-successful
# deployment — while a genuinely persistent failure still fails the caller
# exactly as before.
#
# Hard invariants (do not weaken any of these):
#   - never redeploys anything — this script only re-invokes the command
#     it's given, verbatim, every attempt;
#   - bounded attempts, never indefinite/unbounded polling;
#   - every attempt's outcome is logged;
#   - a persistent failure across all attempts still exits non-zero.
#
# Usage: scripts/smoke-retry.sh <command...>
# Tunable via env (all optional, used by tests to run fast):
#   SMOKE_RETRY_MAX_ATTEMPTS        (default 3)
#   SMOKE_RETRY_INITIAL_DELAY_SECONDS (default 15)
#   SMOKE_RETRY_BACKOFF_SECONDS     (default 20)
set -euo pipefail

MAX_ATTEMPTS="${SMOKE_RETRY_MAX_ATTEMPTS:-3}"
INITIAL_DELAY_SECONDS="${SMOKE_RETRY_INITIAL_DELAY_SECONDS:-15}"
BACKOFF_SECONDS="${SMOKE_RETRY_BACKOFF_SECONDS:-20}"

if [ "$#" -lt 1 ]; then
  echo "Usage: smoke-retry.sh <command...>" >&2
  exit 2
fi

if [ "$INITIAL_DELAY_SECONDS" -gt 0 ]; then
  echo "[smoke-retry] waiting ${INITIAL_DELAY_SECONDS}s for edge propagation before the first attempt..."
  sleep "$INITIAL_DELAY_SECONDS"
fi

attempt=1
while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
  echo "[smoke-retry] attempt ${attempt}/${MAX_ATTEMPTS}: $*"
  if "$@"; then
    echo "[smoke-retry] attempt ${attempt}/${MAX_ATTEMPTS} succeeded."
    exit 0
  fi
  echo "[smoke-retry] attempt ${attempt}/${MAX_ATTEMPTS} failed."
  if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
    if [ "$BACKOFF_SECONDS" -gt 0 ]; then
      echo "[smoke-retry] waiting ${BACKOFF_SECONDS}s before retrying (same command, no redeploy)..."
      sleep "$BACKOFF_SECONDS"
    fi
  fi
  attempt=$((attempt + 1))
done

echo "[smoke-retry] all ${MAX_ATTEMPTS} attempts failed — failing." >&2
exit 1
