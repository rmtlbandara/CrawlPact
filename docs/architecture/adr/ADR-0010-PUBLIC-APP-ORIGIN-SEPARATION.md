# ADR-0010: Public/App Origin Separation

**Status:** Accepted
**Date:** 2026-09-09
**Owner:** Solo founder / Claude Code
**Supersedes:** Partially supersedes ADR-0006's single-origin assumption only. ADR-0006's core
decision — one Cloudflare Worker plus Workers Static Assets, no Cloudflare Pages split — remains
in force and is explicitly reaffirmed below, not reopened.

## Context

CrawlPact has run as a single origin (`crawlpact.com`) since ADR-0001: one Worker serves public
marketing/SEO content, the authenticated customer dashboard, the Super Admin Control Center, and
every `/api/**` endpoint, sharing one cookie jar, one CSRF-expected-origin, and one WebAuthn RP
origin.

ADR-0006 (2026-07-26) already evaluated a subdomain split as a rejected alternative ("Option B"),
but that option paired the subdomain split with a **second Cloudflare product** (Pages for
marketing, a Worker for the app) — a materially different shape than the one being decided here.
ADR-0006's stated reasons for rejecting Option B (same-origin session cookie breakage, WebAuthn
origin fragmentation across two deploy targets, CSRF doubling up, preview-environment
inconsistency) largely stemmed from splitting the _deployment_, not merely the _hostname_. This
ADR evaluates a narrower, same-Worker, two-hostname split and finds most of ADR-0006's objections
do not apply to it, while its WebAuthn/CSRF/session concerns remain genuinely relevant and are
addressed explicitly below rather than dismissed.

### Motivation

- **Security boundary**: today, an authenticated session cookie, CSRF-protected mutation
  endpoints, and public marketing/SEO surfaces are indistinguishable by origin. A dedicated
  `app.crawlpact.com` origin gives identity/account/billing/admin state a boundary independent of
  marketing content, without weakening it (host-only session cookie, unchanged, is what makes this
  safe rather than risky).
- **Product clarity**: `crawlpact.com` becomes unambiguously the public acquisition/trust/SEO
  surface; `app.crawlpact.com` becomes unambiguously the authenticated product. This mirrors how
  most SaaS products are structured and removes the `/app/*`-prefix URL awkwardness as a side
  effect (though de-prefixing is explicitly _not_ a Phase 2/3 requirement — see Rejected
  Alternatives).
- **Current adoption/blast radius** (live-verified 2026-09-09, `AUTHORITATIVE_BASELINE.md`): 3
  total user accounts, 0 currently-active sessions, 4 passkeys, 1 Google-linked account, 2
  subscriptions. This is the lowest-risk possible window for a one-time session-reauthentication
  cost — independently re-verified, not copied forward from an older baseline.
- **Current Worker architecture** (live-verified): one Worker (`crawlpact-web`) plus Workers
  Static Assets, no `run_worker_first` on production today — meaning prerendered public pages
  bypass all Worker code entirely on production. This is the specific mechanism that makes a naive
  "just attach a second Custom Domain" approach unsafe (see Consequences and
  `docs/baseline/2026-09-09-app-subdomain-phase1/CLOUDFLARE_HOST_BOUNDARY_DESIGN.md`).

## Decision

```
crawlpact.com       — public / search / trust / acquisition (unchanged canonical SEO authority)
app.crawlpact.com   — identity / authenticated application / admin

Deployment: SAME Cloudflare Worker (crawlpact-web), SAME repository, SAME production
D1/KV/R2 resources. No second Worker, no Cloudflare Pages project.
```

Frozen sub-decisions (each detailed in the companion Phase 1 documents):

| Decision                  | Value                                                                                                                                              | Detail                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Public origin             | `https://crawlpact.com`                                                                                                                            | Unchanged canonical/SEO/trust authority                                                   |
| Application origin        | `https://app.crawlpact.com`                                                                                                                        | New; not yet attached as a Cloudflare Custom Domain                                       |
| Deployment model          | Same Worker + Workers Static Assets, multiple Custom Domains                                                                                       | `CLOUDFLARE_HOST_BOUNDARY_DESIGN.md`                                                      |
| Session cookie            | Host-only, unchanged (`Path=/`, `HttpOnly`, `SameSite=Lax`, `Secure`, no `Domain`)                                                                 | One-time reauthentication accepted when a user's session moves from apex to app host      |
| WebAuthn RP ID            | Stays `crawlpact.com` (never changes to `app.crawlpact.com`)                                                                                       | `WEBAUTHN_MIGRATION_CONTRACT.md` — W3C WebAuthn permits a registrable-domain-suffix RP ID |
| WebAuthn ceremony origin  | Dual-origin migration window, each ceremony pinned to its validated initiating origin via a signed challenge-token field — never an unpinned array | `WEBAUTHN_MIGRATION_CONTRACT.md`                                                          |
| CSRF                      | Per-route expected-origin allowlist derived from route ownership, never a blanket dual-origin acceptance                                           | `PUBLIC_SITE_URL_USAGE_AUDIT.md`                                                          |
| API architecture          | Same-origin only; no CORS                                                                                                                          | Restated from the migration directive                                                     |
| Route ownership           | Every route family classified `PUBLIC_ONLY`/`APP_ONLY`/`SHARED_SAME_ORIGIN_SURFACE`/`SERVER_TO_SERVER_PUBLIC`/`INTERNAL_ONLY`                      | `ORIGIN_AND_ROUTE_OWNERSHIP_MATRIX.md`                                                    |
| GA4 / Microsoft Clarity   | Public-marketing-only, unchanged; never loaded on the app origin                                                                                   | Verified already true from source (`AppLayout`/`AdminLayout` never import them)           |
| Paddle `/pay` and webhook | Stay on `crawlpact.com`, unchanged                                                                                                                 | Live-verified: only `crawlpact.com` is an approved Paddle checkout domain today           |
| Indexability              | App origin never indexable, never in the sitemap; public canonical ownership stays with the apex                                                   | `ORIGIN_AND_ROUTE_OWNERSHIP_MATRIX.md`, `PHASE_2_TEST_CONTRACT.md`                        |

## Alternatives Considered

- **Cloudflare Pages (marketing) + separate Worker (app)** — rejected, reaffirming ADR-0006. This
  is a different, larger architectural change than the security boundary being sought here, and
  reintroduces exactly the cross-product session/CSRF/WebAuthn fragmentation ADR-0006 already
  rejected.
- **Second app-only Worker, same Cloudflare Pages-free deployment** — rejected by default per the
  migration directive; would be revisited only if hard platform evidence proves secure host
  separation impossible within one Worker, which this ADR's host-boundary design
  (`CLOUDFLARE_HOST_BOUNDARY_DESIGN.md`) shows is not the case (`run_worker_first` as a selective
  array of route patterns, live-verified against current Cloudflare documentation, closes the gap).
- **Cross-origin authenticated API architecture (CORS)** — rejected. The app calls its own
  `/api/**` same-origin on `app.crawlpact.com`; no wildcard or credentialed cross-origin fetch
  architecture is introduced.
- **Parent-domain session cookie (`Domain=crawlpact.com`)** — rejected. Preserving pre-migration
  sessions this way would mean the cookie becomes readable by both origins, undermining the exact
  boundary this migration exists to create. One-time reauthentication is accepted instead.
- **Changing `WEBAUTHN_RP_ID` to `app.crawlpact.com`** — rejected. Would invalidate every existing
  passkey credential's scope; unnecessary given W3C WebAuthn's registrable-domain-suffix allowance.
- **JWT/localStorage session handoff between origins** — rejected. Reintroduces XSS-exposed
  token storage and stateless-revocation problems ADR-0004 already rejected for the same reasons.
- **Moving the Paddle webhook or default payment link to the app host "for consistency"** — rejected.
  No functional reason to move either; doing so would require re-approving a new webhook endpoint
  and default payment link for zero benefit. Live-verified: only `crawlpact.com` is Paddle-approved
  today, and moving would only add risk.
- **Adding GA4/Clarity to the app host** — rejected outright, consistent with existing (already
  correct) source-level behavior.
- **Physically moving the entire `src/pages/app/**` source tree now to de-prefix URLs
  (`app.crawlpact.com/domains` instead of `.../app/domains`)** — deferred, not rejected outright.
  The migration directive explicitly permits keeping the physical `/app/*` route structure and
  achieving clean external URLs via a routing/compatibility layer if that produces a smaller, safer
  diff; forcing a mass physical rewrite as a hard Phase 2 dependency is not required and is not
  decided here.

## Consequences

**Positive:**

- A real security boundary between marketing/public surfaces and authenticated/admin state,
  without weakening session/CSRF/WebAuthn guarantees (each explicitly redesigned to be _stronger_
  under two origins, not merely "as strong as before" — a per-route CSRF allowlist and
  origin-pinned WebAuthn ceremonies are stricter than today's single-origin-by-coincidence model).
- Clearer product architecture and eventual clean app URLs, without a forced destructive rewrite.
- Stronger host-level SEO ownership: the public origin's canonical authority becomes structurally
  enforced (no possible public-content duplication on the app host) rather than incidental.

**Costs:**

- One-time session reauthentication for existing users (currently: 0 active sessions, so
  effectively zero immediate user impact).
- A genuinely new Cloudflare Workers Static Assets hard constraint must be solved before the app
  Custom Domain can be attached at all: production has no `run_worker_first` today, so a
  prerendered public page could otherwise be served as a duplicate on the app host. Solved by
  design in `CLOUDFLARE_HOST_BOUNDARY_DESIGN.md`; not yet implemented.
- WebAuthn and CSRF both need real code changes (not configuration-only) to support the migration
  window safely — designed in `WEBAUTHN_MIGRATION_CONTRACT.md` and
  `PUBLIC_SITE_URL_USAGE_AUDIT.md`, not yet implemented.
- Two new external-owner dependencies before live cutover: a Google Authorized JavaScript Origin
  addition, and a Paddle checkout-domain approval for `app.crawlpact.com` — both live-verified as
  currently absent (`EXTERNAL_PREREQUISITES.md`).
- Additional preview/production testing surface (two hosts instead of one) for every future
  auth/billing/routing change, permanently, going forward.

## Migration Order

```
Phase 1 (this ADR, 2026-09-09) — Baseline, this ADR, non-behavioral config (validated,
  optional PUBLIC_APP_URL), route/origin ownership matrix, WebAuthn/CSRF/Cloudflare design
  contracts, external-prerequisite verification. No production behavior changed. No Custom
  Domain attached.

Phase 2 — Host-aware application implementation: hostname classifier, per-route CSRF allowlist,
  origin-pinned WebAuthn challenge tokens, selective run_worker_first, dedicated AuthLayout,
  app-host robots.txt.

Phase 3 — Preview/direct-host validation, full regression suite from PHASE_2_TEST_CONTRACT.md,
  external-owner approvals (Google origin, Paddle domain), controlled compatibility deployment
  serving both trusted origins before any permanent redirect is enabled.

Phase 4 — Controlled production cutover: permanent GET/HEAD legacy redirects, apex WebAuthn
  origin removal (RP ID unchanged), first-party entry points updated to point at app.crawlpact.com
  directly.
```

## Rollback Principles

- `WEBAUTHN_RP_ID` never changes at any point, including rollback.
- The pre-cutover apex auth path can be restored by disabling the Phase 4 permanent redirects —
  no database migration is required to reverse hostname routing, since both origins share the same
  D1/KV/R2 resources throughout.
- Google's apex Authorized JavaScript Origin and Paddle's apex `/pay`/webhook configuration are
  never removed until well after cutover confidence is established, specifically to keep rollback
  cheap.
- Session cookie isolation (host-only, no `Domain`) is never weakened to make rollback
  session-transparent — users may need to reauthenticate again after a rollback, same as after the
  original cutover.
- Rolling back the Worker deployment itself is sufficient for any purely code-level defect, since
  there is only ever one Worker.
