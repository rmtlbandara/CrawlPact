# SSRF Security Model

Full decision record: [ADR-0005](../architecture/adr/ADR-0005-SCANNER-ISOLATION.md), including
the honest DNS-rebinding treatment. This document is the operational checklist implementers and
reviewers use, kept in sync with `packages/scanner/src/safe-fetch.ts`.

## The pipeline (implemented in Part 2)

|   # | Control                                                                                 | Where                                                                                                                      |
| --: | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
|   1 | Scheme allow-list (`http`/`https` only)                                                 | `packages/core/src/domain/normalize.ts`                                                                                    |
|   2 | Reject embedded credentials (`user:pass@host`)                                          | `packages/scanner/src/target-validation.ts`                                                                                |
|   3 | Port allow-list (scheme default only)                                                   | `packages/scanner/src/target-validation.ts`                                                                                |
|   4 | Reject literal IP targets                                                               | `packages/core/src/domain/normalize.ts`                                                                                    |
|   5 | DNS resolution + IP-range classification                                                | `packages/scanner/src/ip-classification.ts` + `dns-resolve.ts`                                                             |
|   6 | Timeouts (connect / first-byte / per-resource / total-scan)                             | `packages/scanner/src/safe-fetch.ts`                                                                                       |
|   7 | Header-size and body-size caps, enforced while streaming, not just via `Content-Length` | `packages/scanner/src/safe-fetch.ts`                                                                                       |
|   8 | Redirect limit (5) + full re-validation of every redirect target (steps 1–5 again)      | `packages/scanner/src/safe-fetch.ts`                                                                                       |
|   9 | External request count cap (~12/scan)                                                   | `packages/scanner/src/orchestrator.ts`                                                                                     |
|  10 | Target blocklist check (before first request and before each redirect)                  | `packages/scanner/src/target-validation.ts`, `blocked_targets` table                                                       |
|  11 | Fixed, non-impersonating user agent                                                     | `packages/scanner/src/safe-fetch.ts`                                                                                       |
|  12 | No cookie retention, no script execution, no form submission, no auth                   | Structural — the scanner never runs a browser or JS engine; `fetch()` is used exactly once per resource with no cookie jar |

## DNS rebinding — do not overstate the guarantee

See ADR-0005's "DNS rebinding: honest treatment" section in full. Summary for anyone extending
this code: **checking a resolved IP does not prove the subsequent `fetch()` call connects to
that same IP.** Cloudflare Workers provide no IP-pinning or post-connection IP-visibility API.
The mitigation is defence-in-depth (steps above) plus the structural fact that Workers have no
network route to arbitrary third-party private infrastructure — not a closed, provable
guarantee. Product copy must never claim otherwise.

## Cloudflare platform limitations (documented, not assumed)

- Outbound `fetch()` from a Worker egresses through Cloudflare's network, not a
  customer-controlled network namespace — this is why private-address rebinding cannot reach
  arbitrary third-party infrastructure, but it also means CrawlPact has **no visibility** into
  Cloudflare's own internal address space or egress filtering rules. Any claim about what a
  Worker "cannot" reach is bounded by Cloudflare's current, undocumented-to-us implementation
  and should be re-verified against Cloudflare's official documentation if this model is ever
  revisited.
- Workers have per-request CPU and wall-clock limits set by the platform (independent of the
  timeouts CrawlPact configures) — a scan must complete within those bounds regardless of the
  target's behaviour; this is an additional, platform-enforced backstop on `total-scan timeout`.
- There is no supported way to prevent the _initial_ DNS lookup for a hostname from reaching a
  resolver outside CrawlPact's control — the lookup itself (via `dns-resolve.ts`'s
  DNS-over-HTTPS call) is a real network request to a third-party resolver (see
  `docs/security/THREAT_MODEL.md` for which resolver and why that's an acceptable dependency,
  distinct from the prohibited "external operational services" in SRS §6.2 since it is a
  standard internet-infrastructure lookup, not a vendor product integration).

## Abuse rate limiting and target blocklist

- Enforced (Part 2 Step 19), not just seeded: anonymous audits are rate-limited per IP against
  `runtime_configuration.anonymous_audit_daily_limit` (default 20/day, operator-tunable without a
  redeploy) — see `apps/web/src/lib/runtime-config.ts` and the check in
  `apps/web/src/pages/api/audit/index.ts`. Exceeding it returns `RATE_LIMITED`, not a silent
  failure, and the check runs _before_ any network fetch.
- `blocked_targets` (SRS §28.8) is enforced on every scan path — anonymous (`/api/audit`), manual
  re-scan, and scheduled monitoring — via `apps/web/src/lib/blocked-targets.ts` feeding the
  scanner's own `validateTarget` blocklist parameter (`packages/scanner/src/target-validation.ts`).
  There is no admin UI to manage this table yet (Part 3/Super Admin); today it's populated
  directly, and the enforcement path is what's implemented and tested in Part 2.
- Every fetch against a blocklisted target is logged to `security_events`
  (`unsafe_scan_attempt`) with the target and an IP hash, so repeated attempts from the same
  source are visible without storing the raw IP.
- A blocked target's scan is never reported as a fabricated success — it surfaces as
  `incomplete`/`target_unavailable`, the same honest-failure path as any other unreachable
  target, and does not reveal _which_ rule caught it beyond that.
- Test coverage: `apps/web/tests/integration/audit-abuse-prevention.integration.test.ts` proves
  both controls against a real D1 database, using at most one real network request total (the
  blocklist check makes zero — see that file's docstring for why).

## Logging and data minimisation

- `security_events.details` never stores full response bodies — only what's needed to
  understand the rejection (target, classification reason, timestamp).
- `scan_resources.snapshot_text` is capped at `max_body_size_bytes` and only stores the
  specific resource fetched (never a full page dump beyond the bounded HTML inspection SRS
  §19.4 describes).
- IP addresses associated with scans/security events are stored as a salted hash
  (`ip_hash`), never raw, consistent with `docs/data/DATA_RETENTION.md`.

## Test obligations (Part 2 — implemented)

Unit tests for every classification/validation category, plus integration fixtures for:
redirect-based SSRF, redirect loops, oversized responses, slow responses, HTML returned as
`robots.txt`, and embedded-credential URLs. See `packages/scanner/src/*.test.ts` and
`packages/scanner/tests/fixtures/`.
