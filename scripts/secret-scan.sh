#!/usr/bin/env bash
# Lightweight local secret scan for `pnpm secrets:scan`. CI additionally runs
# gitleaks (.github/workflows/ci.yml) for broader pattern coverage; this
# script is a fast, dependency-free pre-push check anyone can run locally.
set -euo pipefail

cd "$(dirname "$0")/.."

PATTERN='(AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|sk_live_[0-9a-zA-Z]{16,}|pdl_live_[0-9a-zA-Z]{16,}|xox[baprs]-[0-9a-zA-Z-]{10,})'

MATCHES=$(git grep -nIE "$PATTERN" -- . ':!*.lock' ':!pnpm-lock.yaml' 2>/dev/null || true)

if [ -n "$MATCHES" ]; then
  echo "Potential secret material found:" >&2
  echo "$MATCHES" >&2
  exit 1
fi

echo "secrets:scan: no known secret patterns found in tracked files."
