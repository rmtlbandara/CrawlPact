# Final Pre-Phase-4 — Observability Readiness

Status 2026-09-11, evidence class: MCP/API (direct Cloudflare API reads).

## Current state

```
Account-wide Logpush jobs:        0
Worker (crawlpact-web) logpush:   false
Worker tail_consumers:            []
Workers Observability config:     not present in the Worker's own settings response
```

There is currently **no automated signal** for 5xx spikes, Worker exceptions, D1 errors, cron
health, auth/WebAuthn/CSRF failure spikes, host-boundary failures, redirect loops, or Paddle
webhook failures. Every check this pass performed against these categories was a manual, ad hoc,
one-off HTTP probe or D1 query — none of it is a standing monitor.

## What Phase 4 needs, at minimum

- 5xx / Worker-exception visibility
- Authentication failure rate (passkey + Google)
- CSRF rejection rate (a spike could indicate either an attack or a boundary regression)
- Paddle webhook failure rate
- Redirect-loop / host-boundary anomaly detection

## Options, not applied this pass

1. **Cloudflare Workers Observability/Logs** — the standard-fit option for a Workers-only stack
   like this one. Enabling it is a real Production configuration change (via `wrangler.jsonc`'s
   `observability` block or the dashboard) with its own retention/sampling/cost profile that
   varies by plan — this account is on Cloudflare's Free Website plan (confirmed earlier this
   migration), so the exact free-tier limits should be confirmed against current Cloudflare
   pricing before enabling, not assumed. Prepared as an option, not implemented — this is exactly
   the kind of "Production feature with billing/availability impact" this pass's own authorization
   boundary requires stopping before applying.
2. **Cloudflare Logpush to an external sink** — more setup, more operationally mature, but a bigger
   lift and likely unnecessary at current traffic volume.
3. **Application-level alerting** — the `security_events` table already captures
   `invalid_paddle_signature` and `rate_limit` events; a lightweight scheduled query against it
   (piggybacking on the existing daily cron) could catch some of the list above without any new
   Cloudflare product, at the cost of not covering raw Worker exceptions or 5xx counts.

## Recommendation (not applied)

Given the account is Free-tier and traffic is currently low, option 3 (extend the existing
scheduled job to alert on `security_events` anomalies) is the lowest-cost, lowest-risk starting
point, with option 1 (Workers Observability) added once traffic or plan tier justifies it. This is
a recommendation for the owner's decision, not something this pass implemented — see
`OWNER_ACTION_QUEUE.md` item 3.

**Phase 4 should not begin with zero cutover-monitoring signal.** This is recorded as a genuine
open item, not classified as non-blocking cosmetic follow-up.
