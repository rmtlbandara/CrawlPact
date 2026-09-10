# Phase 3 Completion Report — App-Subdomain Migration

Status as of 2026-09-10. This report covers the full Phase 3 sequence from the
Preview deployment through the second (post-remediation) Custom Domain
attachment. It does not rewrite or remove any earlier evidence — the first
attachment attempt and the boundary-gap discovery/remediation are preserved
in full in this same directory and in `docs/baseline/2026-09-09-app-subdomain-phase2/`.

## Verdict

**BLOCKED_PENDING_EXTERNAL_CONFIGURATION**

Every gate completable through Claude Code, the repository, Cloudflare's
API, and browser automation — including the real existing-passkey
continuity test, completed by the repository owner in person and
automatically verified below — is complete and passing. The remaining
blockers are two external configuration changes (Google OAuth client,
Paddle checkout-domain submission) for which no connected MCP/API/browser
route exists — see "External blockers" below. Nothing further can proceed
automatically until one of those is done.

## Existing-passkey continuity test — PASS (real human action, 2026-09-10)

The repository owner signed in at `https://app.crawlpact.com/sign-in` using
an existing pre-migration passkey. Automated post-auth verification via a
read-only, aggregate-only production D1 query (no PII):

- A new session was created and remains active (not revoked), expiring the
  standard 12 hours later for an admin session.
- **Zero new `passkey_credentials` rows** in the surrounding window —
  confirms no new credential registration occurred; the existing credential
  was used.
- Zero `security_events` rows in the window — no auth failures or anomalies
  flagged.
- The session is correctly flagged `is_admin_session=1` — confirmed with
  the owner this is expected (their account holds Super Admin privileges;
  an admin account's passkey sign-in correctly produces an admin session,
  unlike Google sign-in, which this codebase separately guarantees never
  creates an admin session).
- A few other sessions in the same window (two admin, one customer, each
  revoked within 2–3 seconds of creation) were retry/navigation churn
  during the owner's own testing, not a defect — confirmed with the owner.
- `WEBAUTHN_RP_ID`/`WEBAUTHN_RP_ORIGIN` remained `crawlpact.com` /
  `https://crawlpact.com` throughout (verified live in the deployed
  Worker's bindings both before and after this test — never narrowed to
  the app origin).

One limitation, stated plainly rather than papered over: whether the
browser's actual session cookie is scoped host-only to `app.crawlpact.com`
(vs. a shared `Domain=crawlpact.com` cookie) cannot be verified from the
server-side database alone — that requires inspecting the cookie directly
in the browser that performed the sign-in, which is the owner's machine,
not this session's. Flagged as unverified-by-Claude-Code rather than
assumed correct; the source code's cookie-issuance logic (host-only,
`Secure`, `HttpOnly`, no explicit `Domain` attribute) was not modified by
any change in this Phase 3 pass, so it is expected to be correct by
inspection of `apps/web/src/lib/auth/session.ts`, but "expected by code
reading" and "verified live" are being kept distinct here on purpose.

## AUTOMATICALLY COMPLETED BY CLAUDE CODE

### Cloudflare — Custom Domain, DNS, TLS

- Reverified pre-attachment state: production deployment `0e74c80d-3660-462b-b242-7218bba09d15`
  / version `4e618afc-3071-4bbd-91df-8fbc6bf5db4f` (the remediated Worker),
  rollback target `747f75e0-6184-445d-9464-2b09ba8acc53` / version
  `eb4847d0-c35c-4042-94f8-f827d1830a05`, no conflicting DNS record or
  existing Custom Domain for `app.crawlpact.com`.
- Attached `app.crawlpact.com` as a Custom Domain of the existing
  `crawlpact-web` Worker (domain id `c909200bba9caff022fd8c73b44ac99d6ad39c58`,
  cert `4b990f36-9ac6-489a-be76-47452ad1607e`). No new Worker, no Pages
  project, no CNAME to another service.
- Independently verified (not just trusting the API's 200):
  - DNS resolves via both Cloudflare's own resolver and 1.1.1.1/8.8.8.8 to
    `104.21.24.234` / `172.67.221.5`.
  - TLS certificate valid, SAN `crawlpact.com, *.crawlpact.com` (Google
    Trust Services), already covers the new hostname — no new issuance
    needed.
  - `https://app.crawlpact.com/` → exactly 1 redirect → `/sign-in` → 200.
    No redirect loop, no 52x/53x.

### Static Assets literal-alias boundary — real attached hostname

Every alias form requested against the real, now-attached
`app.crawlpact.com`:

```
/index.html /index → 308 https://crawlpact.com/
/about.html /about/index.html /about/index → 308 https://crawlpact.com/about/
/security.html /security/index.html /security/index → 308 https://crawlpact.com/security/
/crawlers.html /crawlers/index.html /crawlers/index → 308 https://crawlpact.com/crawlers/
/crawlers/gptbot.html /crawlers/gptbot/index.html /crawlers/gptbot/index
  → 308 https://crawlpact.com/crawlers/gptbot/
/guides.html /guides/index.html → 308 https://crawlpact.com/guides/
/guides/robots-txt-syntax-basics.html /guides/robots-txt-syntax-basics/index.html
  → 308 https://crawlpact.com/guides/robots-txt-syntax-basics/
/platforms.html /platforms/index.html → 308 https://crawlpact.com/platforms/
/platforms/vercel.html /platforms/vercel/index.html → 308 https://crawlpact.com/platforms/vercel/
/tools.html /tools/index.html → 308 https://crawlpact.com/tools/
/tools/ai-crawler-checker.html /tools/ai-crawler-checker/index.html
  → 308 https://crawlpact.com/tools/ai-crawler-checker/
/privacy/index.html /terms/index.html /methodology/index.html → 308 (respective canonical)
```

**Zero of these returned 200 or exposed public content through the app
host.** Query string and trailing-slash policy preserved; a POST to
`/about/` on the app host returned 404 (rejected, not cross-origin
replayed).

One non-security observation, not a boundary failure: `/for/*` and
`/research/*` (SSR prefixes with no literal Static Assets file at all —
confirmed these were never a real alias surface) redirect a synthetic
`.html`/`index.html`-suffixed path to a malformed apex URL
(`.../for/agencies/index.html/`) rather than the clean canonical form,
because `needsTrailingSlashRedirect`'s SSR-prefix branch still does a blind
`${pathname}/` append. This can't happen via any real Cloudflare-served
request (SSR pages have no literal file to alias), so it was not treated as
a fail-closed trigger, but it's a minor correctness gap worth fixing in a
follow-up pass — tracked, not yet fixed, since it's cosmetic rather than a
security or duplicate-content issue.

### App-host boundary — full revalidation

```
app.crawlpact.com/         → 302 → /sign-in   (unauthenticated app entry)
app.crawlpact.com/sign-in  → 200
app.crawlpact.com/app      → 302 → /sign-in
app.crawlpact.com/admin    → 302 → /sign-in
```

Representative public routes (`/about/`, `/pricing/`, `/crawlers/gptbot/`,
`/guides/`, `/tools/`, `/methodology/`, `/privacy/`, `/terms/`,
`/security/`, `/status/`) all 308 to their apex canonical. Unknown-host
fail-closed reverified directly against the real `*.workers.dev` fallback
hostname (not a spoofed Host header): `/sign-in`, `/app`, `/admin` → 404;
`/about/` → 200 (public content is never blocked on an unrecognized host,
only sensitive paths are).

### Apex non-regression after attachment

`/`, `/pricing/`, `/sign-in` → 200; `/app` → 302; `/pay` → 200; a crawler
route and a guide route → 200; `.html` and `/index.html` aliases on the
apex itself → 301 to canonical (the fix this Phase 3 pass shipped);
sitemap.xml and robots.txt → 200, unchanged content.

### Security headers, caching, analytics/privacy — live, both hosts

App host (`/sign-in`): CSP, HSTS, X-Content-Type-Options, Referrer-Policy,
Permissions-Policy, X-Frame-Options, `X-Robots-Tag: noindex, nofollow,
noarchive` all present; `Cache-Control: private, no-store` on the page
itself; hashed `_astro/*` assets `public, max-age=31536000, immutable`.
**Cross-Origin-Opener-Policy is not implemented anywhere in this codebase**
(apex or app host) — not a regression, a pre-existing gap unrelated to this
migration.

Live browser check (Playwright, not source grep) against
`https://app.crawlpact.com/sign-in`: 0 Google Analytics / Clarity / Bing
tracking requests, no consent-banner UI, no marketing nav, 0 page errors.
Apex's own consent-gated analytics reverified unaffected: 0 tracking
requests before consent, 7 (gtag.js, Clarity, Bing sync) immediately after
clicking Accept.

### Quality gate

Format, lint, typecheck, unit (114 new/updated tests for the alias fix),
`db:validate`, and build all green on the deployed commit (`7c9c17d`). CI
green on that exact SHA. Integration tier has a known, pre-existing,
unrelated D1-harness resource-contention flake under full parallel load
(documented earlier this session) — not touched by this work.

## External blockers — no supported route exists (not caution, genuine absence)

**Google OAuth client (Section 14):** no Google Cloud/OAuth MCP server and
no generic authenticated-browser-automation tool is connected in this
environment. There is no way to add `https://app.crawlpact.com` to the
existing Web client's Authorized JavaScript origins without the owner doing
it directly in Google Cloud Console (APIs & Services → Credentials → the
existing OAuth 2.0 Client ID `913355566806-...`). **Minimal owner action:**
add `https://app.crawlpact.com` to Authorized JavaScript origins, keep
`https://crawlpact.com` in place.

**Paddle checkout-domain submission (Section 25–26):** the Paddle MCP
server is currently unreachable (DNS resolution failure for
`mcp.paddle.com` — a connection failure, not "unconfigured"). Independent
of that, Paddle's own public API reference states plainly that checkout
domains cannot be created via the API on a standard (non-Partner-Program)
account: _"You can't add a checkout domain using the API. To submit a new
domain for approval, go to Paddle > Checkout > Website approval > Domain
approval in your dashboard."_ This is genuinely Dashboard-only for this
account. **Minimal owner action:** in the Paddle Dashboard, Checkout →
Website approval → Domain approval, submit `app.crawlpact.com`; typical
review is a few minutes to a few hours per Paddle's own docs.

Nothing else in Sections 15, 26–31 (live checkout test, customer-portal
test, webhook non-regression against the app host) can proceed until the
domain is `approved` — this is expected sequencing, not a separate gap.

## Flagged for a decision, not unilaterally implemented

**robots.txt `Disallow: /` vs. `noindex` on the app host (Section 13):**
checked against current Google Search Central guidance — Google states
directly that if a page is blocked by `robots.txt`, its crawler "will never
see the noindex rule, and the page can still appear in search results" (as
a bare URL, typically without a snippet, only if Google discovers a link to
it some other way). This is a real, documented interaction, not a
CrawlPact-specific bug.

Two things temper the practical risk before treating it as urgent:

1. Every genuinely public page already 308-redirects from the app host to
   its apex canonical — Google reliably follows and indexes through a
   redirect, so the only pages actually exposed to this theoretical gap are
   `/sign-in`, `/app`, `/admin` (real app-owned content, not marketing
   pages).
2. The apex itself has used the identical pattern for years — `robots.txt`
   already carries `Disallow: /sign-in` for the apex's own sign-in page,
   which has the same theoretical Google-guidance conflict `Disallow: /`
   now has on the app host. This is a pre-existing, apparently deliberate
   product decision from Phase 20, not a new gap this migration introduced.

Implementing a fix here means writing new code and shipping a fresh
production deploy — both need the owner's explicit go-ahead per this
repo's own standing rule, and the fix itself is a real policy tradeoff
(exactly how much of the app-host auth surface to leave crawlable so a
`noindex` can be observed, without exposing anything that shouldn't be
crawlable) rather than a single obviously-correct change. Recorded here for
a decision; not implemented.

## HUMAN INTERACTION COMPLETED

- The real existing pre-migration passkey continuity test — see the
  dedicated section above. **PASS.**

## Not attempted — sequenced behind other gates

- New passkey registration/testing, cookie-isolation proof, and
  sibling-origin CSRF proof against a _real authenticated session_ are
  sequenced to follow the existing-passkey test per this task's own
  ordering (Sections 18–20). Not performed yet — doing so means creating
  additional real test credentials/sessions in production, which warrants
  its own specific go-ahead rather than being bundled into this pass.
- Google Sign-In end-to-end validation, Paddle live-checkout validation,
  and GSC/CrUX checks are all sequenced behind the two external blockers
  above and were not attempted.

## Rollback readiness

No rollback was required at any point in this pass. Current rollback chain,
newest first: `4e618afc-3071-4bbd-91df-8fbc6bf5db4f` (live) →
`eb4847d0-c35c-4042-94f8-f827d1830a05` → `06c10be3-6dd9-4c7f-8fd9-bfa549e7508d`.
Claude Code retains standing authorization to detach `app.crawlpact.com`
immediately if a critical app-origin boundary defect is found (public HTML
200, cookie-boundary failure, cross-origin CSRF acceptance, unknown-host
auth acceptance, severe redirect loop) — none occurred.
