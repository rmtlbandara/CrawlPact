---
name: security-review
description: Focused review of CrawlPact's security-critical boundaries — scanner SSRF containment, authentication, billing webhooks, and admin authorisation — against the documented threat model.
---

# Security Review

A narrower, deeper check than the general code-review skill, scoped to the four areas the SRS
treats as launch-blocking (§33).

## 1. Scanner / SSRF (packages/scanner)

- Confirm no code outside `packages/scanner` makes a `fetch()` call against a value derived
  from user input.
- Confirm every classification path in `ip-classification.ts` is exercised by a test
  (`ip-classification.test.ts`) — public, loopback, private (all three RFC1918 ranges), 100.64/10
  shared space, link-local/cloud-metadata, multicast, reserved, invalid, plus the IPv6
  equivalents and the IPv4-mapped-IPv6 smuggling case.
- If a fetch orchestrator exists (Part 2+), confirm redirect destinations are re-validated, not
  just the initial target.

## 2. Authentication (once implemented, Part 3+)

- Sessions are DB-backed and individually revocable — no stateless JWT holding authority.
- Recovery codes are stored only as hashes, single-use, shown once.
- Sensitive actions require a recent-authentication check, not just a valid session.

## 3. Billing (once implemented, Part 5+)

- Webhook signature verification happens against the raw request body.
- Processing is idempotent by `paddle_event_id`.
- No local code treats itself as the source of truth over Paddle for entitlement state.

## 4. Admin (once implemented, Part 6+)

- Every sensitive admin action requires a reason and produces an `admin_audit_logs` row.
- Role checks happen server-side; never trust a client-supplied role claim.

## Reporting

For each area, report: what was checked, what passed, what's not yet applicable (state why —
e.g. "no auth code exists yet"), and any finding with a concrete failure scenario, not a vague
"could be more secure" comment. Use the `ReportFindings` format if invoked as part of a broader
review flow.
