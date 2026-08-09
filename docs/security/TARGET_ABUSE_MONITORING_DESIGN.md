# Target-Frequency Abuse Monitoring Design

**Phase 12 (Security, CI, Dependency and Quality-Gate Improvements), 2026-08-09.** Closes
RISK-022 (`docs/risks/ACTIVE_RISKS.md`).

## The gap

The anonymous audit endpoint (`POST /api/audit`) already enforces a per-caller daily limit
(`apps/web/src/lib/auth/rate-limit.ts`'s `isRateLimited`, keyed by an HMAC of the caller's IP). That
control has no visibility into a distributed pattern: many different callers, each individually
well within their own daily limit, all directing scans at the same target. Nothing before this
phase could detect that shape of traffic.

## Design

- **Detection only, never blocking.** No code path anywhere reads from the new table to reject or
  delay a request. The only consumer is a read-only count in the Super Admin operational capacity
  snapshot (`GET /api/admin/capacity`).
- **Privacy-minimized.** The new table (`target_abuse_observations`, migration `0031`) stores two
  opaque HMAC-SHA256 digests per row, never a raw IP or raw target domain:
  - `target_key` — HMAC of the canonical origin, keyed by a **new, dedicated**
    `ABUSE_MONITORING_SECRET`. Deliberately not `SESSION_SIGNING_SECRET` (which already keys
    `hashIp()`'s `caller_key` dimension) — a compromise of one secret doesn't also expose the
    other's correlation.
  - `caller_key` — reuses the existing `hashIp()` output already computed for the per-caller rate
    limit; no new hashing operation or new caller-identifying data is introduced.
- **Recorded only for allowed requests.** `POST /api/audit` records an observation after the
  per-caller rate-limit check passes, not before — a caller who is already rejected with 429 never
  contributes a row. This keeps the signal focused on exactly the gap this closes: many individually
  in-bounds callers hitting one target.

## Detection

`getHighFrequencyTargets()` (`apps/web/src/lib/target-abuse.ts`) groups observations by
`target_key` within a bounded lookback window and flags any target seen by at least N distinct
`caller_key` values. Defaults (`DEFAULT_ABUSE_DETECTION_WINDOW_MS` /
`DEFAULT_ABUSE_DETECTION_MIN_DISTINCT_CALLERS`): a 60-minute window, 10 distinct callers —
deliberately conservative, chosen as a first pass rather than tuned against real production abuse
data (none exists yet). Revisit these constants once real traffic patterns are observed.

## What this does not do

- It does not block, rate-limit, or delay any request differently than before.
- It does not identify a specific caller or a specific target to anyone without a legitimate
  reason to look — the capacity snapshot exposes only a count, never the underlying hashes.
- It does not replace the per-caller rate limit; it complements it.

## Testing

`apps/web/tests/integration/target-abuse-monitoring.integration.test.ts` (dedicated detection-logic
tests: hashing determinism, low-diversity non-flagging, high-diversity flagging, window exclusion,
capacity-snapshot surfacing without raw-value leakage) and one wiring-confirmation test in
`apps/web/tests/integration/audit-abuse-prevention.integration.test.ts`. Also included in
`pnpm test:security` (`docs/security/SECURITY_TEST_SUITE.md`).
