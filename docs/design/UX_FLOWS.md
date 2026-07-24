# UX Flows

Source of truth for journeys: SRS §12. This document tracks what is actually built vs. planned.

## Anonymous audit journey (SRS §12.1) — partially built

1. ✅ User lands on the home page; hero audit form is in the first viewport, no account
   required.
2. ✅ User enters a domain; client-side normalisation catches obviously invalid input before
   any network call.
3. ✅ Server re-validates and normalises (never trusts client validation alone).
4. ⏳ Bounded safe scan — not implemented (Part 2).
5. ⏳ Crawler policy evaluation — not implemented (Part 2).
6. ⏳ Report display — not implemented; current honest fallback is "audit engine not enabled".
   7–10. ⏳ Preset selection, recommendations, copy guidance, registration prompt — Part 2/3.

## Registered monitoring journey (SRS §12.2) — not built

Blocked on authentication (ADR-0004, Part 3) and the scanner (Part 2). Schema exists
(`domains`, `scans`, `scan_diffs`, `notifications`).

## Subscription journey (SRS §12.3) — not built

Blocked on Paddle integration (Part 5). Schema exists (`billing_customers`, `subscriptions`,
`transactions`, `webhook_events`).

## Agency journey (SRS §12.4) — not built

Blocked on accounts + scanner + billing. Schema exists (`domain_groups`, `shared_reports`).

## What Part 1 actually delivers end-to-end

The only complete, testable UX loop in Part 1 is: **enter a domain → see an honest "not yet
enabled" response**, on both the hero form and every free-tool page. This is intentional — see
the project rule against presenting mocked data as a real scan.
