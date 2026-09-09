# Origin and Route Ownership Matrix — App-Subdomain Migration Phase 1

Date: 2026-09-09. This is the authoritative classification of every CrawlPact route/API family by
final hostname owner. It resolves every ambiguous case raised during investigation — **zero
entries are left `UNRESOLVED`**. Classification key (from the Phase 1 directive):

- **PUBLIC_ONLY** — served from `crawlpact.com`, either indexable marketing/content or a public
  capability-URL (token-gated but not session-gated — annotated below where relevant).
- **APP_ONLY** — served from `app.crawlpact.com` after cutover; requires a session or is
  colocated with a page that will live on the app host.
- **SHARED_SAME_ORIGIN_SURFACE** — deliberately callable same-origin from _either_ host (never a
  catch-all; enumerated explicitly below, exactly two entries).
- **SERVER_TO_SERVER_PUBLIC** — signature/secret-verified machine endpoint, no session/CSRF
  applicable. Reserved strictly for this (the Paddle webhook); public capability-URLs that are
  _read_ by any client are classified PUBLIC_ONLY instead (see note below).
- **INTERNAL_ONLY** — must never be reachable in production regardless of origin.
- **LEGACY_REDIRECT** — becomes a GET/HEAD redirect target only, after Phase 4 cutover.

**Note on capability-URLs vs. server-to-server**: `/shared/:token`, `/feed/:token.xml`,
`/status/feed.xml`, `/.well-known/security.txt`, and `/api/agency-branding/logo/[...key]` are all
read-only, unauthenticated-by-session resources (token-gated where noted). They are classified
**PUBLIC_ONLY** here, not `SERVER_TO_SERVER_PUBLIC` — that class is reserved for the one endpoint
that is actually signature-verified machine-to-machine traffic (the Paddle webhook). This keeps
the taxonomy meaningful rather than a second catch-all.

**Note on the pre-session auth ceremony endpoints**: several `/api/auth/**` endpoints
(register/login begin+finish, Google begin/callback, recovery-code redemption, logout) require no
_session_ today, which is why a naive read might classify them PUBLIC_ONLY. They are classified
**APP_ONLY** instead, because they are only ever called from `/sign-in`, and `/sign-in` itself is
APP_ONLY per the frozen architecture decision (Section 3.2 of the migration directive: "Auth path
`/sign-in` on app host"). Classification here tracks _final hostname co-location with the calling
page_, not _whether a session exists yet_. This is the single most consequential classification
decision in this matrix — it directly determines what `assertSameOrigin`'s future allowlist must
accept for these routes (see `PUBLIC_SITE_URL_USAGE_AUDIT.md` and `CLOUDFLARE_HOST_BOUNDARY_DESIGN.md`).

**Note on admin**: the migration directive places `/admin/**` under `app.crawlpact.com`
explicitly, not a third origin. Classified APP_ONLY per that decision, even though a case could be
made for a separate admin origin in a future phase — out of scope here.

---

## Page routes

### PUBLIC_ONLY — stays on `crawlpact.com`

| Route                                                                                                                                                                         | Notes                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                                                                                                                                           | Homepage                                                                                                                                                                                  |
| `/about`, `/contact`, `/terms`, `/privacy`, `/security`, `/acceptable-use`, `/limitations`, `/methodology`, `/scoring`, `/scanner`, `/sample-report`, `/changelog`, `/status` | Marketing/trust/content pages, `MarketingLayout`                                                                                                                                          |
| `/pricing`                                                                                                                                                                    | Marketing; carries `?plan=&interval=` into sign-in (see continuation contract below)                                                                                                      |
| `/pay`                                                                                                                                                                        | **Frozen decision** (directive §3.8, §17): Paddle default payment-link page stays apex regardless of where authenticated checkout initiation lives                                        |
| `/audit`, `/audit/:auditId`                                                                                                                                                   | Anonymous audit intake + result — core public lead-gen flow, must stay public                                                                                                             |
| `/guides`, `/guides/:slug`, `/tools`, `/tools/*` (5 validator tools), `/crawlers`, `/crawlers/:slug`, `/platforms`, `/platforms/:slug`                                        | Content-collection-backed SEO surface                                                                                                                                                     |
| `/observatory`, `/observatory/methodology`, `/observatory/registry`                                                                                                           | Public crawler-policy observatory                                                                                                                                                         |
| `/research`, `/research/:slug`                                                                                                                                                | Public research publications (currently unpublished; noindex until first publication per Phase 16)                                                                                        |
| `/for/:slug`                                                                                                                                                                  | Programmatic landing pages                                                                                                                                                                |
| `/shared/:token`                                                                                                                                                              | Public capability-URL — third-party view of a shared audit report. No session.                                                                                                            |
| `/feed/:token.xml`                                                                                                                                                            | Public capability-URL — per-user Atom notification feed, token is the sole credential                                                                                                     |
| `/status/feed.xml`                                                                                                                                                            | Fully public Atom status feed                                                                                                                                                             |
| `/robots.txt`, `/sitemap.xml`, `/.well-known/security.txt`                                                                                                                    | Infra routes — **need Phase 2 rework**: a distinct app-host `robots.txt` (disallow-all, no sitemap line) and confirmation that `sitemap.xml` never gains `/app`/`/admin`/`/audit` entries |
| `/404`                                                                                                                                                                        | Not-found page                                                                                                                                                                            |

### APP_ONLY — final home is `app.crawlpact.com`

| Route                                                                                                                                                                                                                                                                                         | Notes                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `/sign-in`                                                                                                                                                                                                                                                                                    | **Frozen decision**. Needs a dedicated `AuthLayout` (see Major Finding below) — currently uses `MarketingLayout` |
| `/app` (dashboard home), `/app/account`, `/app/agency-branding`, `/app/billing`, `/app/domains`, `/app/domains/:id`, `/app/domains/:id/compare/:prev/:curr`, `/app/groups`, `/app/groups/:id`, `/app/notifications`, `/app/workspace`, `/app/workspace/domains`, `/app/workspace/import`      | Full authenticated dashboard tree                                                                                |
| `/app/continue`                                                                                                                                                                                                                                                                               | Public-audit-continuation landing page — see continuation contract below                                         |
| `/admin/**` (30 pages: analytics, audit-logs, blocked-targets, domains, entitlements, findings, health, incidents, index, jobs, notices, operations, pilots, plans, registry/*, research, scans, security, settings, shared-reports, subscriptions, transactions, users, users/:id, webhooks) | Super Admin Control Center — placed under `app.crawlpact.com` per frozen architecture decision                   |

### INTERNAL_ONLY

| Route             | Notes                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dev/components` | **Finding, not fixed in Phase 1**: no runtime auth/env gate exists today (unlike `/api/test-only/**`, which fails closed outside `PUBLIC_APP_ENV=local`) — relies solely on not being linked + `robots.txt` disallow. Recommend Phase 2 add an explicit `PUBLIC_APP_ENV === "local"` gate matching the API pattern, and ensure it is never reachable under either production Custom Domain. Logged in `RISK_REGISTER.md`. |

### LEGACY_REDIRECT (after Phase 4 cutover only — no redirect exists yet, by design)

| From                               | To                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| `crawlpact.com/sign-in` (GET/HEAD) | `app.crawlpact.com/sign-in`, preserving `continuation`/`plan`/`interval`                   |
| `crawlpact.com/app/**` (GET/HEAD)  | `app.crawlpact.com/**` (de-prefixed target path — see Phase 2 note on `/app` de-prefixing) |

---

## API routes

### PUBLIC_ONLY

| Path                                 | Methods | Purpose                                                                                                |
| ------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------ |
| `/api/audit`                         | POST    | Run anonymous audit                                                                                    |
| `/api/audit/:auditId`                | GET     | Poll audit progress                                                                                    |
| `/api/audit/:auditId/report`         | GET     | Fetch completed report                                                                                 |
| `/api/audit/:auditId/continuation`   | POST    | Create save/monitor continuation record (deliberately unauthenticated — this _is_ the pre-signup step) |
| `/api/agency-branding/logo/[...key]` | GET     | Public asset serving for shared-report agency logos, no auth                                           |

### APP_ONLY

| Path                                                                                                                                                                                                                                                                                         | Methods               | Purpose                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------- |
| `/api/auth/register/begin`, `/finish`                                                                                                                                                                                                                                                        | POST                  | Passkey registration ceremony (see "pre-session" note above)                                            |
| `/api/auth/login/begin`, `/finish`                                                                                                                                                                                                                                                           | POST                  | Passkey login ceremony                                                                                  |
| `/api/auth/logout`                                                                                                                                                                                                                                                                           | POST                  | Revoke session, clear cookie                                                                            |
| `/api/auth/google/begin`, `/api/auth/google/index`                                                                                                                                                                                                                                           | POST                  | Google sign-in/sign-up                                                                                  |
| `/api/auth/recovery-codes/redeem`                                                                                                                                                                                                                                                            | POST                  | Recovery-code login                                                                                     |
| `/api/auth/session`, `/api/auth/sessions`, `/api/auth/sessions/:id/revoke`, `/api/auth/sessions/revoke-all`                                                                                                                                                                                  | GET/POST              | Session management (post-login)                                                                         |
| `/api/auth/passkeys`, `/begin`, `/finish`, `/:id/remove`, `/:id/rename`                                                                                                                                                                                                                      | GET/POST              | Passkey management                                                                                      |
| `/api/auth/recovery-codes/generate`                                                                                                                                                                                                                                                          | POST                  | Recovery-code (re)generation, step-up                                                                   |
| `/api/account`, `/api/account/deletion`, `/api/account/google`, `/api/account/google/disconnect`, `/api/account/google/link/begin`                                                                                                                                                           | GET/PATCH/POST/DELETE | Account settings                                                                                        |
| `/api/billing/checkout`, `/portal-session`, `/plan-change/preview`, `/plan-change/confirm`, `/plan-change/cancel-scheduled`                                                                                                                                                                  | POST                  | Authenticated billing actions                                                                           |
| `/api/audit/:auditId/share`                                                                                                                                                                                                                                                                  | POST                  | Create shareable link for an _owned_ audit (dashboard action)                                           |
| `/api/audit/continuation/:continuationId`                                                                                                                                                                                                                                                    | POST                  | Consume a continuation post-sign-in — called only from `/app/continue`                                  |
| `/api/domains/**`, `/api/groups/**`, `/api/workspace/**`, `/api/notifications/**` (except feed-token _consumption_, which is the page route above), `/api/agency-branding/logo.ts` (upload), `/api/agency-branding/profile.ts`, `/api/app/pilot/feedback.ts`                                 | various               | Dashboard data APIs                                                                                     |
| `/api/notifications/feed-token`                                                                                                                                                                                                                                                              | POST, DELETE          | Mint/revoke the feed token (the _consumption_ endpoint, `/feed/:token.xml`, is PUBLIC_ONLY — see above) |
| `/api/admin/**` (~55 endpoints across analytics, blocked-targets, capacity, dashboard, domains, entitlements, findings, health, incidents, jobs, notices, operations, pilots, registry/*, research, scans, security, settings, shared-reports, subscriptions, transactions, users, webhooks) | GET/POST              | Admin Control Center APIs, all behind `requireAdminSession`/`requireAdminAction`                        |

### SHARED_SAME_ORIGIN_SURFACE (exactly two entries — never a catch-all)

| Path                   | Justification                                                                                                                                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/analytics/track` | Fires from both public marketing pages (conversion events) and, per SRS-permitted first-party product telemetry (directive §3.7), the authenticated app. Must remain callable same-origin from whichever host the request originated on — never cross-origin. |
| _(reserved)_           | No second entry identified. If Phase 2 implementation finds another genuinely dual-surface endpoint, it must be added here explicitly, not defaulted into this bucket.                                                                                        |

### SERVER_TO_SERVER_PUBLIC

| Path                   | Purpose                                                                                                                                                                                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/billing/webhook` | Paddle webhook — HMAC-SHA256 signature over raw body, 5-minute staleness window, idempotent by `paddle_event_id`. Governed entirely by its own signature model, not session/CSRF. **Stays on `crawlpact.com`** per frozen decision (directive §3.8, §17). |

### INTERNAL_ONLY

| Path                                                                                                                     | Gate                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/test-only/clear-rate-limit`, `/seed-failed-webhook`, `/grant-super-admin`, `/seed-notification-state`, `/set-plan` | Fail closed unless `PUBLIC_APP_ENV === "local"` (verified for at least two of five directly; documented directory convention for the rest) plus a committed non-secret fixture-secret header check. Must remain unreachable under any production Custom Domain (public or app). |

---

## `/app/continue.astro` — public-audit-continuation seam (Step 3 detail)

This is the exact point a subdomain split must cross carefully:

```
anonymous audit (PUBLIC_ONLY, crawlpact.com)
  → POST /api/audit/:auditId/continuation (PUBLIC_ONLY) creates an opaque
    continuation record, 60-minute TTL, single-use (atomic CAS on consumedAt)
  → redirect to /sign-in?continuation=<id>  [crosses to app.crawlpact.com after cutover]
  → sign-in (APP_ONLY) completes auth, redirects to /app/continue?continuation=<id>
  → /app/continue (APP_ONLY) does a read-only peek to render a confirmation UI
  → user clicks "Confirm and save" → POST /api/audit/continuation/:id (APP_ONLY,
    requireSession) — the only point of actual consumption
```

The `continuation` query parameter must survive the cross-origin redirect from
`crawlpact.com/audit/:id` (or wherever the "save/monitor" CTA lives) to
`app.crawlpact.com/sign-in` intact — this is a **GET/HEAD-safe redirect carrying public,
non-sensitive state** (an opaque UUID, not a secret token with embedded authority — the
continuation record itself is what's rate-limited and single-use, not the ID's secrecy), so it
is safe to redirect cross-origin. The equivalent pricing flow (`/pricing?plan=&interval=` →
`/sign-in` → `/app/billing?plan=&interval=`) works identically and carries the same
cross-origin-redirect requirement.

The open-redirect guard (`lib/auth/safe-redirect.ts`, `isSafeRelativeRedirect`) only ever
validates **relative** paths and needs no change for the split — but every call site building a
redirect target must now decide which origin's relative path it means, since a bare `/app/...`
path can no longer be assumed to resolve against the same origin the guard runs on. This is a
Phase 2 implementation detail, tracked in `PHASE_2_TEST_CONTRACT.md`.

---

## Major finding: `sign-in.astro` layout

`sign-in.astro` currently renders inside `MarketingLayout` (marketing header/footer chrome, and
the `AnalyticsConsent` banner island mounts there in production). `/sign-in` is already excluded
from the GA/Clarity route allowlist (`lib/consent.ts`), so the analytics _scripts_ themselves
don't render there today — but the marketing layout/chrome/banner apparatus does. This confirms
the directive's requirement for a dedicated `AuthLayout` (§8.4) is addressing a real, currently
unaddressed gap, not a hypothetical one. No layout change is made in Phase 1 (behavioral); this is
handed to Phase 2 as a concrete implementation item.

## No `UNRESOLVED` entries

Every route family above received an explicit classification. The admin-vs-app-origin question
and the pre-session-auth-endpoint-ownership question (both flagged as ambiguous during
investigation) were resolved by direct reference to the migration directive's own frozen
architecture decisions, documented inline above rather than left open.
