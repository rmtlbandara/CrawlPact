# Phase 09 — Portfolio Report Decision Gate

## Question

Does the current entitlement matrix authorise a distinct multi-domain "portfolio report" artifact
(a combined PDF, combined CSV summary beyond the existing export, or a client-facing portfolio
link) separate from CSV export, group overview, and individual private reports?

## Findings (quoted from the SRS)

- SRS §7.4 (Pro): "Generate print-ready reports" — reads as the existing per-domain report
  generation (same as Solo's "Generate private report links"), not a new artifact type.
- SRS §29 (Agency Features): "View portfolio summaries" and "Generate client-safe links" — a
  dashboard view and per-domain shareable links, not a combined multi-domain document.
- **SRS §12.4 "Agency Journey"** narrates the steps explicitly as _separate_ things: "5. Portfolio
  risk is displayed. 6. The agency opens an individual report. 7. A client-safe report link is
  generated. 8. The agency exports findings where required" — four distinct steps (dashboard view,
  individual report, individual link, CSV export), with no fifth "portfolio PDF/report" step
  anywhere in the journey.
- The roadmap's "Phase 7: Agency" bullet list ("Groups / Batch import / Portfolio dashboard / CSV /
  Client reports / Branding") most plausibly maps "Client reports" onto the already-described
  per-domain client-safe links, since no other part of the SRS describes a different artifact.
- No mention anywhere in the SRS of "agency PDF," "portfolio PDF," or any single combined-document
  format spanning multiple domains.

## Decision

**A multi-domain portfolio-report product is not authorised. It is not built in Phase 9.**

## What is provided instead (all already-authorised primitives)

- **CSV export**, extended in this phase to support group/selection/filtered scope (see
  `CSV_EXPORT_WORKFLOW.md`) — the authorised mechanism for "combined portfolio data," already in
  the entitlement matrix.
- **Individual private reports** per domain, unchanged, optionally Agency-branded (see
  `AGENCY_BRANDING_MODEL.md`).
- **Group overview** (§18) — a per-group summary page using the same explainable domain-state
  counts as the account-wide portfolio summary, giving an agency a "client-level" view without a
  new report artifact.

## Re-evaluation trigger

Revisit only if a future SRS revision explicitly defines: data included, retention, privacy, link
security, branding, maximum domains, generation cost, revocation, and entitlement for a genuine
multi-domain report product (per this document's own "When authorised" checklist) — and pricing
documentation is updated in the same change, since the prompt is explicit that a new Agency
capability must not be added "without updating approved product requirements and pricing
documentation."
