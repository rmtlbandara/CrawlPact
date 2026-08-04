# Trust and Legal Configuration

**Level 1 document (Current authoritative).** The single record of what legal/trust facts are
approved for publication, who approved them, and what was deliberately left out. Established Phase
3 (Legal Identity, Contact, Security and Trust Foundation), 2026-08-03. Amended 2026-08-04 (Public
Country Reference and Contact Messaging Correction) — see "Governing jurisdiction removed" below.
Backs `apps/web/src/lib/trust-config.ts` — update both together.

## Approved facts

| Fact                       | Value                               | Approved   | Owner         |
| -------------------------- | ----------------------------------- | ---------- | ------------- |
| Legal/operator name        | CrawlPact (no corporate suffix)     | 2026-08-03 | Product owner |
| Governing jurisdiction     | _(none published — see note below)_ | 2026-08-04 | Product owner |
| Privacy contact            | info@crawlpact.com                  | 2026-08-03 | Product owner |
| Security contact           | info@crawlpact.com                  | 2026-08-03 | Product owner |
| Support contact            | support@crawlpact.com               | 2026-08-03 | Product owner |
| Content-correction contact | support@crawlpact.com               | 2026-08-03 | Product owner |
| Billing contact            | support@crawlpact.com               | 2026-08-03 | Product owner |

## Governing jurisdiction removed (2026-08-04)

Phase 3 (2026-08-03) originally approved and published "Sri Lanka" as CrawlPact's operating
country and Terms of Service governing jurisdiction. On 2026-08-04, the product owner explicitly
instructed removing every public reference to this (or any) country — see the Public Country
Reference and Contact Messaging Correction prompt and
`docs/reports/PUBLIC_COUNTRY_AND_CONTACT_MESSAGING_CORRECTION_REPORT.md`. This is a deliberate
policy reversal, not a data-loss event: the previous value is preserved here only as an accurate
historical record of what was previously approved and why it changed.

**Current state**: no operating country, jurisdiction, or governing-law clause is published
anywhere on the public site (`apps/web/src/lib/trust-config.ts` no longer exports a
`governingJurisdiction` field at all). It was **not** replaced with another country, city, region,
or "international"/"global" wording, per the correction's explicit instruction. Terms of Service
§21 ("Governing law") was removed rather than left with an invented or placeholder value —
`apps/web/src/pages/terms.astro` now runs §1–§22 with no governing-law section. This reopens a
professional-legal-review item, tracked as **RISK-029** in `docs/risks/ACTIVE_RISKS.md`: the
current Terms architecture is written to work without a governing-law clause, but republishing one
in future requires a fresh, explicit product-owner decision recorded in this document, not a
silent reintroduction.

## Intentionally omitted fields

Explicitly **not approved for public inclusion** — do not add any of these without a fresh,
explicit product-owner decision recorded in this document:

- Registered business address
- Registration number
- Tax registration/VAT/GST/TIN
- Any corporate suffix (Pvt Ltd, Private Limited, LLC, Inc., Ltd., Corporation)
- A description of CrawlPact as a registered company, incorporated entity, or separate legal
  person
- Personal names, personal phone numbers, or personal addresses

See `docs/release/LEGAL_INFORMATION_CHECKLIST.md` for what these gaps block and how to close them.

## Legal-page routes and effective dates

| Page                                    | Route             | Effective/last-reviewed                                              |
| --------------------------------------- | ----------------- | -------------------------------------------------------------------- |
| Privacy policy                          | `/privacy`        | 2026-07-30 (`TRUST_CONFIG.policyEffectiveDate`)                      |
| Terms of service                        | `/terms`          | 2026-07-30                                                           |
| Acceptable use                          | `/acceptable-use` | 2026-07-30                                                           |
| Security / responsible disclosure       | `/security`       | 2026-08-03 (`TRUST_CONFIG.securityPolicyLastReviewed`)               |
| Contact                                 | `/contact`        | n/a (no dated claims)                                                |
| Methodology (incl. corrections process) | `/methodology`    | 2026-07-31 (`TRUST_CONFIG.methodologyLastSubstantiveUpdate`)         |
| Status                                  | `/status`         | Live, not a dated policy document                                    |
| `/.well-known/security.txt`             | —                 | Expires `2026-08-03` + ~12 months (`TRUST_CONFIG.securityTxtExpiry`) |

A review date may only change when the relevant document receives a substantive review — never
bumped automatically during an unrelated build.

## Review owners and cadence

Per `docs/governance/DOCUMENTATION_GOVERNANCE.md`'s existing role/cadence tables: legal
documentation (Privacy, Terms, Acceptable use) — **Legal/business owner**, annually or after
material changes. Security documentation (Security page, `security.txt`, `SECURITY.md`) —
**Security owner**, quarterly. Contact/trust routing facts in this document and
`trust-config.ts` — **Product owner**, reviewed whenever a contact address or jurisdiction fact
changes.

## Paddle disclosure

CrawlPact uses Paddle as merchant of record for billing (`TRUST_CONFIG.billingProvider`,
`TRUST_CONFIG.merchantOfRecordDescription`). Paddle processes payment information directly and
handles tax calculation, receipts, and cancellation through its own hosted customer portal.
CrawlPact does not claim that Paddle operates CrawlPact, controls CrawlPact's data practices,
provides CrawlPact customer support, resolves product issues, or is responsible for CrawlPact
service performance — product and account support remains with CrawlPact's own contacts above.

## Source-of-truth configuration

`apps/web/src/lib/trust-config.ts` is the single source these facts are read from in application
code — pages import `TRUST_CONFIG` rather than re-typing any of the above. This document is the
human-readable record of _why_ those values are what they are; the config file is the
machine-readable, type-safe copy consumed by pages, structured data, and `pnpm trust:validate`.

**Registered address, registration number, and tax information are not approved for public
inclusion** and remain `null` in `trust-config.ts` — see "Intentionally omitted fields" above.
