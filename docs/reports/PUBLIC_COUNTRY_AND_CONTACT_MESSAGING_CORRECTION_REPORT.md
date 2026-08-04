# Public Country Reference and Contact Messaging Correction — Completion Report

Branch `fix/public-country-contact-messaging`, based on `main` at `49bb0cd3524485639bf808d277f61b910890b758`.
Established 2026-08-04.

## Executive summary

At the product owner's explicit instruction, every public reference to CrawlPact's operating
country/jurisdiction ("Sri Lanka", approved Phase 3, 2026-08-03) was removed from the public site
and its generated output — not replaced with another country, city, region, address, or
"international"/"global" wording. The Contact page's negative support-channel wording ("There is
no live chat, phone support, or guaranteed response time") was replaced with a positive 24-hour
response commitment. `pnpm trust:validate` was extended so both the removed country and the
removed negative wording cannot silently return. No product functionality, billing, database
schema, authentication, crawler logic, monitoring, or infrastructure changed.

## Starting point

- Branch created from `main` at `49bb0cd` (Phases 0-4 and the billing race-condition fix all
  merged and deployed to production).
- Repo-wide case-insensitive search for "Sri Lanka" before any edit found exactly 8 files:
  `CHANGELOG.md`, `docs/roadmap/CRAWLPACT_IMPROVEMENT_IMPLEMENTATION_PLAN.md`,
  `docs/release/LEGAL_INFORMATION_CHECKLIST.md`, `docs/risks/ACTIVE_RISKS.md`,
  `docs/trust/TRUST_AND_LEGAL_CONFIGURATION.md`,
  `docs/reports/PHASE_03_LEGAL_SECURITY_TRUST_COMPLETION_REPORT.md`,
  `apps/web/src/lib/trust-config.ts`, `apps/web/src/lib/trust-config.test.ts`, and
  `apps/web/src/pages/contact.astro`.
- Structured-data inspection (`apps/web/src/layouts/BaseLayout.astro`'s JSON-LD `Organization`,
  `ContactPoint`, and `WebSite` nodes) found no `address`, `location`, `areaServed`, or
  `addressCountry` property anywhere — nothing to remove there. No site manifest file exists.
  `robots.txt` has no country reference.

## Public surfaces inspected

Homepage, About, Contact, Privacy Policy, Terms of Service, Security, Status, Methodology,
Corrections process (`/methodology#corrections`), Acceptable Use, Login/signup, Pricing,
`SiteFooter.astro`, `SiteHeader.astro`, `BaseLayout.astro`'s JSON-LD/Open Graph/SEO metadata,
`sitemap.xml.ts`, `robots.txt`, and every `.astro`/`.tsx`/`.ts` file under `apps/web/src` (via the
repo-wide search below). Only three pages and one config file actually referenced the country:
`about.astro`, `contact.astro`, `privacy.astro`, `terms.astro`, and `trust-config.ts` itself.

## Country references found and removed

| Surface                            | Before                                                                                                                                                                            | After                                                                                                                                                                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/lib/trust-config.ts` | `governingJurisdiction: "Sri Lanka"` field                                                                                                                                        | Field removed entirely — no export of any kind for a country/jurisdiction                                                                                                                                                    |
| `/about` "Operator" section        | "{legalEntityName} operates the CrawlPact service from Sri Lanka."                                                                                                                | "{legalEntityName} operates the CrawlPact service."                                                                                                                                                                          |
| `/contact` intro                   | "CrawlPact operates the CrawlPact service from Sri Lanka. There is no live chat, phone support, or guaranteed response time — every category below is a monitored email address." | See "Contact messaging" below                                                                                                                                                                                                |
| `/privacy` §1                      | "{legalEntityName} operates the CrawlPact service from Sri Lanka. For privacy questions..."                                                                                       | "{legalEntityName} operates the CrawlPact service. For privacy questions..."                                                                                                                                                 |
| `/terms` §2                        | "Operator and jurisdiction" — "...These terms are governed by the law of Sri Lanka."                                                                                              | Renamed "2. Operator" — "{legalEntityName} operates the CrawlPact service." (jurisdiction sentence removed, not replaced)                                                                                                    |
| `/terms` §21                       | "Governing law" — "These terms are governed by the law of Sri Lanka, without regard to conflict-of-law principles."                                                               | **Section removed entirely.** Not left as a placeholder or rewritten with an invented jurisdiction, per the correction's explicit rule. `/terms` now runs §1–§22 (renumbered; no dangling cross-references existed to break) |

Per the correction's explicit rule, none of these were replaced with another country, city, region,
registered address, "International," "Global headquarters," or any other location claim.

## Country references intentionally retained internally

Five files retain "Sri Lanka" as an accurate historical record of what Phase 3 previously approved
and why it changed — none of them generate public content, and none are reachable from any public
route:

| File                                            | Reason retained                                                                                                                            | Scanned by `trust:validate`?      |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| `docs/trust/TRUST_AND_LEGAL_CONFIGURATION.md`   | New "Governing jurisdiction removed (2026-08-04)" section records the prior approval and the reversal — explicitly allowlisted (see below) | Yes — allowlisted                 |
| `docs/risks/ACTIVE_RISKS.md`                    | RISK-011 amended, new RISK-029 added, both narrating the change                                                                            | Not scanned (outside `SCAN_DIRS`) |
| `docs/release/LEGAL_INFORMATION_CHECKLIST.md`   | Row updated to show the field is no longer published                                                                                       | Not scanned                       |
| `CHANGELOG.md`                                  | New entry describing the change (quotes the removed wording for an accurate record)                                                        | Not scanned                       |
| `docs/roadmap/...`, `docs/reports/PHASE_03_...` | Pre-existing historical narrative, unedited                                                                                                | Not scanned                       |

`apps/web/src/lib/trust-config.test.ts` and `scripts/trust-validate.mjs` also contain the string
"Sri Lanka" (in a negative test assertion and in the validator's own prohibited-pattern
definitions/allowlist reasons, respectively) — both are source code, not rendered public content,
and both are explicitly excluded from or allowlisted against the validator's own scan.

## Negative support wording found and replaced

"There is no live chat, phone support, or guaranteed response time" — removed entirely, not
rephrased with a softer negative ("limited support," "email-only support," etc., all explicitly
prohibited by the correction).

## Contact messaging (approved replacement)

```
Contact CrawlPact for product support, billing assistance, privacy enquiries, security reports,
or content corrections. Each contact channel below is actively monitored, and we respond to
enquiries within 24 hours.

This is the initial response time; more complex requests may require additional time to
investigate and resolve.
```

This is the exact recommended default from the correction prompt, plus the clarifying sentence
(also explicitly recommended) that the 24-hour figure is an initial-response commitment, not a
resolution guarantee. The word "guaranteed" does not appear anywhere on `/contact` — its removal
also resolved a standing `pnpm brand:validate` warning ("contains unsupported-proof-style
language") that had been present on this page since before this correction.

A new "Related" section was added at the end of `/contact`, linking to Privacy, Terms, Security,
Status, and Methodology — the correction's recommended Contact-page structure item 7, mirroring the
existing pattern already used on `/about`'s "Questions" section.

## Contact addresses verified

Unchanged — all five categories still route to the two approved mailboxes:

| Category                     | Address               |
| ---------------------------- | --------------------- |
| General/privacy              | info@crawlpact.com    |
| Security reports             | info@crawlpact.com    |
| Product support              | support@crawlpact.com |
| Billing support              | support@crawlpact.com |
| Content/registry corrections | support@crawlpact.com |

`pnpm trust:validate`'s existing email-shaped-string scan (which errors on any `@crawlpact.com`
address other than these two) continues to pass — no stale or unapproved address was introduced.

## Structured-data and metadata changes

None required — `BaseLayout.astro`'s JSON-LD `Organization`/`ContactPoint`/`WebSite` nodes never
had an `address`, `location`, `areaServed`, or `addressCountry` property. No Open Graph, page
title, meta description, or site-manifest field referenced the country either. Verified against
the actual production build output (`apps/web/dist/client/`), not just source: a case-insensitive
search of every built HTML file for "Sri Lanka" and each negative-wording phrase returned zero
matches.

## Governing-law handling (legal-review flag)

Per the correction's explicit instruction, the `/terms` "Governing law" section was **removed**,
not rewritten with an invented jurisdiction, a placeholder, or a visible "pending" statement. This
is recorded as **RISK-029** in `docs/risks/ACTIVE_RISKS.md`: the current Terms architecture works
without a governing-law clause, but republishing one requires a fresh, explicit product-owner
decision recorded in `docs/trust/TRUST_AND_LEGAL_CONFIGURATION.md`, ideally after professional
legal review. **This report and the underlying change are not legal advice.**

## Validation enforcement (`pnpm trust:validate`)

`scripts/trust-validate.mjs` was extended with:

- `PROHIBITED_COUNTRY_PATTERNS` — errors on any case-insensitive "Sri Lanka" match across
  `apps/web/src`, `docs/trust`, `docs/privacy`, `docs/security`, `SECURITY.md`, except the two
  narrowly reviewed allowlist entries (`trust-config.test.ts`'s negative assertion,
  `TRUST_AND_LEGAL_CONFIGURATION.md`'s historical record).
- `PROHIBITED_SUPPORT_WORDING_PATTERNS` — errors on "no live chat," "no phone support," "no
  guaranteed response time," or "email-only support" anywhere in the same scanned surfaces.
- A required positive check — `apps/web/src/pages/contact.astro` must contain the 24-hour
  response commitment, or the validator fails.
- The old `governingJurisdiction: "Sri Lanka"` **required-value** check was replaced with the
  inverse: `trust-config.ts` must **not** declare a `governingJurisdiction` field at all.

## Contact addresses / no unapproved additions confirmed

- No country displayed publicly.
- No registered address added.
- No registration number added.
- No tax information added.
- No phone number added.
- No corporate suffix added.
- No "guaranteed" resolution-time wording added.

## Tests executed

| Command                                                                                                  | Result   | Notes                                                                        |
| -------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------- |
| `pnpm run format:check`                                                                                  | ✅ Pass  | after `pnpm run format`                                                      |
| `pnpm run lint`                                                                                          | ✅ Pass  | 0 errors                                                                     |
| `pnpm --filter @crawlpact/web exec astro check`                                                          | ✅ Pass  | 0 errors                                                                     |
| `pnpm run test:unit`                                                                                     | ✅ Pass  | includes updated `trust-config.test.ts`                                      |
| `pnpm run test:integration`                                                                              | ✅ Pass  | unaffected — no backend/billing logic touched                                |
| `node scripts/trust-validate.mjs`                                                                        | ✅ Pass  | new prohibited/positive checks active                                        |
| `node scripts/brand-validate.mjs`                                                                        | ✅ Pass  | the pre-existing "guaranteed" warning on `/contact` is gone                  |
| `node scripts/docs-validate.mjs`                                                                         | ✅ Pass  |                                                                              |
| `pnpm run db:validate`                                                                                   | ✅ Pass  | unaffected                                                                   |
| `pnpm run build`                                                                                         | ✅ Pass  | built output independently grepped for zero country/negative-wording matches |
| `bash scripts/secret-scan.sh`                                                                            | ✅ Pass  |                                                                              |
| `pnpm exec playwright test --project=chromium` (full e2e, incl. new trust-pages/responsive-smoke checks) | ⚠️ 83/84 | see below                                                                    |
| `pnpm test:a11y` (chromium)                                                                              | ✅ Pass  | 84/84                                                                        |

Exact counts/durations captured during actual execution, not assumed — see the PR's CI run for the
authoritative record.

**One unrelated, pre-existing e2e failure found and diagnosed, not fixed here (out of scope)**:
`admin-flows.spec.ts:45` ("an admin can review subscriptions and filter the table") fails
consistently under `astro dev`. Root cause: the test's own `getByText(/no /i)` locator (line 70,
unrelated to this correction) is unscoped and matches Astro's dev-toolbar "Audit" panel text ("No
accessibility or performance issues detected.") instead of the intended in-page empty state — that
exact string does not exist anywhere in this repo's own source. `git diff` against `main` confirms
zero changes to `admin-flows.spec.ts` or any admin subscriptions component/page in this branch.
Astro's dev toolbar only runs under `astro dev`, not the production preview build CI actually
tests against (`ci.yml`'s "Start preview server" step), so this does not affect CI's result — see
the PR's own CI run for confirmation.

## Deployment

**Not deployed as part of this change.** This PR changes public trust copy, contact messaging,
validation, and documentation only — per CLAUDE.md's standing rule, production deployment requires
the user's separate, explicit, in-the-moment authorization, requested after this PR merges.

## Runtime impact

This change modifies public page content (`about.astro`, `contact.astro`, `privacy.astro`,
`terms.astro`), a shared config module (`trust-config.ts`), a validation script, tests, and
documentation only. It does not change crawler evaluation, monitoring, authentication, database
schema, billing logic, Paddle configuration, pricing, plan entitlements, analytics behaviour, or
Cloudflare infrastructure.

## Next phase

Phase 5 (Anonymous Audit Result and Account-Conversion Flow) remains the next roadmap item once
this correction is merged and deployed.
