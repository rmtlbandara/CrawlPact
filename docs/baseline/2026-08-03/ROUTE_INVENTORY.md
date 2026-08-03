# Route Inventory — 2026-08-03

Phase 0 baseline. Scope: every file under `apps/web/src/pages/**/*.astro` and
`apps/web/src/pages/**/*.ts` (both `api/` and the two non-`api` route handlers,
`feed/[token].xml.ts` and `sitemap.xml.ts`). No other route roots exist elsewhere in the repo —
`packages/*` contains no Astro/API routes, only libraries consumed by `apps/web`. Confirmed
counts: 61 `.astro` files under `apps/web/src/pages`, 93 `.ts` files under
`apps/web/src/pages/api`, plus the 2 standalone `.ts` route handlers.

Global facts applying to whole buckets, stated once rather than repeated per row:

- **Auth redirect pattern**: every `/app/*` page calls `getPageSession()`
  (`lib/auth/page-session.ts:10`) and redirects to `/sign-in` if no session — confirmed across all
  seven `app/*.astro` files.
- **Admin auth pattern**: every `/admin/*` page and `/api/admin/*` route calls
  `getAdminPageSession`/`requireAdminSession`/`requireAdminAction` from `lib/auth/require-admin.ts`
  — never a hand-rolled check.
- **noindex**: `AdminLayout.astro:12` and `AppLayout.astro:12` both hardcode `noindex={true}`.
  `middleware.ts:54-65` additionally sets `X-Robots-Tag: noindex, nofollow, noarchive` for `/admin`,
  `/api/`, `/app`, `/audit/`, `/shared/`, `/dev/`, `/sign-in` — the only mechanism covering JSON API
  responses.
- **API contract**: every `api/**` route sets `prerender = false`, validates via a zod schema from
  `@crawlpact/core`, returns the `ok()`/`fail()` envelope.
- **Test-only routes** (`api/test-only/*`): 404 unless `PUBLIC_APP_ENV === "local"` AND a fixed
  non-secret header matches — never reachable in preview or production regardless of header.
- **Production verification default**: every route below is `code-present-not-production-verified`
  unless direct production evidence exists, cited in Notes.

## Marketing

| Path               | Access             | Render      | Purpose                                             | Handler                                             | Feature flag  | Prod verification                                                             | SEO       | Tests                                                               | Notes                                                              |
| ------------------ | ------------------ | ----------- | --------------------------------------------------- | --------------------------------------------------- | ------------- | ----------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `/`                | Public             | Prerendered | Homepage, hero audit form, synthetic report preview | `index.astro`, `AuditForm.tsx`, `ReportPreview.tsx` | GA loads here | code-present-not-production-verified (site live per IMPLEMENTATION_STATUS.md) | Indexable | `landing-page.spec.ts`, `seo-metadata.spec.ts`, `a11y/home.spec.ts` | `ReportPreview` is clearly-labelled synthetic data (SRS-compliant) |
| `/about`           | Public             | Prerendered | About page                                          | `about.astro`                                       | —             | code-present-not-production-verified                                          | Indexable | `seo-metadata.spec.ts`                                              | —                                                                  |
| `/pricing`         | Public             | Prerendered | Plan comparison, per-plan CTAs                      | `pricing.astro`                                     | GA            | code-present-not-production-verified                                          | Indexable | `seo-metadata.spec.ts`                                              | CTAs brought to parity with homepage teaser                        |
| `/methodology`     | Public             | Prerendered | Scan methodology explainer                          | `methodology.astro`                                 | —             | code-present-not-production-verified                                          | Indexable | `seo-metadata.spec.ts`                                              | SRS §30.4 minimum content                                          |
| `/scoring`         | Public             | Prerendered | Policy Health Score explainer                       | `scoring.astro`                                     | —             | code-present-not-production-verified                                          | Indexable | `seo-metadata.spec.ts`                                              | —                                                                  |
| `/security`        | Public             | Prerendered | Security/trust page                                 | `security.astro`                                    | —             | code-present-not-production-verified                                          | Indexable | `seo-metadata.spec.ts`                                              | —                                                                  |
| `/changelog`       | Public             | SSR         | Registry/product changelog                          | `changelog.astro`                                   | —             | code-present-not-production-verified                                          | Indexable | `seo-metadata.spec.ts`                                              | Non-prerendered — reads live env                                   |
| `/crawlers`        | Public             | Prerendered | Crawler directory index                             | `crawlers/index.astro`                              | —             | code-present-not-production-verified                                          | Indexable | `seo-metadata.spec.ts`                                              | 20 of 21 registry crawlers have pages (Bingbot excluded)           |
| `/crawlers/[slug]` | Public             | Prerendered | Individual crawler reference page                   | `crawlers/[slug].astro`                             | —             | code-present-not-production-verified                                          | Indexable | `seo-metadata.spec.ts`                                              | Source-verified against real operator docs                         |
| `/guides`          | Public             | Prerendered | Guides index                                        | `guides/index.astro`                                | —             | code-present-not-production-verified                                          | Indexable | `seo-metadata.spec.ts`                                              | 10 comparison + 5 implementation + 5 troubleshooting               |
| `/guides/[slug]`   | Public             | Prerendered | Individual guide page                               | `guides/[slug].astro`                               | —             | code-present-not-production-verified                                          | Indexable | `seo-metadata.spec.ts`                                              | —                                                                  |
| `/limitations`     | Public             | Prerendered | Disclosed technical/legal limitations               | `limitations.astro`                                 | —             | code-present-not-production-verified                                          | Indexable | `seo-metadata.spec.ts`                                              | Referenced as the page agency branding never removes               |
| `/dev/components`  | Public but noindex | SSR         | Component showcase/style guide                      | `dev/components.astro`                              | —             | code-present-not-production-verified                                          | noindex   | Included in `pnpm test:a11y` route list                             | Harmless if exposed                                                |

## Free tool

| Path                             | Purpose                          | Handler                       | Feature flag           | Notes                                                       |
| -------------------------------- | -------------------------------- | ----------------------------- | ---------------------- | ----------------------------------------------------------- |
| `/tools`                         | Tools index                      | `tools/index.astro`           | —                      | 5 free tools (spec required 4 minimum)                      |
| `/tools/ai-crawler-checker`      | Scoped AI-crawler-access checker | `AuditForm` via `ReportFocus` | `AUDIT_ENGINE_ENABLED` | One real scan pipeline, scoped view                         |
| `/tools/content-signals-checker` | Content Signals validator        | `AuditForm`                   | `AUDIT_ENGINE_ENABLED` | Same shared pipeline                                        |
| `/tools/llms-txt-validator`      | `llms.txt` validator             | `AuditForm`                   | `AUDIT_ENGINE_ENABLED` | `llms.txt` parser has a documented 50-link cap              |
| `/tools/robots-txt-ai-validator` | robots.txt AI-crawler validator  | `AuditForm`                   | `AUDIT_ENGINE_ENABLED` | robots.txt parser has documented 512KB cap                  |
| `/tools/rsl-validator`           | RSL validator                    | `AuditForm`                   | `AUDIT_ENGINE_ENABLED` | RSL parser has **no** pre-parse size bound (documented gap) |

All: Public, prerendered shell + client-side scan via `/api/audit`, indexable, `seo-metadata.spec.ts`.

## Audit

| Path                              | Access                          | Render      | Purpose                                              | Prod verification                                                                     | SEO       | Tests                                                                          | Notes                                                     |
| --------------------------------- | ------------------------------- | ----------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `/audit`                          | Public                          | Prerendered | Full-page anonymous audit entry form                 | code-present-not-production-verified                                                  | Indexable | `landing-page.spec.ts`, `seo-metadata.spec.ts`                                 | —                                                         |
| `/audit/[auditId]`                | Public/optionally-authenticated | SSR         | View a completed report; owner sees share action     | code-present-not-production-verified                                                  | noindex   | `landing-page.spec.ts` (print), `audit-report-signals.integration.test.ts`     | Report viewable by anyone holding the ID/URL (deliberate) |
| `POST /api/audit`                 | Public                          | N/A         | Run a real anonymous scan (or honest disabled state) | **verified-live** — IMPLEMENTATION_STATUS.md:39-41: live scanner returns real results | N/A       | `audit-api.integration.test.ts`, `audit-abuse-prevention.integration.test.ts`  | Rate-limited by IP hash; never fabricates a result        |
| `GET /api/audit/[auditId]`        | Public                          | N/A         | Poll scan state                                      | code-present-not-production-verified                                                  | N/A       | `audit-api.integration.test.ts`                                                | —                                                         |
| `GET /api/audit/[auditId]/report` | Public                          | N/A         | Fetch full completed report JSON                     | code-present-not-production-verified                                                  | N/A       | `audit-report-signals.integration.test.ts`                                     | —                                                         |
| `POST /api/audit/[auditId]/share` | Authenticated                   | N/A         | Create client-safe share link                        | code-present-not-production-verified                                                  | N/A       | `analytics-sharing.integration.test.ts`, `agency-features.integration.test.ts` | Logo path ownership checked server-side                   |

## Authentication

| Path                                                       | Purpose                                                             | Prod verification                                                                                   | Notes                                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `/sign-in`                                                 | Passkey sign-in/registration entry                                  | **verified-live** — `scripts/smoke-test.ts:80-84` checks this in production                         | Passkey-only, no password/email path exists                                 |
| `POST /api/auth/register/begin`                            | Begin WebAuthn registration                                         | code-present-not-production-verified                                                                | Challenge signed/verified, never persisted to a table                       |
| `POST /api/auth/register/finish`                           | Complete registration, create account+session, issue recovery codes | **verified-live** — this was the subject of the critical 2026-07-28 production account-creation fix | Was the single most severe production defect in project history until fixed |
| `POST /api/auth/login/begin`                               | Begin usernameless WebAuthn login                                   | code-present-not-production-verified                                                                | —                                                                           |
| `POST /api/auth/login/finish`                              | Complete login, create session                                      | verified-live (same 2026-07-28 pass verified sign-in)                                               | Also resolves admin-role assignment into session                            |
| `POST /api/auth/logout`                                    | Clear session cookie                                                | code-present-not-production-verified                                                                | —                                                                           |
| `GET /api/auth/session`                                    | Current session/user info                                           | code-present-not-production-verified                                                                | —                                                                           |
| `GET /api/auth/passkeys`                                   | List active passkeys                                                | code-present-not-production-verified                                                                | —                                                                           |
| `POST /api/auth/passkeys/begin` / `finish`                 | Add a new passkey                                                   | code-present-not-production-verified                                                                | —                                                                           |
| `POST /api/auth/passkeys/[credentialId]/rename` / `remove` | Rename/remove a passkey                                             | code-present-not-production-verified                                                                | Refuses to drop last passkey; admin accounts enforce 2-passkey minimum      |
| `POST /api/auth/recovery-codes/generate`                   | Generate new recovery codes                                         | code-present-not-production-verified                                                                | Step-up auth required; plaintext codes exist only in this one response      |
| `POST /api/auth/recovery-codes/redeem`                     | Sign in via one-time recovery code                                  | code-present-not-production-verified                                                                | Rate-limited per-IP; e2e coverage added 2026-07-28                          |
| `GET /api/auth/sessions`                                   | List active sessions                                                | code-present-not-production-verified                                                                | —                                                                           |
| `POST /api/auth/sessions/[sessionId]/revoke`               | Revoke one session                                                  | code-present-not-production-verified                                                                | —                                                                           |
| `POST /api/auth/sessions/revoke-all`                       | Sign out everywhere                                                 | code-present-not-production-verified                                                                | —                                                                           |

All auth routes: `auth-flow.integration.test.ts` + `auth-and-account.spec.ts`; noindex where public-facing (`/sign-in`).

## Account

| Path                                | Purpose                                                           | Notes                                                                                  |
| ----------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `/app/account`                      | Profile, passkeys, sessions, recovery codes, delete-account panel | Session required, noindex                                                              |
| `PATCH /api/account`                | Update display name                                               | —                                                                                      |
| `POST/DELETE /api/account/deletion` | Request/cancel account deletion                                   | Step-up auth required; cascades on actual purge (`data-retention.integration.test.ts`) |

## Domain management

| Path                                                         | Purpose                                               | Plan                         | Notes                                                                             |
| ------------------------------------------------------------ | ----------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------- |
| `/app/domains`                                               | Saved-domains dashboard, groups/filters, batch import | Limits vary                  | `Select` filters fixed for `aria-label` a11y                                      |
| `/app/domains/[domainId]`                                    | Domain detail: scan history, actions                  | Any                          | Score-label bug fixed; zero-domain-account SSR crash was on `/app`, not this page |
| `GET/POST /api/domains`                                      | List/create saved domain                              | Domain count capped by plan  | —                                                                                 |
| `GET/PATCH/DELETE /api/domains/[domainId]`                   | Read/update/soft-delete                               | Ownership checked            | —                                                                                 |
| `POST /api/domains/[domainId]/scan`                          | Trigger manual scan                                   | Monthly count capped by plan | `AUDIT_ENGINE_ENABLED` gated, same live-flag family as `/api/audit`               |
| `POST /api/domains/batch-import`                             | Bulk-import with per-row error reporting              | Agency feature               | —                                                                                 |
| `GET /api/domains/export.csv`                                | Export saved domains as CSV                           | Plan-gated                   | Unit-tested (`csv.test.ts`) only, no dedicated integration test found             |
| `GET/POST /api/groups`, `PATCH/DELETE /api/groups/[groupId]` | Client-group CRUD                                     | Agency plan                  | —                                                                                 |
| `/app/groups`                                                | Client-groups management UI                           | Agency plan                  | —                                                                                 |

Tests: `domains-flow.integration.test.ts`, `agency-features.integration.test.ts`,
`monitoring.integration.test.ts`, `auth-and-account.spec.ts`.

## Monitoring

| Path                                             | Purpose                                   | Feature flag                                                                                      | Notes                                                                                                                                                                                |
| ------------------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /api/admin/domains/[domainId]/monitoring`  | Admin sets domain monitoring state        | —                                                                                                 | `admin-domains-scans.integration.test.ts`                                                                                                                                            |
| Scheduled monitoring sweep (cron, no HTTP route) | Runs `runMonitoringSweep` for due domains | `AUDIT_ENGINE_ENABLED` (verified-live flag), `scheduler_paused`/`maintenance_mode` runtime config | `MAX_DOMAINS_PER_SWEEP=20` — KNOWN_RISKS.md flags this as "essentially certain" to exceed the 10ms CPU ceiling; execution itself not independently confirmed in production this pass |

## Notifications

| Path                                        | Purpose                         | Notes                                                                                                                                                                |
| ------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/app/notifications`                        | In-app notification list        | Session required, noindex                                                                                                                                            |
| `GET /api/notifications`                    | List notifications              | —                                                                                                                                                                    |
| `GET /api/notifications/unread-count`       | Unread badge count              | —                                                                                                                                                                    |
| `POST /api/notifications/read`, `/read-all` | Mark notifications read         | —                                                                                                                                                                    |
| `POST /api/notifications/feed-token`        | Generate/revoke Atom feed token | Plan-gated                                                                                                                                                           |
| `GET /feed/[token].xml`                     | Per-user Atom feed              | Token-as-credential, no session cookie; generic 404 for any invalid token (prevents probing); **no dedicated test file found by name — flagged as unknown coverage** |

## Billing

| Path                               | Purpose                                   | Prod verification                                                                                                  | Notes                                                                                      |
| ---------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `/app/billing`                     | Plan/checkout/portal entry                | code-present-not-production-verified                                                                               | No dedicated e2e test (KNOWN_RISKS.md notes "Paddle purchase/portal" has no dedicated e2e) |
| `/pay`                             | Standalone checkout page (Paddle overlay) | **verified-live** — "built, deployed, and verified" (IMPLEMENTATION_STATUS.md), checked by `scripts/smoke-test.ts` | Vite SSR dep-optimizer race for `@paddle/paddle-js` was a documented e2e flake source here |
| `POST /api/billing/checkout`       | Create Paddle checkout for a plan         | **verified-live** — price IDs confirmed present in production bindings                                             | Never trusts a client-supplied price ID for entitlement                                    |
| `POST /api/billing/portal-session` | Mint Paddle customer-portal session URL   | code-present-not-production-verified                                                                               | Never called on behalf of another user                                                     |
| `POST /api/billing/webhook`        | Receive/verify/process Paddle webhooks    | **verified-live** — 8 real Paddle-signed events delivered/processed in production 2026-07-28                       | Real **paid** checkout lifecycle still not run                                             |

## Agency

Agency is a plan tier + capabilities cutting across Domain management/Billing/Audit (client
groups, batch import, branded shares) rather than its own route tree, plus:

| Path                                     | Purpose                           | Notes                                                                                                       |
| ---------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `POST /api/agency-branding/logo`         | Upload agency-branding logo to R2 | Content-type sniffed from real magic bytes, never trusts client `Content-Type`; SVG rejected outright (XSS) |
| `GET /api/agency-branding/logo/[...key]` | Serve an uploaded logo object     | Public, keyed by opaque object key                                                                          |

## Admin

All rows: Admin session (`requireAdminSession`/`requireAdminAction`), SSR, noindex,
code-present-not-production-verified (Super Admin Control Center documented as fully built, no
route-level production hit cited).

| Page                                                     | Purpose                                                | Notes                                                                                                                               |
| -------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `/admin`                                                 | Global dashboard                                       | §28.2                                                                                                                               |
| `/admin/users`, `/admin/users/[userId]`                  | User search/detail + sensitive actions                 | Self-suspend explicitly blocked                                                                                                     |
| `/admin/subscriptions`                                   | Subscription table                                     | **Known gap**: `INNER JOIN` hides deleted-account customers                                                                         |
| `/admin/transactions`                                    | Transaction records                                    | Same INNER JOIN gap                                                                                                                 |
| `/admin/webhooks`                                        | Webhook monitoring + retry                             | Idempotent                                                                                                                          |
| `/admin/entitlements`                                    | Temporary entitlement grants/revokes                   | Requires expiry+reason+audit                                                                                                        |
| `/admin/domains`                                         | Global domain table, admin scan (no quota consumption) | §28.8                                                                                                                               |
| `/admin/scans`                                           | Scan operations dashboard                              | §28.9                                                                                                                               |
| `/admin/blocked-targets`                                 | Target blocklist management                            | —                                                                                                                                   |
| `/admin/jobs`                                            | Scheduler health, pause/resume                         | §28.10                                                                                                                              |
| `/admin/registry/{operators,crawlers,releases,rulesets}` | Registry CRUD, verify/deprecate, publish/rollback      | Rollback is forward-only republish                                                                                                  |
| `/admin/findings`                                        | Findings analytics dashboard                           | §28.12                                                                                                                              |
| `/admin/security`                                        | Security event monitoring/resolve                      | §28.13                                                                                                                              |
| `/admin/notices`                                         | System notices/content publish                         | §28.14                                                                                                                              |
| `/admin/incidents`                                       | Incident tracking, updates                             | Feeds `/status` public page                                                                                                         |
| `/admin/settings`                                        | Runtime configuration                                  | Maintenance mode, scheduler pause live here                                                                                         |
| `/admin/health`                                          | Component health overview                              | —                                                                                                                                   |
| `/admin/audit-logs`                                      | Admin audit log viewer                                 | Every admin write logged, zero-bypass verified                                                                                      |
| `/admin/shared-reports`                                  | All shared/branded report links, revoke                | R2 logo deleted on single revoke; bulk-revoke doesn't clean R2                                                                      |
| `/admin/plans`                                           | Plan catalog view                                      | Read-only, likely — no dedicated lib import confirmed by grep, and no `admin-plans.integration.test.ts` found; flagged, not assumed |

~50 admin API routes mirror the pages above 1:1 (full list omitted here for brevity — every one
follows the identical `requireAdminSession`/`requireAdminAction` + matching `lib/admin/*.ts`
pattern; see the individual admin `lib/` files cited throughout this document and
`apps/web/src/pages/api/admin/AGENTS.md` for the authoritative list).

## API (cross-cutting)

| Path                                      | Purpose                                  | Prod verification                     | Notes                                                                |
| ----------------------------------------- | ---------------------------------------- | ------------------------------------- | -------------------------------------------------------------------- |
| `POST /api/analytics/track`               | Record first-party product event         | code-present-not-production-verified  | First-party only per SRS §6.2/§28.13, distinct from the GA deviation |
| `POST /api/test-only/clear-rate-limit`    | Clear rate limits for e2e reruns         | verified-disabled outside local (404) | Added to fix a shared-rate-limit e2e flake                           |
| `POST /api/test-only/grant-super-admin`   | Grant super_admin to a test fixture user | verified-disabled outside local (404) | —                                                                    |
| `POST /api/test-only/seed-failed-webhook` | Seed a synthetic failed webhook row      | verified-disabled outside local (404) | —                                                                    |

## Status/trust/legal

| Path                        | Purpose                                             | Prod verification                                                                                                          | Notes                                                                                |
| --------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `/status`                   | Public system status page, incident-aware           | **verified-live** — IMPLEMENTATION_STATUS.md confirms live flag read; `scripts/smoke-test.ts` checks it against production | Cache-Control 30s; label bug restored per commit `ca6c3c1`                           |
| `/shared/[token]`           | View an agency-branded, client-safe shared report   | code-present-not-production-verified                                                                                       | Never removes disclosed technical/legal limitations even when branded                |
| `/privacy`                  | Privacy policy                                      | code-present-not-production-verified                                                                                       | Discloses GA (SRS §6.2 deviation)                                                    |
| `/terms`, `/acceptable-use` | Legal pages                                         | code-present-not-production-verified                                                                                       | A stale edge cache once served pre-fix copies post-deploy                            |
| `/scanner`                  | Explains scanner/limits, reflects live engine state | **verified-live-pattern** — was found hardcoded during a redesign and fixed to read live                                   | Now matches `status.astro`/`AuditForm`/`api/audit/index.ts`                          |
| `/sitemap.xml`              | Hand-written sitemap, reviewed public pages only    | code-present-not-production-verified                                                                                       | Deliberately excludes `/audit/`, `/shared/*`, `/app`, `/sign-in`, `/admin`, `/dev/*` |

## Static asset / error / redirect

| Path                         | Purpose                                                                           | Notes                                                                                                                                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `404.astro`                  | Custom not-found page                                                             | `prerender` directive not independently confirmed for this file (Astro convention may prerender by default) — flagged as unknown rather than guessed; no test file confirmed to cover it by name |
| Trailing-slash 307 redirects | Astro's Cloudflare Assets binding auto-redirects extension-less prerendered paths | **verified-live** — confirmed "in production today" per KNOWN_RISKS.md; canonical-tag generation is separately, mildly inconsistent about trailing slash (disclosed, not fixed)                  |

## Gaps found while compiling this inventory

- No dedicated test file was found by name for the Atom-feed route (`/feed/[token].xml`).
- `/admin/plans`'s data source could not be confirmed via the same import-grep applied to every
  other admin page.
- `404.astro`'s `prerender` directive could not be confirmed by the same grep pattern used
  elsewhere.
- No route-level test was found covering `/api/billing/checkout` or `/api/billing/portal-session`
  directly (see `BILLING_AND_PLAN_BASELINE.md`).

See `CAPABILITY_MATRIX.md` for the capability-level (cross-route) view of the same evidence.
