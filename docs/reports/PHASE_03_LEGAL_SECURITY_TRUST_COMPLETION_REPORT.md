# Phase 3 — Legal Identity, Contact, Security and Trust Foundation — Completion Report

Branch `phase-03-legal-security-trust-foundation`, based on `main` at `e025bb3` (Phases 0-2
merged). Established 2026-08-03.

## Executive summary

Before this phase, CrawlPact had **zero contact email addresses anywhere in the repository**, no
`/contact` page, no `/.well-known/security.txt`, no content/registry-correction process, and every
legal-identity field in `apps/web/src/lib/trust-config.ts` was deliberately `null` (RISK-011).
Phase 3 filled in the product-owner-approved operator name ("CrawlPact", no corporate suffix),
governing jurisdiction ("Sri Lanka"), and five contact addresses; created `/contact` and
`/.well-known/security.txt`; rewrote `/privacy` and `/terms` to a complete, code-verified
structure; added a full responsible-disclosure policy to `/security`; and added a
content/registry-correction process to `/methodology`. Registered business address, registration
number, and tax information remain genuinely unresolved and were not invented.

Two research passes verified current product behaviour directly against code (account deletion,
data retention, Paddle billing/cancellation/refunds, analytics/cookies, IP handling,
security-event recording) before any policy text was written, per the phase's own instruction not
to claim a capability or process that doesn't exist. This surfaced one real, previously-undetected
inaccuracy: `/terms` and `/acceptable-use` both claimed users may "only submit domains you own,
manage, or are otherwise authorised to audit" — but the free/anonymous audit path has **no
ownership-verification logic at all**, by design. Both pages were corrected to require lawful and
responsible use instead, without weakening the real abuse/safety prohibitions.

## Starting point

- Branch created from `main` at `e025bb3` (Phase 0 PR #68, Phase 1 PR #69, Phase 2 PR #70 all
  merged).
- Existing trust pages: `/privacy`, `/terms`, `/acceptable-use`, `/security`, `/about`, `/status`,
  `/methodology`, `/limitations`, `/scanner`, `/scoring` — all read in full before editing.
- Existing contacts: none (zero `mailto:` links, zero `@crawlpact.com` addresses anywhere).
- Existing legal placeholders: none — `trust-config.ts` used `null`, not placeholder strings,
  consistent with the repository's own no-fabrication rule.
- Existing security reporting: `/security` pointed to a stale root `SECURITY.md` ("no live
  scanner, authentication, billing, or admin surface exists yet — Part 1"), long since false.
- Existing merchant-of-record wording: `/terms` already correctly described Paddle's role; carried
  forward and expanded.

## Approved identity

- Legal/operator name: **CrawlPact** (no corporate suffix; not represented as a registered
  company or separate legal person)
- Governing jurisdiction: **Sri Lanka**
- Privacy contact: **info@crawlpact.com**
- Security contact: **info@crawlpact.com**
- Support contact: **support@crawlpact.com**
- Content-correction contact: **support@crawlpact.com**
- Billing contact: **support@crawlpact.com**

## Intentionally omitted

- Registered business address — not provided, not invented.
- Registration number — not provided, not invented.
- Tax information (VAT/GST/TIN) — not provided; checkout tax handling relies on Paddle's own
  merchant-of-record presentation instead.

Confirmed via `pnpm trust:validate` (which fails if `registeredAddress`/`registrationNumber` are
non-null, or if any placeholder/prohibited-suffix pattern is detected) that none of the above were
invented or published anywhere.

## Public implementation

**Pages created**: `/contact` (`apps/web/src/pages/contact.astro`),
`/.well-known/security.txt` (`apps/web/src/pages/.well-known/security.txt.ts`, generated from
`TRUST_CONFIG` rather than hand-written, so it cannot drift).

**Pages rewritten**: `/privacy` (full required structure — operator/jurisdiction, service-vs-audit
data distinction, cookies, analytics, billing/Paddle, sharing/processors, international
processing, retention, security, rights, children, third-party websites, policy changes,
contact), `/terms` (full 23-section required structure — agreement, operator/jurisdiction,
eligibility, account responsibilities, service description, product boundaries, acceptable use,
user-submitted domains, registry/methodology, recommendations, billing, refunds, IP, feedback,
third-party services, availability, suspension, disclaimers, liability, no-guarantee, governing
law, changes, contact).

**Pages corrected (minor)**: `/acceptable-use` (ownership-claim inaccuracy fixed, safety
prohibitions retained and one added: "using CrawlPact to harass, probe, or attack a website you do
not operate"), `/about` (operator/jurisdiction wording, contact/security/status links added),
`/security` (full responsible-disclosure section added: scope, contact, reporter guidance,
prohibited testing, response/disclosure expectations), `/methodology` (content/registry-correction
process section added).

**Footer changes**: `SiteFooter.astro`'s "Company and legal" column gained a "Contact" link — an
additive deviation from SRS §9.19's literal footer list, recorded in
`docs/trust/LEGAL_AND_TRUST_SURFACE_INVENTORY.md` §E rather than silently introduced.

**Metadata/structured-data changes**: `BaseLayout.astro`'s JSON-LD `Organization` node gained
three `ContactPoint` entries (customer support, privacy, security), reading from `TRUST_CONFIG`
rather than hardcoded strings. `sitemap.xml.ts` gained `/contact`.

**`security.txt` result**: implemented at `/.well-known/security.txt`, serving
`text/plain`, HTTP 200, with `Contact`, `Canonical`, `Policy`, `Preferred-Languages`, and a fixed
future `Expires` date (`2027-08-03`, ~12 months from this phase's review) — generated from
`TRUST_CONFIG`, not recalculated per-request. Verified directly against the production build
output and a live local server.

**Root `SECURITY.md`** updated to remove the stale "Part 1"/"no live scanner" framing and point to
the real `info@crawlpact.com` contact and the public `/security`/`security.txt` surfaces.

## Product-behaviour verification (before any policy text was written)

Directly verified against code, not assumed:

- **Account deletion**: soft delete, cancellable 30-day grace period
  (`ACCOUNT_DELETION_GRACE_PERIOD_DAYS`), sessions not revoked during the grace period, hard-purged
  by a real daily scheduled job (`worker.ts` → `runDataRetentionPurge`). Billing/audit-trail
  records survive via `ON DELETE SET NULL` (migration `0013_billing_customer_survives_account_deletion.sql`)
  — a deliberate design, not an oversight.
- **Data retention**: matches the existing public retention table exactly (24h–7d anonymous, 30d
  free, 365/730/1095 days solo/pro/agency, 30-day deletion purge). One gap not claimed as fixed:
  `product_events`/`security_events`/`notifications` have no purge job (RISK-006, unchanged,
  routed to Phase 11).
- **Paddle billing**: cancellation is genuinely self-serve via Paddle's real hosted customer
  portal; CrawlPact has no refund logic of its own — it only mirrors Paddle's own `adjustment.*`
  webhook decisions. Plan access downgrades to Free on a `cancelled`/`expired`/`paused` Paddle
  status; a failed payment leaves current access untouched during Paddle's own retry grace period.
- **Analytics/cookies**: Google Analytics is real, loads only on public marketing pages in
  production, never authenticated/admin/local/preview. No consent-management platform exists
  (RISK-021, unchanged, routed to Phase 13, per this phase's explicit bar on changing analytics
  behaviour) — accurately disclosed as absent, not silently omitted. The only first-party cookie
  is the `HttpOnly`/`Secure`/`SameSite=Lax` session cookie; no `localStorage` usage anywhere.
- **IP handling**: raw IP is never stored — only an HMAC-SHA256 hash, used transiently for
  rate-limiting.
- **Security-event recording**: a real, queryable admin surface backed by a live database table,
  not mocked.
- **Ownership-claim discrepancy**: found and fixed (see Executive summary).

## Legal-review flags

The following sections use careful, generic, non-extreme wording but have **not** been reviewed by
a licensed legal professional — flagged `professional-legal-review-recommended` internally, not
presented as legally approved:

- Terms §12 (Refunds), §19 (Limitation of liability), §21 (Governing law)
- Privacy §10 (International processing)

## Validation

| Command                                                                                     | Result  | Notes                                                                                                                                                     |
| ------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm trust:validate`                                                                       | ✅ Pass | 349 files scanned; 0 errors after allowlist entries for negation/tracking-doc content                                                                     |
| `pnpm brand:validate`                                                                       | ✅ Pass | 477 files scanned; 1 warning (honest "no guaranteed response time" on `/contact`, not an error)                                                           |
| `pnpm docs:validate`                                                                        | ✅ Pass | 9 required files present                                                                                                                                  |
| `pnpm format:check`                                                                         | ✅ Pass | after `pnpm format`                                                                                                                                       |
| `pnpm lint`                                                                                 | ✅ Pass | 0 errors                                                                                                                                                  |
| `pnpm typecheck`                                                                            | ✅ Pass | 0 errors (pre-existing third-party deprecation warnings only)                                                                                             |
| `pnpm test:unit`                                                                            | ✅ Pass | 255 tests, 28 files (7 new: `trust-config.test.ts`, `security.txt.test.ts`, `site-footer-trust-links.test.ts`, plus extended `base-layout-brand.test.ts`) |
| `pnpm test:integration`                                                                     | ✅ Pass | 149 tests, 24 files                                                                                                                                       |
| `pnpm db:validate`                                                                          | ✅ Pass | 40 tables verified                                                                                                                                        |
| `pnpm registry:validate`                                                                    | ✅ Pass | no issues found                                                                                                                                           |
| `pnpm baseline:validate`                                                                    | ✅ Pass | 17 required files present                                                                                                                                 |
| `pnpm build`                                                                                | ✅ Pass | verified built `dist/client/.well-known/security.txt` and `dist/client/contact/index.html` directly — correct contact addresses, correct `Expires` date   |
| `pnpm test:e2e` (trust-pages, seo-metadata, landing-page, responsive-smoke specs, chromium) | ✅ Pass | 40/40, against a live local dev server                                                                                                                    |
| `pnpm test:e2e` (auth-and-account spec, chromium)                                           | ✅ Pass | 8/8 — real passkey registration/audit flow unaffected                                                                                                     |
| `pnpm test:a11y` (chromium)                                                                 | ✅ Pass | 83/83 (82 prior + new `/contact` route)                                                                                                                   |
| `pnpm secrets:scan`                                                                         | ✅ Pass | no known secret patterns                                                                                                                                  |

Exact durations/exit codes were captured during actual execution against this branch, not assumed.

## Runtime impact

**This phase adds and updates legal, privacy, security, contact, trust, metadata, structured-data,
and validation surfaces. It does not change crawler evaluation logic, crawler-registry contents,
database schema, data-retention implementation, authentication, billing logic, Paddle
configuration, pricing, monitoring, analytics implementation, or Cloudflare infrastructure.**

## Deployment

**No production deployment is required for Phase 3 to be complete as a merged change**, but the
new/updated public pages, `security.txt`, and footer link will only be visible on
crawlpact.com once a normal `deploy-production.yml` run is explicitly authorised — none occurred
as part of this phase. `.github/workflows/ci.yml` gained one new step (`pnpm trust:validate`,
read-only, no network access).

## Rollback

This phase's changes are documentation/config/copy/CI-configuration-only and can be reverted by
reverting the pull request — no data migration or infrastructure rollback is needed.

## Risks

- **RISK-011** updated: partially resolved (operator/jurisdiction/contacts implemented); address,
  registration number, and tax information remain open, re-targeted to Phase 18.
- **RISK-004** re-routed from Phase 3 to Phase 13 (Phase 3's actual scope excludes changing
  analytics behaviour).
- **RISK-006, RISK-021** unchanged — accurately disclosed in the rewritten Privacy Policy, not
  resolved, per this phase's explicit scope boundary.
- **RISK-028** (SRS §2.3 tagline) and the `package.json` description-field gap remain open,
  unclaimed by either Phase 2 or Phase 3 — carried forward to Phase 4 explicitly rather than
  silently dropped (this phase's actual execution prompt did not address either).

## Next phase

Phase 4 (Homepage Information Architecture and Conversion Redesign) can now proceed against a
complete Gate A ("Trust-ready": Phases 0-3, all complete). Phase 4 additionally inherits the two
unclaimed backlog items noted above.
