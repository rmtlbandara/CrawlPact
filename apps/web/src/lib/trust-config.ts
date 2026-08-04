/**
 * Central, typed source for verified trust/legal facts referenced across the public site —
 * so a value like "which billing provider" or "when did the privacy policy last change" is
 * defined once, not re-typed independently on every page that mentions it.
 *
 * Established Phase 0 with legal-identity fields deliberately `null` (see git history). Phase 3
 * (Legal Identity, Contact, Security and Trust Foundation, 2026-08-03) filled in the
 * product-owner-approved operator name, jurisdiction, and contact addresses below — see
 * `docs/trust/TRUST_AND_LEGAL_CONFIGURATION.md` for the full record of what was approved and
 * why. `registeredAddress` and `registrationNumber` remain `null` — not a placeholder, not a
 * guess — because that information has not been supplied; do not fill either in without a
 * fresh, explicit product-owner decision recorded in that same document. See
 * `docs/release/LEGAL_INFORMATION_CHECKLIST.md` for the remaining open items.
 *
 * `governingJurisdiction` was removed 2026-08-04 (Public Country Reference and Contact
 * Messaging Correction) at the product owner's explicit instruction — no operating country or
 * jurisdiction is published anywhere on the public site. This is a deliberate, product-owner
 * decision, not an oversight; it is not replaced with another country, a city, a region, or
 * "international"/"global" wording. See `docs/trust/TRUST_AND_LEGAL_CONFIGURATION.md` for the
 * full historical record, and `docs/risks/ACTIVE_RISKS.md` RISK-029 for the resulting open item
 * (Terms of Service no longer publishes a governing-law clause, pending professional legal
 * review before one can be republished).
 */
export const TRUST_CONFIG = {
  productName: "CrawlPact",

  // Approved Phase 3, 2026-08-03 — see docs/trust/TRUST_AND_LEGAL_CONFIGURATION.md. Deliberately
  // no corporate suffix (Ltd./Inc./Pvt Ltd/etc.) — CrawlPact is not represented as a registered
  // company or separate legal person; see docs/release/LEGAL_INFORMATION_CHECKLIST.md.
  legalEntityName: "CrawlPact",

  // Still genuinely unavailable — do not fill with a guessed, virtual, or borrowed address/number.
  registeredAddress: null as string | null,
  registrationNumber: null as string | null,

  // Approved Phase 3 contact addresses. Two real mailboxes, routed by purpose — not four
  // separate inboxes. See docs/trust/TRUST_AND_LEGAL_CONFIGURATION.md for the exact mapping.
  privacyContact: "info@crawlpact.com",
  securityContact: "info@crawlpact.com",
  supportContact: "support@crawlpact.com",
  correctionsContact: "support@crawlpact.com",
  billingContact: "support@crawlpact.com",

  // Verified against actual implementation/configuration, not invented.
  infrastructureProviders: ["Cloudflare"],
  billingProvider: "Paddle",
  analyticsProvider: "Google Analytics",

  // Kept in sync by hand with each page's own "Effective and last updated" line
  // (privacy.astro, terms.astro, acceptable-use.astro) — duplicated here so a
  // future consumer (e.g. a trust-summary page) doesn't have to re-derive it
  // by parsing page content. A review date may only change when the relevant document receives
  // a substantive review — never bumped automatically during an unrelated build.
  policyEffectiveDate: "2026-07-30",
  methodologyLastSubstantiveUpdate: "2026-07-31",
  securityPolicyLastReviewed: "2026-08-03",

  // Fixed at creation from a substantive security-policy review — see
  // docs/trust/TRUST_AND_LEGAL_CONFIGURATION.md. Not recalculated dynamically on every request.
  securityTxtExpiry: "2027-08-03T00:00:00.000Z",

  // Matches packages/database/seed/reference-data.sql's active release —
  // update both together if either changes.
  registryVersion: "2026.07.3",
  rulesetVersion: "2026.07.2",

  dataRetentionSummary:
    "Anonymous scan cache: 24 hours–7 days. Free account history: 30 days. Solo: 12 months. Pro: 24 months. Agency: 36 months. See /privacy for the full table.",

  // Standard short disclosures, reused verbatim or lightly adapted across policies/pages —
  // see docs/trust/TRUST_AND_LEGAL_CONFIGURATION.md. Full paragraphs stay in the pages
  // themselves; only short, exact-wording facts are centralised here.
  merchantOfRecordDescription:
    "Payments are processed by Paddle, which acts as the merchant of record for applicable transactions.",
  responsibleDisclosureContactWording:
    "Report a suspected security vulnerability to info@crawlpact.com.",
  contentCorrectionContactWording:
    "Report an incorrect crawler classification, outdated source, or content issue to support@crawlpact.com.",

  // Canonical relative paths for the trust surfaces this config's facts feed — reused so a
  // route rename only needs updating in one place.
  routes: {
    privacy: "/privacy",
    terms: "/terms",
    security: "/security",
    contact: "/contact",
    status: "/status",
    methodology: "/methodology",
    securityTxt: "/.well-known/security.txt",
  },
} as const;
