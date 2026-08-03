# UX Flows

Source of truth for journeys: SRS §12. This document tracks what is actually built vs. planned.

**Corrected 2026-08-03 (Phase 1)** — this document previously described every journey below as
"not built"/blocked on Part 2/3/5 work that has since shipped. See
`docs/status/CURRENT_STATE.md` and `docs/baseline/2026-08-03/CAPABILITY_MATRIX.md` for current,
evidence-linked capability status; statuses below use that same vocabulary.

## Anonymous audit journey (SRS §12.1) — built, `verified-live`

1. User lands on the home page; hero audit form is in the first viewport, no account required.
2. User enters a domain; client-side normalisation catches obviously invalid input before any
   network call.
3. Server re-validates and normalises (never trusts client validation alone).
4. Bounded safe scan — built (`packages/scanner`, ADR-0005 safe-fetch chokepoint).
5. Crawler policy evaluation — built (`packages/policy`).
6. Report display — built; a real report renders at `/audit/[auditId]` when
   `AUDIT_ENGINE_ENABLED=true` (confirmed live in production); the honest "audit engine not
   enabled" fallback still renders when the flag is off (e.g. local/preview).
   7–10. Preset selection, recommendations, copy guidance, registration prompt — all built.

## Registered monitoring journey (SRS §12.2) — built, `code-present-not-production-verified`

Authentication (ADR-0004) and the scanner are both live. Saved domains, scheduled monitoring, and
change diffing are implemented (`lib/domains.ts`, `lib/monitoring.ts`, `scan_diffs`) — see
`docs/risks/ACTIVE_RISKS.md` for the quantified CPU-budget risk this journey's scheduled-sweep
batch size carries at commercial scale.

## Subscription journey (SRS §12.3) — built, `verified-live` for webhook processing

Paddle integration is live: checkout initiation, webhook processing (verified against real
Paddle-signed production traffic 2026-07-28), and Super Admin billing administration are all
built. A real **paid** checkout lifecycle has not yet been run — see
`docs/risks/ACTIVE_RISKS.md` RISK-001.

## Agency journey (SRS §12.4) — built, `code-present-not-production-verified`

Client groups, batch domain import, and branded client-safe shares are all built
(`domain_groups`, `shared_reports`, R2-backed logo upload since 2026-07-30).

## What is now delivered end-to-end

All four journeys above have a complete, testable UX loop as of this Phase 1 correction — see
`docs/status/CURRENT_STATE.md` for the authoritative, evidence-linked status of each, since
capability status can change (e.g. a flag being toggled) faster than this narrative document is
reviewed.
