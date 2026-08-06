# Phase 09 — Bulk Rescan Decision

## Question

Should the agency workspace offer a bulk/multi-domain rescan action?

## Findings (quoted from the SRS)

- SRS §25 "Saved Domains and Monitoring" lists domain-level user actions singularly: "Rename a
  domain / Change its preset / Pause monitoring / Resume monitoring / Move it between groups /
  Delete it / **Trigger a manual rescan within quota**" — phrased per-domain throughout.
- The entitlement table's own row is "**Manual rescans/domain/month**" (SRS §8) — the quota is
  explicitly scoped per domain, not per account or per batch. A bulk rescan of, say, 40 domains at
  once would need to either consume 40 separate per-domain quota units in one action (never
  described anywhere) or invent an account-level quota the SRS does not define.
- "Batch" appears in the SRS in exactly two contexts: the monitoring scheduler's own internal
  "bounded batches" (cron sweep selecting due domains — an implementation detail, not a
  user-facing action) and "Batch import" of new domains (§29). No "batch rescan" or "bulk rescan"
  phrase exists anywhere in the SRS.
- SRS §28.9 (Super Admin): admin can "Trigger an administrative scan," singular — no bulk admin
  rescan trigger either.

## Capacity evidence (Phase 11)

`docs/operations/MONITORING_CAPACITY_PLAN.md` already documents that the _existing_ default
scheduled-sweep batch size (20 domains/cron tick) is likely to exceed the Workers Free CPU budget
per invocation, and recommends lowering it, not raising it. A user-facing bulk-rescan action that
lets an Agency account (up to 100 saved domains) trigger many real external scans synchronously
inside one HTTP request would run directly counter to that finding — the exact "unsafe number of
scans within one request" the Phase 9 prompt's own §6.7 warns against.

## Decision

**Bulk rescan is not authorised and is not implemented in Phase 9.**

Neither condition for proceeding is met: the SRS does not authorise it, and Phase 11's own capacity
analysis says doing it synchronously would be unsafe on the current infrastructure tier. This is a
clean "not authorised or unsafe" case per the prompt's own gate.

## What is provided instead

- Per-domain manual rescan remains exactly as it is today (SRS §25, unchanged by this phase) —
  reachable from the domain-detail page and, for convenience, from the portfolio table's per-row
  action and the attention queue's per-row action (§14's "Run rescan when entitled" — a link to
  the existing single-domain action, not a new bulk primitive).
- The attention queue and portfolio change feed give an agency the ability to identify which
  domains may need a fresh look, without granting a mechanism to scan all of them at once.

## Re-evaluation trigger

Revisit only if a future SRS revision explicitly authorises an account-level (not per-domain)
rescan quota, and Phase 11's monitoring-capacity plan is updated to confirm bounded, queued,
rate-limited bulk scanning is safe on the then-current infrastructure tier (per this document's own
"When authorised" requirements: explicit selection, per-domain quota validation, bounded queue, no
synchronous mass scanning, idempotency, rate limiting, cancellation, progress, partial results, no
hidden quota consumption).
