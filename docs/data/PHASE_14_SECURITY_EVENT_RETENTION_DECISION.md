# Phase 14 Security Event Retention Decision

**Level 4 document.** Revisits RISK-006's `security_events` half (the `product_events` half was
closed in Phase 13 — see `docs/risks/RISK_ARCHIVE.md` ARC-030 and later).

## Current state

`security_events` has **no retention category** in `lib/data-retention.ts` — rows accumulate
indefinitely. Phase 11's own recommendation (`docs/data/PHASE_11_RETENTION_DECISION_MATRIX.md`) was
24 months, derived from the SRS §34's "Administrative logs: at least 24 months" language, but was
never implemented pending explicit approval.

## Considerations

- **Incident investigation**: a security event (auth failures, invalid webhook signatures, rate
  limiting, admin security actions) is exactly the evidence needed to investigate a _past_ incident
  — deleting it too eagerly would remove the ability to retroactively confirm what happened.
- **Security anomaly analysis**: `getRecentAuthFailureCount`/`getRecentWebhookFailureCount` and the
  new Phase 14 `auth.failure_spike`/`billing.webhook_processing_failures` alerts only look at the
  last hour — the 24-month recommendation is about long-term investigative value, not the health
  signals themselves, which would be unaffected by any retention period ≥1 hour.
- **Account-deletion behaviour**: `security_events.user_id` already has `ON DELETE SET NULL` (per
  the schema's actor-reference-survives-account-deletion pattern) — a retained security event
  outlives the account it was about, which is intentional (the event itself, e.g. "this account had
  5 failed logins," remains real historical security evidence independent of whether the account
  still exists).
- **Storage growth**: real volume is currently low (a handful of accounts); even at 24 months'
  retention this table is not a near-term capacity concern per
  `docs/operations/CLOUDFLARE_UPGRADE_TRIGGERS.md`'s thresholds.
- **Privacy**: `security_events` stores `ip_hash` (already hashed, not raw), `user_id` (nullable,
  survives deletion), and a `details` JSON blob whose contents vary by event type — some content
  (e.g. a rate-limit target) could be considered a lighter-weight privacy concern than raw PII, but
  nothing in this table currently stores anything more sensitive than what Phase 12's own security
  audit already reviewed and accepted as necessary for its stated purpose.

## Update 2026-08-14 — implemented

The exact 24-month period this document already reasoned through was explicitly approved by the
product owner in the "Final Phase 0–18 Blocker Removal and Production Release Prompt" §28-29, and
implemented that day: `purgeExpiredSecurityEvents` in `apps/web/src/lib/data-retention.ts`, same
bounded/chunked/dry-run-capable pattern as every other category. See
`apps/web/tests/integration/data-retention.integration.test.ts`'s "RISK-006" describe block for
real-D1 test coverage. RISK-006's `security_events` half is archived —
`docs/risks/RISK_ARCHIVE.md`.

## Decision (historical — superseded by the update above): **RISK-006 remains open for `security_events`**

The Phase 14 prompt's own conditional language is explicit: _"If the Phase 11 recommended periods
are now explicitly accepted by the owner through this Phase 14 prompt, you may implement them...
Otherwise leave the risk open."_ The Phase 14 prompt provided to this session does not contain an
explicit acceptance of the Phase 11-recommended 24-month period — only the conditional instruction
above. Per that instruction's own "otherwise" branch, **no retention category was implemented for
`security_events` this phase**, and RISK-006 is not closed for it. This is a deliberate,
disclosed non-action, not an oversight — implementing a retention policy without an explicit
product-owner decision would be inventing one, which both this document's own reasoning and the
prompt's conditional language explicitly guard against.

## What would need to happen to close this

An explicit, in-the-moment product-owner decision on the retention period for `security_events`
(24 months, matching Phase 11's recommendation, is the only period evaluated and reasoned through
to date) — at which point implementation would reuse the exact `lib/data-retention.ts` category
pattern established in Phase 11/13 (bounded, chunked, per-category try/catch isolation, dry-run
support), not a new mechanism.
