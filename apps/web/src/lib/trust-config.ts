/**
 * Central, typed source for verified trust/legal facts referenced across the public site —
 * so a value like "which billing provider" or "when did the privacy policy last change" is
 * defined once, not re-typed independently on every page that mentions it.
 *
 * Legal-identity fields (`legalEntityName`, `registeredAddress`, `governingJurisdiction`,
 * `securityContact`, `privacyContact`, `correctionsContact`) are `null` — not a placeholder
 * string, not a guess — because that information does not yet exist anywhere in this
 * repository or its configuration. See `docs/release/LEGAL_INFORMATION_CHECKLIST.md` for
 * exactly what's missing and what it blocks. Do not fill these in with an invented value;
 * update the checklist first, then this file, together.
 */
export const TRUST_CONFIG = {
  productName: "CrawlPact",

  // Not yet available — see docs/release/LEGAL_INFORMATION_CHECKLIST.md.
  legalEntityName: null as string | null,
  registeredAddress: null as string | null,
  governingJurisdiction: null as string | null,
  securityContact: null as string | null,
  privacyContact: null as string | null,
  correctionsContact: null as string | null,

  // Verified against actual implementation/configuration, not invented.
  infrastructureProviders: ["Cloudflare"],
  billingProvider: "Paddle",
  analyticsProvider: "Google Analytics",

  // Kept in sync by hand with each page's own "Effective and last updated" line
  // (privacy.astro, terms.astro, acceptable-use.astro) — duplicated here so a
  // future consumer (e.g. a trust-summary page) doesn't have to re-derive it
  // by parsing page content.
  policyEffectiveDate: "2026-07-30",
  methodologyLastSubstantiveUpdate: "2026-07-31",

  // Matches packages/database/seed/reference-data.sql's active release —
  // update both together if either changes.
  registryVersion: "2026.07.3",
  rulesetVersion: "2026.07.2",

  dataRetentionSummary:
    "Anonymous scan cache: 24 hours–7 days. Free account history: 30 days. Solo: 12 months. Pro: 24 months. Agency: 36 months. See /privacy for the full table.",
} as const;
