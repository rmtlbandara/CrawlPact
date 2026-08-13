# Phase 17 Pilot Reliability Review

Status: current-authoritative process document. No active pilot cohort exists yet, so there is
nothing to report an observation _for_ — see §150-151 ("do not invent review records for days
that did not occur").

## Process (to be followed once a pilot is active)

At least weekly during active observation — or at whatever real review points actually occur —
the Super Admin (or an agent acting on their explicit instruction) should inspect, via the
existing Phase 14 operations control plane (`/admin/operations`), and this phase's own pilot
dashboard (`/admin/pilots`):

- Production incidents (Phase 14 `operational_alerts`).
- Failed scans for pilot-participant domains specifically.
- Scheduler/monitoring backlog.
- Billing webhook failures.
- Authentication failures.

Each finding must be classified `target_site_issue` vs. `product_bug` (§101/§151) — e.g. a
pilot participant's own website blocking CrawlPact's scanner is never recorded as a CrawlPact
platform incident.

## Incident handling (§102)

A pilot does not weaken the normal Phase 14 incident process. A real customer-impacting problem
during the pilot uses the same severity/response process as any other production incident —
"only pilot users were affected" is never a reason to suppress or downgrade a real finding.

## Review log

None yet — no active pilot cohort exists as of this phase's technical-readiness checkpoint
(2026-08-11).
