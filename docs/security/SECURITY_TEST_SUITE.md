# Security Regression Test Suite

**Phase 12 (Security, CI, Dependency and Quality-Gate Improvements), 2026-08-09.**

`pnpm test:security` (`vitest run --project security`) runs a curated, explicit allowlist of
security-relevant test files — defined in `vitest.config.ts`'s `security` project — so the
project's security posture can be verified in one fast command without running the entire suite.
It's part of the canonical `pnpm quality:gate` and runs in CI (`.github/workflows/ci.yml`'s
`quality` job) and in `scripts/verify-push.sh`.

This is an **explicit allowlist, not a naming-convention glob**, by design: a new security-relevant
test must be deliberately added here (reviewed, not silently picked up), so the suite stays a
curated set rather than growing/shrinking unpredictably with unrelated file renames.

## What's covered and why

| File                                                                     | Covers                                                                                                                                                           |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/lib/security-headers.test.ts`                              | CSP/HSTS/X-Frame-Options/Referrer-Policy/Permissions-Policy/X-Content-Type-Options values, and that `middleware.ts` and the static `_headers` file stay in sync. |
| `apps/web/src/pages/.well-known/security.txt.test.ts`                    | `security.txt` contact/disclosure metadata stays correct.                                                                                                        |
| `packages/scanner/src/safe-fetch.test.ts`                                | The SSRF chokepoint (ADR-0005) — scheme allowlist, private/loopback/metadata-IP blocking, redirect re-checks, size/timeout bounds.                               |
| `apps/web/tests/integration/csrf.integration.test.ts`                    | Origin/Referer validation (`require-session.ts`'s `assertSameOrigin`) on authenticated state-changing routes.                                                    |
| `apps/web/tests/integration/audit-abuse-prevention.integration.test.ts`  | Admin target blocklist, per-IP anonymous daily audit limit, target-abuse observation wiring.                                                                     |
| `apps/web/tests/integration/target-abuse-monitoring.integration.test.ts` | Cross-request target-frequency detection (RISK-022) — see `TARGET_ABUSE_MONITORING_DESIGN.md`.                                                                   |
| `apps/web/tests/integration/admin-security.integration.test.ts`          | Security-event recording/listing, admin-only access.                                                                                                             |
| `apps/web/tests/integration/atom-feed-hardening.integration.test.ts`     | Private Atom feed entitlement-at-read enforcement, response header hardening.                                                                                    |

## What isn't in this suite (and where it actually lives)

Authentication/session/WebAuthn flows, billing webhook signature verification, and admin
authorization boundaries are covered extensively elsewhere in `test:unit`/`test:integration` (see
`docs/testing/TEST_STRATEGY.md`) — this suite is a fast, curated subset for a quick security-focused
check, not a replacement for the full suite. `pnpm quality:gate` always runs both.

## Adding a new file

Add the path to `vitest.config.ts`'s `security` project `include` array, and add a row to the table
above explaining what it covers. Don't add a file here just because it happens to touch auth code —
add it because a reviewer scanning this table should be able to tell what security property it
actually verifies.
