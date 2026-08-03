# Legal and Trust Surface Inventory

**Level 1 document (Current authoritative).** Every public legal, privacy, security, contact, and
trust-adjacent surface, assessed before any policy rewrite — established Phase 3 (Legal Identity,
Contact, Security and Trust Foundation), 2026-08-03, from direct inspection of every file listed
(two parallel read-only research passes plus direct review, no wording below is inferred).

Status vocabulary: `verified-current` · `rewrite` · `minor-correction` · `centralise` · `missing` ·
`blocked-needs-owner-input` · `blocked-needs-legal-review` · `defer-future-phase`.

## Summary

Before this phase: **zero contact email addresses existed anywhere in the repository** (confirmed
by grep — no `mailto:`, no `@crawlpact.com`). `apps/web/src/lib/trust-config.ts` had every
legal-identity field (`legalEntityName`, `governingJurisdiction`, `securityContact`,
`privacyContact`, `correctionsContact`) set to `null` by design (RISK-011). No `/contact` page, no
`/.well-known/security.txt`, and no responsible-disclosure or content-correction process existed.
Two real discrepancies were found between existing public copy and verified product behaviour: (1)
`terms.astro` and `acceptable-use.astro` both assert users must "own, manage, or [be] otherwise
authorised" to audit a domain, but the free/anonymous audit path has **no ownership-verification
logic at all** — it works on any public domain by design; (2) `SECURITY.md` (GitHub-facing) still
describes the product as "Part 1" with "no live scanner, authentication, billing, or admin surface"
and "no email infrastructure exists by design" — both long since false.

## A. Legal and policy pages

| Surface ID | Route/file                                    | Purpose                          | Audience                         | Current legal/operator name | Current jurisdiction | Current contact                                        | Current effective/review date                   | Current claims                                                                                                                                | Accuracy status                                                                                                                                                                                      | Required action                                                                  | Owner          |
| ---------- | --------------------------------------------- | -------------------------------- | -------------------------------- | --------------------------- | -------------------- | ------------------------------------------------------ | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------- |
| T1         | `/privacy` (`privacy.astro`)                  | Data collection/retention/rights | All                              | none stated                 | none stated          | none                                                   | `TRUST_CONFIG.policyEffectiveDate` (2026-07-30) | Accurate retention table (24h–7d/30d/12/24/36mo), correct billing/analytics disclosure                                                        | accurate but incomplete — no operator/jurisdiction/contact section, no service-vs-audit-data distinction, no cookies section, no international/children/third-party-websites/policy-changes sections | rewrite                                                                          | Product owner  |
| T2         | `/terms` (`terms.astro`)                      | Service terms                    | All                              | none stated                 | none stated          | none                                                   | `TRUST_CONFIG.policyEffectiveDate`              | **Inaccurate**: "you may only submit domains you own, manage, or are otherwise authorised to audit" — no such check exists for the free audit | inaccurate (contradicts verified product behaviour) + incomplete (no operator/jurisdiction/IP/refund/liability/termination sections)                                                                 | rewrite                                                                          | Product owner  |
| T3         | `/acceptable-use` (`acceptable-use.astro`)    | Scanner acceptable-use rules     | All                              | n/a                         | n/a                  | none                                                   | `TRUST_CONFIG.policyEffectiveDate`              | Same ownership-claim inaccuracy as T2; safety/abuse prohibitions are accurate                                                                 | minor-correction (soften ownership claim to lawful/responsible use; retain the accurate abuse prohibitions)                                                                                          | minor-correction                                                                 | Product owner  |
| T4         | `/security` (`security.astro`)                | Product security architecture    | All, security researchers        | n/a                         | n/a                  | pointed to `SECURITY.md` (stale)                       | none                                            | Accurate architecture description (SSRF, passkeys, webhook verification, admin audit log)                                                     | accurate for architecture; missing the required responsible-disclosure policy (scope, contact, reporter guidance, prohibited testing, safe-harbour wording)                                          | rewrite (add disclosure section)                                                 | Security owner |
| T5         | Root `SECURITY.md`                            | GitHub-facing security policy    | Developers, security researchers | n/a                         | n/a                  | none (says "no email infrastructure exists by design") | none                                            | **Stale**: "Part 1", "no live scanner, authentication, billing, or admin surface exists yet" — all false                                      | inaccurate (materially stale)                                                                                                                                                                        | rewrite                                                                          | Security owner |
| T6         | `docs/release/LEGAL_INFORMATION_CHECKLIST.md` | Tracks missing legal facts       | Internal                         | blank                       | blank                | blank                                                  | n/a                                             | Tracked legal-entity/address/jurisdiction/contact gap                                                                                         | now partially resolved by this phase                                                                                                                                                                 | minor-correction (update resolved rows, keep address/registration/tax rows open) | Product owner  |

## B. New surfaces created this phase

| Surface ID | Route/file                                                                    | Purpose                                    | Audience                       | Status            | Owner          |
| ---------- | ----------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------ | ----------------- | -------------- |
| T7         | `/contact` (`contact.astro`)                                                  | Contact routing by category                | All                            | missing → created | Product owner  |
| T8         | `/.well-known/security.txt` (`security.txt.ts`)                               | RFC 9116 machine-readable security contact | Security researchers, scanners | missing → created | Security owner |
| T9         | Content/registry correction process (`methodology.astro#corrections` section) | Correction submission guidance             | All                            | missing → created | Registry owner |

## C. Supporting surfaces

| Surface ID | Route/file                                                                   | Current state                                                                                        | Required action                                                                                                           | Owner             |
| ---------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| T10        | `apps/web/src/lib/trust-config.ts`                                           | All identity/contact fields `null`                                                                   | centralise (fill in approved values; add `supportContact`/`billingContact`/`registrationNumber`/routes/short disclosures) | Engineering owner |
| T11        | `about.astro`                                                                | No operator/jurisdiction wording, no contact/correction/security routes listed                       | minor-correction                                                                                                          | Product owner     |
| T12        | `SiteFooter.astro` "Company and legal" column                                | No Contact link (matches SRS §9.19's literal list, which also has no Contact entry — see note below) | minor-correction (add Contact link; disclosed, additive deviation from SRS §9.19)                                         | Product owner     |
| T13        | `BaseLayout.astro` JSON-LD `Organization` node                               | `name`/`url`/`description` only, no `contactPoint`                                                   | minor-correction (add `ContactPoint` entries for support/billing and privacy/security)                                    | Engineering owner |
| T14        | `apps/web/public/robots.txt`                                                 | Allows `/.well-known/` and `/contact` (no matching `Disallow` prefix)                                | retain — no change needed                                                                                                 | Engineering owner |
| T15        | `apps/web/src/pages/sitemap.xml.ts`                                          | `/contact` not yet listed (route didn't exist)                                                       | minor-correction (add `/contact`)                                                                                         | Engineering owner |
| T16        | `apps/web/src/lib/security-headers.ts` / `middleware.ts` / `public/_headers` | Applies uniformly to all routes, no per-route exception                                              | retain — verified new routes inherit the same headers                                                                     | Engineering owner |

## D. Verified product-behaviour dependencies (for the Privacy/Terms rewrite)

Directly verified against code this phase (see `docs/reports/PHASE_03_LEGAL_SECURITY_TRUST_COMPLETION_REPORT.md`
for full citations):

- **Account deletion**: soft delete, 30-day cancellable grace period (`ACCOUNT_DELETION_GRACE_PERIOD_DAYS`),
  sessions not revoked during the grace period, hard-deleted by a real daily cron
  (`worker.ts` `scheduled()` → `runDataRetentionPurge`). Billing/audit-trail rows survive via
  `ON DELETE SET NULL` (not cascade) — a real, deliberate, migration-backed design (migration
  `0013_billing_customer_survives_account_deletion.sql`).
- **Data retention**: matches `privacy.astro`'s existing table exactly (24h–7d anonymous, 30d free,
  365/730/1095 days solo/pro/agency, 30-day deletion purge) — enforced by a real scheduled job, not
  aspirational. One gap not currently disclosed: `product_events`, `security_events`, and
  `notifications` have no purge job (unbounded growth) — see `docs/data/DATA_RETENTION.md`.
- **Paddle billing**: cancellation is self-serve via Paddle's real hosted customer portal
  (`portal-session.ts`); CrawlPact has **no refund logic of its own** — it only mirrors Paddle's own
  `adjustment.*` webhook decisions. Plan access downgrades to Free immediately on a `cancelled`/
  `expired`/`paused` Paddle status webhook; `past_due` leaves current plan access untouched during
  the grace period.
- **Analytics/cookies**: Google Analytics (GA4, real measurement ID) loads only in
  `MarketingLayout.astro` when `PUBLIC_APP_ENV === "production"` — never on authenticated
  app/admin, never local/preview. No consent-management platform or cookie-preference UI exists
  (RISK-021, open, routed to Phase 13 — not resolved by this phase, only accurately disclosed).
  The only first-party cookie is the `HttpOnly`/`Secure`/`SameSite=Lax` session cookie. No
  `localStorage`/`sessionStorage` usage anywhere.
- **IP handling**: raw client IP is never stored — only an HMAC-SHA256 hash (keyed by
  `SESSION_SIGNING_SECRET`), used transiently for rate-limiting and security-event correlation.
- **Security-event recording**: real, queryable admin surface (`/admin/security`) backed by a live
  `security_events` table with a genuine `eventType` enum, not mocked data.
- **Ownership-claim discrepancy**: `terms.astro`/`acceptable-use.astro`'s "own, manage, or
  authorised" wording does not match the free audit's actual no-ownership-check behaviour —
  corrected this phase to require lawful and responsible use instead, without weakening the real
  abuse/safety prohibitions.

## E. Note on SRS §9.19 / §11 and the new Contact surface

SRS §9.19 (footer) and §11 (public page list) do not mention `/contact` or a footer "Contact"
link — both predate this phase's trust-foundation work. Adding `/contact` and a footer Contact link
is an **additive** deviation, not a violation of an explicit prohibition, and is required by this
phase's own explicit instruction ("Ensure all public pages provide discoverable links to: About,
Contact, Privacy, Terms, Security..."). Recorded here for traceability rather than silently
expanding SRS-listed surfaces without a note — no SRS text is edited by this phase.

## F. Deferred / out of Phase 3 scope

- RISK-004 (Cloudflare Web Analytics/AI Crawl Control product decision) — re-routed to Phase 13
  (analytics/consent architecture), since Phase 3 is explicitly barred from changing analytics
  behaviour.
- RISK-021 (no cookie-consent mechanism) — accurately disclosed in the rewritten Privacy Policy,
  not resolved; consent-management implementation stays routed to Phase 13 per this phase's
  explicit scope boundary.
- RISK-006 / `product_events`/`security_events`/`notifications` purge gap — routed to Phase 11
  (retention engineering), per this phase's explicit "do not change retention implementation"
  boundary; the Privacy Policy's retention wording is phrased generally enough to remain accurate
  regardless.
- RISK-028 (SRS §2.3 tagline vs. Phase 2 brand system) — out of this phase's actual scope (this
  prompt does not address brand/tagline reconciliation); left open, unchanged by this phase.
