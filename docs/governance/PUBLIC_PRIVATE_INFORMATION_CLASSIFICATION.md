# Public/Private Information Classification

**Level 1 document (Current authoritative).** Phase 13. CrawlPact is a private, proprietary
source-code repository supporting a publicly accessible SaaS product. These are two different
things — the repository being private does not mean the product's public website content should
be private, and the website being public does not mean the repository is public. Do not conflate
them.

## Class A — Public website content (intentionally public)

Homepage, pricing, platform guides, crawler directory, free tools, methodology, limitations,
privacy, terms, security, contact, status, public changelog, `robots.txt`, `sitemap.xml`,
`security.txt`, the sample report. **Never** made private because the repository is private —
these are the product's entire acquisition and trust surface.

## Class B — Public website-source evidence

Content originating from publicly accessible third-party websites: `robots.txt` evidence, public
HTTP directives, crawler-policy metadata that CrawlPact's scanner reads. Access to a specific
CrawlPact _user's_ saved scan/history built from this evidence is still Class C (private).

## Class C — Private account data

Saved domains, monitoring history, private reports, agency portfolio, notifications, billing
metadata. Authenticated/private, full stop.

## Class D — Internal product documentation

The SRS, ADRs, the risk register, phase completion reports, infrastructure documentation,
migration architecture, internal security reviews, this document's own governance neighbours,
implementation prompts. Repository-only. Never exposed publicly unless deliberately rewritten
into a genuinely public document (e.g. a public changelog entry summarising a phase, distinct from
the internal phase report itself).

## Class E — Proprietary source code

Server implementation, scanner architecture, policy engine, database migrations, admin code,
billing logic, deployment tooling. Private-repository-only, **except** browser-delivered code
inherently required to operate the public website (see "What cannot be made private," below).

## Class F — Secrets

Never repository content, under any circumstance. See `docs/security/CI_CD_SUPPLY_CHAIN_HARDENING.md`
and `docs/security/DEPENDENCY_VULNERABILITY_POLICY.md` for the Phase 12 secret-handling controls
this class relies on.

## What cannot be "made private"

Browser-delivered HTML/CSS/JavaScript, public APIs intentionally callable by anonymous visitors
(e.g. `POST /api/audit`), the public `robots.txt`/`sitemap.xml`/`security.txt`, and public policy
evidence are all inherently inspectable by anyone who visits the site — no repository-privacy
setting changes that. CrawlPact's actual security model has never depended on any of these being
secret: entitlement checks, pricing authority, audit-evaluation authority, the Paddle API secret,
and monitoring logic are all enforced server-side (see `packages/scanner/src/safe-fetch.ts`,
`apps/web/src/lib/auth/require-*.ts`, and the Phase 12 threat reviews) — the client bundle itself
is not, and was never treated as, an access-control boundary.

## Framework directories are not a privacy signal

`apps/web/public/` is Astro's conventional directory for browser-accessible static assets — it is
intentionally public by framework design, regardless of repository visibility. Phase 13 audited
its contents (confirmed clean — see `docs/security/PHASE_13_REPOSITORY_SOURCE_EXPOSURE_THREAT_REVIEW.md`)
rather than renaming or restricting the directory itself, which would break the site.
