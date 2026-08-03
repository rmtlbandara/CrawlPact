# Documentation Governance

Defines document types, ownership, review cadence, and update triggers for CrawlPact's
documentation. Established Phase 1 (Repository Documentation and Source-of-Truth Correction),
2026-08-03.

## Source-of-truth hierarchy

1. **Current authoritative** — describes what is currently true: `README.md`,
   `docs/status/CURRENT_STATE.md`, `CHANGELOG.md`,
   `docs/roadmap/CRAWLPACT_IMPROVEMENT_IMPLEMENTATION_PLAN.md`, `docs/risks/ACTIVE_RISKS.md`,
   architecture decision records, current legal/security/registry/billing/operational documents,
   machine-readable configuration and code.
2. **Requirements and product intent** — describes what the product is intended or required to
   do: the current SRS, `docs/product/PRODUCT_SCOPE.md`, `docs/status/REQUIREMENTS_TRACEABILITY.md`,
   approved architecture decisions, approved brand/messaging specifications. **Never presented as
   proof a feature is live** — that's Level 3's job.
3. **Evidence and completion reports** — proves what was tested, deployed, audited, or completed:
   phase completion reports, production deployment records, security/SEO/billing audit reports,
   test evidence, the Phase 0 baseline.
4. **Historical and archived material** — explains past states, not authoritative for the
   current product: `docs/archive/`, `docs/status/KNOWN_RISKS.md` (narrative source),
   superseded completion reports, deprecated plans, resolved-risk history.

When two documents disagree, the higher-numbered level never overrides a lower-numbered one —
Level 1 (current authoritative) wins, checked against direct production observation first.

## Document types

Current state · Requirements · Architecture · Operations · Security · Legal · Billing · Registry ·
Risk · Evidence · Historical.

## Owners (roles, not personal names)

| Role                 | Owns                                                                     |
| -------------------- | ------------------------------------------------------------------------ |
| Product owner        | Product scope, brand/positioning, SRS interpretation, roadmap priorities |
| Engineering owner    | Architecture, code-level documentation, test strategy, database schema   |
| Security owner       | Security checklist, threat model, auth/SSRF/CSP documentation            |
| Operations owner     | Deployment, runbooks, capacity planning, incident response               |
| Registry owner       | Crawler registry governance, source verification policy                  |
| Legal/business owner | Legal information checklist, licensing, jurisdiction/entity decisions    |
| Billing owner        | Paddle configuration, billing security, plan/pricing documentation       |

## Review cadence

| Document type                                               | Cadence                               |
| ----------------------------------------------------------- | ------------------------------------- |
| `docs/status/CURRENT_STATE.md`                              | Every release, or monthly             |
| `docs/risks/ACTIVE_RISKS.md`                                | Monthly                               |
| Registry methodology (`docs/registry/*`)                    | Every registry release                |
| Security documentation                                      | Quarterly                             |
| Legal documentation                                         | Annually, or after material changes   |
| Billing documentation                                       | After any Paddle/configuration change |
| `README.md`                                                 | After material repository changes     |
| `docs/roadmap/CRAWLPACT_IMPROVEMENT_IMPLEMENTATION_PLAN.md` | After each phase                      |
| Archived documents (`docs/archive/`)                        | No routine updates                    |

## Update triggers

Documentation must be updated in the same change (not a follow-up) when:

- A feature is enabled or disabled
- A production deployment changes capability status
- A migration is applied
- Registry version changes
- Pricing changes
- Paddle product configuration changes
- Analytics changes
- Legal identity changes
- A risk is opened or closed
- A phase is completed
- Architecture decisions change
- A public claim changes

## Required pull-request checks

Every material pull request should answer:

- Does this change current product capability?
- Does `docs/status/CURRENT_STATE.md` need updating?
- Does `CHANGELOG.md` need updating?
- Does `docs/risks/ACTIVE_RISKS.md`/`RISK_ARCHIVE.md` need updating?
- Does `docs/status/REQUIREMENTS_TRACEABILITY.md` need updating?
- Does architecture documentation need updating?
- Does pricing or legal documentation need updating?

## No unsupported claims

Every capability status in a current-authoritative document must use the approved status
vocabulary (`verified-live` · `verified-disabled` · `verified-partial` ·
`code-present-not-production-verified` · `documented-only` · `historical-only` · `unknown` ·
`verification-blocked`) and name or link its evidence. Do not use ambiguous labels ("Done",
"Ready", "Complete", "Available", "Implemented") without specifying whether the claim refers to
code, test coverage, production deployment, production configuration, user availability, or
recent operational verification — these are six distinct things, not one word. See
`docs/status/CURRENT_STATE.md`'s capability table for the pattern.

## How historical material is handled

Move a document to `docs/archive/implementation-history/` (or an equivalent dated subdirectory)
when it's superseded, not when it's merely old — a document that's still the accurate current
description of something doesn't move just because time has passed. Every archived file must
begin with a historical notice: original date, archive date, superseded-by link, reason archived
(see any file under `docs/archive/implementation-history/` for the exact pattern). Never delete a
document that carries real audit or deployment evidence — archive it instead.

## Validation

`pnpm docs:validate` (see `scripts/docs-validate.mjs`) enforces required-file presence, approved
status vocabulary, known-stale-claim detection in current-authoritative documents, archive-notice
presence, and duplicate current-state-ownership detection. Run as part of `pnpm quality` and in
CI on any pull request touching documentation, configuration, or package scripts.
