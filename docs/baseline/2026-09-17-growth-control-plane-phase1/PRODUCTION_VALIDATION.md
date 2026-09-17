---
Document owner: Engineering owner
Status: current-authoritative (Phase 1 — post-deployment validation)
---

# Production Validation — 2026-09-17

Every fact below was independently verified via live reads (Cloudflare API, direct D1 queries, and
`curl` against the real production/preview URLs) after the owner triggered
`deploy-production.yml` externally — not taken on the deployment workflow's own report alone.

## Deployment

- Two deploy-production.yml runs executed for `9a3f950689e3ff6d9de5065a6f69a0e69b8adc86`, both
  completed `success`: the first (`35206675486`, 8m10s) and a second (`35207920952`) triggered
  shortly after for the same SHA — idempotent (identical code), producing a fresh build/version
  each time.
- **Current live state**, independently read via the Cloudflare Workers API (not inferred from CI):
  deployment `9ca522cb-1a57-4535-b5bc-35cda1e1ec87`, version `a0847529-571a-4294-997c-634d41b6aac0`,
  `source: "wrangler"` (the guarded pipeline, not a manual dashboard deploy), 100% traffic, deployed
  `2026-09-17T10:05:45Z`. (The first run's version, `a403325f...`, was live briefly in between and
  is now superseded by the second run's redeploy of the same commit.)
- Every binding from the pre-deploy version is present unchanged: `DB`, `GOOGLE_*`, `CRUX_*`,
  `PADDLE_*`, `SESSION`, etc. — no binding drift, confirmed against both deployed versions.

## D1 Migrations

Live query against production: **40/40 migrations applied**, latest `0040_rum_vitals.sql`. Both new
Phase 1 migrations (`0039_growth_snapshots.sql`, `0040_rum_vitals.sql`) are live. The new tables
(`gsc_daily_metrics`, `ga4_daily_metrics`, `crux_snapshots`, `rum_vitals`) exist and are correctly
empty — the daily cron (`0 3 * * *`) had already run for today _before_ this deploy went live, so
the first real `growth_collection` execution will be tomorrow's 03:00 UTC run. This is expected,
not a defect.

The reference-data seed step also ran (part of the deploy pipeline): `crw_applebot` (added to
master crawler data this phase — see `CRAWLER_REGISTRY_FRESHNESS_AUDIT.md`) is now live in
production's `crawlers` table. Confirmed via a live query: 24 crawlers, 9 operators, active
published release still `2026.07.3` (unchanged — `crw_applebot` correctly does not appear in any
published release yet).

## Live endpoint checks

- `POST /api/rum` with a malformed payload → `400 VALIDATION_FAILED` (correct).
- `POST /api/rum` with a valid payload → `200 {"recorded":1}` — the endpoint is genuinely live and
  working. The one test row this created was deleted immediately afterward so it doesn't
  contaminate real visitor data.
- `GET /admin/growth` unauthenticated → `302` to `/sign-in`, `cache-control: private, no-store` — no
  data leakage, matches every other admin page's behavior.

## SEO / indexability (live)

- `https://crawlpact.com/` → `200`; `http://` and `www.` both `301` to the canonical host.
- `robots.txt` correct (disallows `/api/`, `/audit/`, `/app`, `/sign-in`, `/dev/`; declares the
  sitemap).
- `sitemap.xml`: **80 URLs**, all `https://crawlpact.com/...`.
- `app.crawlpact.com/` → `200` with `x-robots-tag: noindex, nofollow, noarchive` — app host remains
  non-indexable, exactly as designed. No `app.crawlpact.com/sitemap.xml` exists.
- `preview.crawlpact.com/` → `200` with `x-robots-tag: noindex, nofollow, noarchive, nosnippet`.
- Canonical tag on the homepage: `<link rel="canonical" href="https://crawlpact.com/">`.
- `/crawlers/applebot-extended/` → `200` (published); `/crawlers/applebot/` → `404` (correctly not
  live yet — not in any published release).
- Registry version shown on the homepage/sample-report: `2026.07.3` — matches the live active
  release. (`2026.07.2`, also present, is the separate, correctly-current ruleset version — not a
  stale-registry-version regression; see `REGISTRY_VERSION_STRING_CHECK.md`.)

## Security headers (live)

HSTS (`max-age=63072000; includeSubDomains; preload`), CSP, `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY` all present on the public homepage, unchanged from before this deploy —
nothing in this phase touched `security-headers.ts`.

## Host boundary (live)

- `POST /api/billing/webhook` on the app host → `404` (correctly rejected; webhook is apex-only).
- `POST /api/billing/webhook` on the apex with no valid signature → `403` (correctly fails closed,
  not a 500 or an accepted request).
- Sign-in page (`app.crawlpact.com/sign-in`) → `200`; app root → `200` (app-shell for an anonymous
  visitor). Google Sign-In's "Google" label is present in the static HTML; the actual GSI script/
  button renders after client-side hydration (a `client:load` island), which a plain `curl` cannot
  observe — full interactive confirmation would need a real browser session, not attempted here to
  avoid re-treading the local-environment instability documented earlier in this phase.

## Governance

- Repository ruleset `main-protection`: still active (already proven functionally correct — PR #202
  merged cleanly through it with the `CI` required check).
- Secret scanning: enabled, **0 open alerts**.
- 12 Dependabot PRs: unchanged from the last triage (`DEPENDENCY_DECISIONS.md`) — not re-merged in
  this pass, deliberately, per that document's own conservative recommendation.

## First-party product funnel (real, live, aggregate-only)

Read directly from `product_events`/`users`/`domains`/`subscriptions` — aggregate counts only, no
row-level customer data inspected:

| Event                    | Count |
| ------------------------ | ----- |
| `landing_viewed`         | 1,045 |
| `pricing_viewed`         | 215   |
| `account_started`        | 84    |
| `checkout_started`       | 49    |
| `result_viewed`          | 46    |
| `audit_started`          | 32    |
| `audit_completed`        | 32    |
| `domain_saved`           | 11    |
| `account_created`        | 6     |
| `subscription_activated` | 4     |

Account-created → audit-completed and further-funnel ratios: `account_created / account_started` =
6/84 (7.1%); `subscription_activated / account_created` = 4/6 (66.7%) — both real, but from small
absolute numbers, not something to over-interpret.

State counts: 6 total users (1 admin), 11 saved domains (10 actively monitored), 4 active
subscriptions (0 past-due), WAU = 5, MAU = 5 (7-/30-day distinct users with a product event —
identical because total volume is small enough that the same handful of users account for both
windows).

**This pass could not reliably separate "external" from "owner/internal/test" accounts** from
aggregate data alone — there is no schema field marking an account as internal, and determining it
would require inspecting individual account identifying details (display name/email), which this
pass deliberately avoided per the minimal-sensitive-data-access principle explicitly requested. The
product owner is the only one who can make that distinction reliably from their own knowledge of
which of these 6 accounts are theirs. Reporting these as raw, real, aggregate counts rather than
guessing a split.

## GSC / GA4 / RUM real baselines

**Not available yet** — the scheduled collection job has not executed a single time in production
(next run: tomorrow 03:00 UTC, per the cron schedule; today's run already happened before this
deploy went live). Reporting `0 collection runs, 0 rows` honestly rather than fabricating figures,
consistent with this phase's own standing rule against presenting synthetic data as a real outcome.
The one manual `/api/rum` test beacon sent during endpoint verification was deleted immediately
after, so it does not appear in this count either.
