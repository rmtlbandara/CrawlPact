# Legal Information Checklist — Deferred, Scoped Items Only

**Status: partially resolved (Phase 3, 2026-08-03).** The product owner supplied approved values
for the operator name, jurisdiction, and contact rows below during Phase 3 (Legal Identity,
Contact, Security and Trust Foundation) — see
`docs/trust/TRUST_AND_LEGAL_CONFIGURATION.md` for the full record of what was approved and why.
**Registered business address, registration number, and tax information remain genuinely
unresolved** and are not published anywhere — this is not an oversight; publishing a guessed,
virtual, or borrowed value for any of these three rows is explicitly prohibited. The rows still
marked `(not provided)` below are the correct, honest state until the product owner supplies a
real answer — do not fill them with an invented value to "complete" this document.

## Required information

| Field                                 | Value                                                                                                                       | Blocks                                                                                                                         |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Legal/operator name                   | **CrawlPact** (resolved 2026-08-03; no corporate suffix — not represented as a registered company or separate legal person) | Terms of service, privacy policy, footer copyright line, `/.well-known/security.txt` — all now implemented                     |
| Registered business address           | _(not provided)_                                                                                                            | Terms of service, privacy policy (where a controller address is customarily disclosed) — deliberately omitted, not invented    |
| Registration number                   | _(not provided)_                                                                                                            | Any surface that would otherwise cite a company registration number — deliberately omitted, not invented                       |
| Tax information (VAT/GST/TIN)         | _(not provided)_                                                                                                            | Relies on Paddle's own merchant-of-record tax handling instead — see Terms of service §11                                      |
| Governing jurisdiction                | **Sri Lanka** (resolved 2026-08-03)                                                                                         | Terms of service governing-law clause — implemented                                                                            |
| Applicable consumer-protection regime | _(not provided)_                                                                                                            | Terms of service refund/cancellation language uses general, careful wording instead of a jurisdiction-specific regime citation |
| Privacy contact                       | **info@crawlpact.com** (resolved 2026-08-03)                                                                                | Privacy policy contact section, data-subject request handling — implemented                                                    |
| Security-disclosure contact           | **info@crawlpact.com** (resolved 2026-08-03)                                                                                | `/security` page, `/.well-known/security.txt` — both implemented                                                               |
| General support/correction contact    | **support@crawlpact.com** (resolved 2026-08-03)                                                                             | `/contact` page, content/registry-correction process on `/methodology` — both implemented                                      |
| Billing contact                       | **support@crawlpact.com** (resolved 2026-08-03)                                                                             | `/contact` page, Terms of service refund section — implemented                                                                 |

## What is already safe to do without the remaining information

Work that doesn't require a registered address, registration number, or tax information continues
normally: everything else in the product — the operator name, jurisdiction, and contact-routed
legal/privacy/security/support surfaces above — is now implemented per Phase 3. The three
still-blocked items are narrow and specific, not a general legal-work freeze.

## What stays blocked until this is filled in

- A registered business address on any public page or structured-data field.
- A company registration number on any public page or structured-data field.
- Tax registration/VAT/GST/TIN information on any public page — checkout tax handling relies on
  Paddle's own merchant-of-record presentation instead.
- A jurisdiction-specific consumer-protection regime citation in the Terms of Service (the
  governing-law clause itself is now implemented; only a specific regime's refund/cancellation
  rules citation remains open).

## How to close this out

1. Product owner supplies the three remaining values above (directly, or by pointing to where
   they're already registered — e.g. a business registration document).
2. Update this table with the real values and change the file's status line to "resolved (date)"
   — don't delete the historical record of what was missing and when it was filled in.
3. Implement the specific blocked items listed above, each as its own reviewable change.
4. Cross-reference: `docs/risks/ACTIVE_RISKS.md` (RISK-011) and
   `docs/trust/TRUST_AND_LEGAL_CONFIGURATION.md` both point here rather than duplicating this
   list — keep it in one place.
