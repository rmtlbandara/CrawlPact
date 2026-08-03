# Changelog

This file tracks engineering-level changes to the CrawlPact repository. For the customer-facing
changelog, see the `/changelog` page on the public website.

Format: dated entries, newest first, inspired by [Keep a Changelog](https://keepachangelog.com/),
adapted for this repository's pass/phase-based workflow. Most entries already carry `### Added` /
`### Changed` / `### Fixed` / `### Security` / `### Removed` subsections where more than one kind
of change occurred in the same pass — kept as originally written rather than retrofitted, per
Phase 1's rule against fabricating or restructuring verifiable history. Add new entries under
**Unreleased** below and give them a dated section heading once actually deployed to production —
this distinguishes a code merge from a production deployment, which are not the same event (see
the "Production deployment" entries below for the established pattern).

## Unreleased

### Added

- Phase 2 (Brand Positioning and Messaging System): established
  `docs/brand/{BRAND_POSITIONING_AND_MESSAGING_SYSTEM,VOICE_AND_STYLE_GUIDE,
PRODUCT_TERMINOLOGY_GLOSSARY,CLAIMS_AND_MESSAGING_GUIDE,MESSAGING_SURFACE_INVENTORY,
GITHUB_BRAND_METADATA_MANIFEST}.md`, a central `apps/web/src/config/brand.ts` module, and
  `pnpm brand:validate` (wired into CI's `quality` job) — see
  `docs/reports/PHASE_02_BRAND_POSITIONING_MESSAGING_COMPLETION_REPORT.md`.

### Changed

- Centralised previously-duplicated brand strings (product name, category, canonical
  descriptions) into `apps/web/src/config/brand.ts` and wired it into `BaseLayout.astro`'s
  JSON-LD/`og:site_name`, the homepage `<title>`/meta description, `SiteFooter.astro`, and
  `SiteHeader.astro`.
- Corrected `AuditForm.tsx`'s primary CTA button from "Audit domain" to "Audit a domain", matching
  the wording already used consistently everywhere else in the product (`SiteHeader.astro`,
  crawler/guide detail pages) — updated the four e2e tests that referenced the old button text.
- Updated root `package.json`'s `description` field to match the new canonical public category.

### Not fixed (deliberately deferred, see `docs/brand/MESSAGING_SURFACE_INVENTORY.md`)

- SRS §2.3's Primary Tagline conflicts with the new canonical brand tagline — recorded as
  RISK-028, routed to Phase 3 for an SRS update or ADR, not silently edited.
- Raw scan-status enum display in the authenticated domain-detail scan-history list, and no
  customer-facing `scan_diffs` change-timeline UI — both routed to Phase 8.

### Added (Phase 3 — Legal Identity, Contact, Security and Trust Foundation)

- A `/contact` page, `/.well-known/security.txt` (RFC 9116), and a content/crawler-registry
  correction process on `/methodology` — none of these existed before this phase.
- `docs/trust/{LEGAL_AND_TRUST_SURFACE_INVENTORY,TRUST_AND_LEGAL_CONFIGURATION}.md`,
  `docs/security/RESPONSIBLE_DISCLOSURE_PROCESS.md`,
  `docs/privacy/{DATA_CATEGORY_AND_PURPOSE_INVENTORY,PRIVACY_REQUEST_PROCESS}.md`, and
  `pnpm trust:validate` (wired into CI) — see
  `docs/reports/PHASE_03_LEGAL_SECURITY_TRUST_COMPLETION_REPORT.md`.
- `ContactPoint` structured-data entries on `BaseLayout.astro`'s JSON-LD `Organization` node.

### Changed (Phase 3)

- Filled in `apps/web/src/lib/trust-config.ts`'s previously-`null` legal-identity fields with
  product-owner-approved values: operator name ("CrawlPact", no corporate suffix), governing
  jurisdiction ("Sri Lanka"), and five contact addresses (privacy/security/support/
  corrections/billing) — see `docs/trust/TRUST_AND_LEGAL_CONFIGURATION.md`. Registered address
  and registration number remain deliberately `null`.
- Rewrote `/privacy` and `/terms` to the full required structure (data-category distinctions,
  cookies, retention, billing/Paddle, rights, governing law, contact, etc.), verified directly
  against code (account deletion, data retention, Paddle cancellation/refund behaviour, analytics
  scope, IP handling).
- Corrected `/terms` and `/acceptable-use`'s "you may only submit domains you own, manage, or are
  otherwise authorised to audit" claim — verified against code that the free audit has no
  ownership-verification logic at all; reworded to require lawful and responsible use instead.
- Added a full responsible-disclosure policy (scope, contact, reporter guidance, prohibited
  testing, safe-harbour wording) to `/security`; updated the stale root `SECURITY.md` (previously
  said "no live scanner, authentication, billing, or admin surface exists yet").
- Added operator/jurisdiction wording and trust-route links to `/about`.
- Added a "Contact" link to `SiteFooter.astro` and `/contact` to `sitemap.xml.ts`.
- Updated `docs/release/LEGAL_INFORMATION_CHECKLIST.md` and RISK-011 (`docs/risks/ACTIVE_RISKS.md`)
  to reflect what's now resolved vs. still genuinely blocked (address, registration number, tax
  information). Re-routed RISK-004 to Phase 13 (Phase 3 is barred from changing analytics
  behaviour).

### Not fixed (deliberately deferred, see `docs/trust/LEGAL_AND_TRUST_SURFACE_INVENTORY.md`)

- Registered business address, registration number, and tax information — still genuinely
  unavailable, not invented (RISK-011, routed to Phase 18).
- No cookie-consent mechanism for Google Analytics (RISK-021) and no purge job for
  `product_events`/`security_events`/`notifications` (RISK-006) — both accurately disclosed in
  the rewritten Privacy Policy, neither resolved; routed to Phase 13 and Phase 11 respectively,
  per this phase's explicit scope boundary against changing analytics/retention behaviour.

## Production deployment (2026-07-31)

PR #59 (this release's full change set, squash-merged as `e245793`) deployed to production via
`deploy-production.yml`. The `0018_incidents.sql` migration applied cleanly to the live D1
database; the Worker deployed and binding verification passed; the post-deploy smoke test then
caught a real regression: the rewritten `/status` page (part of #59) had silently dropped the
literal `"Free audit (real scan)"` / `"Available"` capability-honesty label the smoke test (and
the underlying `AUDIT_ENGINE_ENABLED` honesty requirement) depends on, replacing it with a
paraphrase. Production was live with this defect for approximately 45 minutes.

Fixed in a dedicated one-line hotfix (PR #60, squash-merged as `ca6c3c1`), verified locally
(fresh build, prettier, direct dev-server `curl`), CI-checked, and redeployed via a second
`deploy-production.yml` run against `ca6c3c1` — that run's smoke test passed in full. Independently
re-verified afterward by running `scripts/smoke-test.ts production https://crawlpact.com` directly
against the live site: **32/32 checks passed**, including live confirmation that
`robots.txt` now serves the corrected `Disallow: /audit/` form (PR #58), the homepage artwork
section is fully absent, the four trust-config-driven dates render correctly, and the new
Amazon crawler pages (`/crawlers/amzn-searchbot/`, `/crawlers/amzn-user/`) are live.

## Final release pass: robots.txt cleanup, homepage artwork removed, trust-metadata config (2026-07-31)

Full log: `docs/reports/CRAWLPACT_PRODUCTION_CONTENT_TRUST_SEO_AUDIT.md` §25 (final synthesis).

### Fixed

- Source-controlled `apps/web/public/robots.txt`: `Disallow: /audit/*` → `Disallow: /audit/`
  (the standard path-prefix form; the wildcard was non-standard and unnecessary since
  `Disallow: /audit/` already excludes everything under that path per RFC 9309). Landed and
  merged to `main` in PR #58 (commit `fd8eae5`), with a dedicated regression test
  (`apps/web/src/lib/robots-txt.test.ts`, 5 assertions) asserting no AI-crawler-specific
  directives are ever reintroduced into this file.

### Removed

- The homepage's inline-SVG "Policy Evidence Map" artwork section
  (`apps/web/src/components/PolicyEvidenceMap.astro`, wired into `index.astro`'s hero) — built and
  shipped earlier in this workstream, then removed at the product owner's explicit instruction
  before this release ("remove only the new section with the art work on the home page. It is not
  appropriate."). Fully removed with no residual references, imports, or CSS; verified via a clean
  rebuild and a direct grep of rendered HTML output for zero matches.

### Added

- `apps/web/src/lib/trust-config.ts` — a single typed source (`TRUST_CONFIG`) for trust-relevant
  facts referenced on multiple pages (billing/infrastructure/analytics providers, policy
  effective dates, registry/ruleset version labels, data-retention summary), so a date or provider
  name is defined once instead of re-typed identically across `privacy.astro`, `terms.astro`,
  `acceptable-use.astro`, and `methodology.astro`. Legal-identity fields
  (`legalEntityName`, `registeredAddress`, `governingJurisdiction`, `securityContact`,
  `privacyContact`, `correctionsContact`) are explicitly `null`, not a placeholder string — see
  `docs/release/LEGAL_INFORMATION_CHECKLIST.md`, which nothing in this repository fabricates a
  value for. Wired the four legal/methodology pages to read their "Effective and last updated" /
  "Last substantive update" dates from this config instead of a hand-typed literal string;
  rendered output verified unchanged (`30 July 2026`, `31 July 2026`).

### Clarified (no behavioral change)

- Reworded `docs/release/LEGAL_INFORMATION_CHECKLIST.md` and its `docs/status/KNOWN_RISKS.md`
  entry from "release blocker" to "deferred, scoped items only" — the missing legal-identity
  information blocks a specific, named set of items (governing-law clause, named data controller,
  `/.well-known/security.txt`, a public corrections channel), not this release as a whole. This
  reflects the product owner's explicit 2026-07-31 instruction to proceed with release despite
  this known, tracked, and honestly-disclosed gap.

## Cloudflare AI-bot block resolved; platform-specific guide content added (2026-07-31)

Full log: `docs/reports/CRAWLPACT_PRODUCTION_CONTENT_TRUST_SEO_AUDIT.md` §24.

### Fixed

- **CrawlPact's own production `robots.txt` no longer blocks the AI crawlers its product audits.**
  The product owner disabled Cloudflare's Managed robots.txt / AI-bot-blocking feature in the
  dashboard (not something this session's API token has permission to read or change).
  Independently re-verified by fetching live production `robots.txt` directly: it now matches
  `apps/web/public/robots.txt` exactly, with no Cloudflare-managed block and none of the
  previously-present per-crawler `Disallow` rules. No repository file changed for this fix — it
  was a Cloudflare zone-configuration change outside version control.

### Added

- Concrete, source-verified platform-specific implementation steps (Netlify `_headers`, Vercel
  `vercel.json`, Cloudflare Pages/Workers `_headers`, WordPress `functions.php`/plugin) added to
  `how-to-set-the-content-signal-header.md`, `how-to-publish-an-llms-txt-file.md`, and
  `how-to-publish-an-rsl-declaration.md`, replacing "consult your platform's own documentation"
  with actual syntax — Netlify and Vercel syntax verified directly against current official docs.

### Still unresolved (confirmed independently, not modified)

Legal entity name, registered address, jurisdiction, and contact details
(`docs/release/LEGAL_INFORMATION_CHECKLIST.md`) — every field still reads `(not provided)`.

## Crawler page "Site-owner controls" standardization (2026-07-31)

Full log: `docs/reports/CRAWLPACT_PRODUCTION_CONTENT_TRUST_SEO_AUDIT.md` §23.

### Changed

Replaced generic "Standard robots.txt disallow rules apply" boilerplate (or added a missing
section entirely) on 14 crawler-reference pages with crawler-specific content explaining what
blocking that token affects and which sibling tokens from the same operator remain unaffected:
`amazonbot.md`, `googlebot.md`, `googleother.md`, `google-cloudvertexbot.md`,
`meta-externalads.md`, `meta-externalfetcher.md`, `meta-webindexer.md`, `amzn-searchbot.md`,
`amzn-user.md`, `applebot-extended.md`, `ccbot.md`, `meta-externalagent.md`, `oai-searchbot.md`,
`perplexitybot.md`. `gptbot.md` and `google-extended.md` were reviewed and found to already meet
the bar under a differently-named heading — left unchanged. No frontmatter, metadata, or test
changes required; `lastVerified` dates intentionally not bumped (facts reused from already-verified
data on file, not freshly re-checked against a primary source this pass).

## Crawler and guide content-completeness pass (2026-07-31)

Full log: `docs/reports/CRAWLPACT_PRODUCTION_CONTENT_TRUST_SEO_AUDIT.md` §22.

### Added

- Crawler pages (`crawlers/[slug].astro`, applies to all 22 pages identically): an example
  `robots.txt` block generated from each crawler's real token, a wildcard-fallback explanation,
  a link to the AI crawler checker tool, and a source-verification note linking to
  `/methodology#registry-verification` (new anchor added to that heading).
- `relatedCrawlerSlugs` field on the guides content schema, set on the 7 guides genuinely about
  specific crawlers — crawler pages now show a real "Related guides" section derived from this,
  not keyword-matching.
- Tool links added to 5 decision guides that named the AI crawler checker's use case without
  linking to it; `google-extended-vs-googlebot.md` fixed to link to both crawler pages it discusses
  by name (previously linked to neither despite mentioning both repeatedly).

### Fixed

- A repeat instance of the round-5 Astro whitespace-collapsing bug, introduced by this round's own
  new template code — caught by re-running the same static sweep before shipping, fixed and
  verified via rendered HTML.

## Editorial policy, incident tracking system, trust-metadata config (2026-07-31)

Full log: `docs/reports/CRAWLPACT_PRODUCTION_CONTENT_TRUST_SEO_AUDIT.md` §21. Design doc for the
incident system: `docs/architecture/INCIDENT_TRACKING_SYSTEM_DESIGN.md`.

### Added

- `docs/seo/EDITORIAL_SOURCE_AND_CONTENT_POLICY.md` — editorial ownership, acceptable sources,
  conflict resolution, review workflow, and an explicit, honest statement of how AI assistance is
  used in producing content.
- **Incident tracking system**: `packages/database/migrations/0018_incidents.sql` +
  `schema/incidents.ts` (two new, purely additive tables — `incidents`, `incident_updates`;
  actor references nullable with `ON DELETE SET NULL` from the start), `lib/status/components.ts`
  (canonical component list), `lib/admin/incidents.ts` + `api/admin/incidents/**` (admin
  create/update, mirroring the existing `system_notices` feature's auth/audit pattern),
  `components/admin/IncidentsManager.tsx` + `pages/admin/incidents/index.astro` (Super Admin UI,
  added to `AdminNav.astro`), `lib/status/public-status.ts` (the public status adapter —
  incidents can only escalate a component's status, never mask a worse internal signal).
  `status.astro` rewritten to show overall status, per-component status, current incidents with
  full update timelines, scheduled maintenance, recently-resolved incidents, and an honest
  "no uptime measurement exists yet" statement instead of a fabricated percentage.
- `docs/release/LEGAL_INFORMATION_CHECKLIST.md` — every required legal field explicitly marked
  `(not provided)`; no value invented.
- `docs/status/BILLING_WEBHOOK_RACE_TEST_FLAKE.md` — precise root cause (the test's
  `Promise.all`-fired requests can complete in either order; the handler's out-of-order protection
  is correct, the test's fixed-outcome assertion is not) and recommended remediation. Neither the
  handler nor the test was changed.
- Tests: `admin-incidents.integration.test.ts` (8 tests, real D1) and `status/components.test.ts`
  (4 unit tests).

### Fixed

- **12 instances of a real, sitewide Astro whitespace-collapsing bug** (`<code>`/`<a>` content
  directly abutting the preceding word with no rendered space, e.g. "Try<code>example.com") across
  7 files — including one on the homepage hero that predates this workstream, confirming it's a
  genuine pre-existing pattern. All fixed with an explicit `{" "}` separator and verified via
  direct HTML output inspection, not just re-reading the source.

### Deliberately not done

- The new migration was applied to the **local** D1 database only, to exercise the feature during
  development — not to production. Applying it to production and deploying this code are separate
  production-infrastructure actions requiring their own explicit authorization.
- No legal-page rewrites requiring jurisdiction/legal-entity information.
- No change to the billing webhook handler or its out-of-order protection.

All notable changes are grouped by development "Part," per `docs/product/CRAWLPACT_FINAL_SRS.md`
§37.

## Production Content, Trust, and SEO Audit — Phase 7/8/10 gaps (2026-07-31)

Continuation of the audit below. Full log: `docs/reports/CRAWLPACT_PRODUCTION_CONTENT_TRUST_SEO_AUDIT.md` §19.

### Added

- `/crawlers`: computed (never hard-coded) crawler-page count, operator count, and latest
  verification date, plus a "how entries are verified" explainer.
- `/tools`: a "tool vs. full audit" explainer, per-tool signal labels, and a "how these work"
  section — previously just a title and five one-line links.
- `/methodology`: a signal-support matrix (what CrawlPact can/cannot infer per signal, with
  accurate specification-maturity notes) and a last-substantive-update date.
- `/about`: one paragraph distinguishing CrawlPact from a WAF, crawler blocker, log-analytics
  service, or general-purpose SEO crawler.

### Fixed

- A real WCAG violation (`scrollable-region-focusable`) on the new methodology table, caught by
  `pnpm test:a11y`, fixed by applying the same `tabindex`/`role`/`aria-label` pattern already used
  on `pricing.astro`'s comparison table.

## Production Content, Trust, and SEO Audit — P0/P1/P2 fixes (2026-07-30)

Full findings and implementation log: `docs/reports/CRAWLPACT_PRODUCTION_CONTENT_TRUST_SEO_AUDIT.md`.

### Fixed

- Removed the "Draft — not yet reviewed by a lawyer" banner from `/privacy`, `/terms`, and
  `/acceptable-use`.
- Removed "Super Admin Control Center" from the public `/status` capability list.
- Removed three leaked internal `SRS FR-xxx`/`§xx` citations from user-facing strings: the
  homepage FAQ (+ its `FAQPage` JSON-LD), a public guide, and the passkey-removal API error.
- Fixed a canonical/redirect mismatch affecting every crawler and guide detail page — the
  canonical tag pointed at a non-trailing-slash URL that itself 307-redirected, instead of the
  URL Cloudflare actually serves. Sitemap and internal "Related" links updated to match.
- Fixed a dead citation URL for the `Google-Extended` registry entry.
- Added visible effective/last-updated dates to `/privacy`, `/terms`, `/acceptable-use`.
- Unified the previously hand-duplicated CSP/security headers between `middleware.ts` and
  `public/_headers` into one shared source (`lib/security-headers.ts`), with a test asserting the
  two stay in sync.
- **Social preview images were silently broken on every page**: the site served a single SVG for
  `og:image`, but Facebook, X, LinkedIn, Slack, Discord, WhatsApp, and iMessage do not reliably
  render SVG as a link-preview image. Replaced with real PNGs (1200×630), rasterized from source
  SVGs via Playwright (already a project dependency — no new dependency, no image-generation
  service) by `scripts/generate-og-images.mjs`, with category-specific variants for the homepage,
  crawler directory, guides, and tools.

### Added

- `Amzn-SearchBot` and `Amzn-User` as separate crawler-registry entries and public reference
  pages, verified directly against Amazon's own documentation, consistent with how other
  multi-token operators (OpenAI, Anthropic, Perplexity, Meta) are already modeled. Publishing this
  as production's active registry release still requires a proper release-publish action — noted
  as a manual follow-up in `docs/registry/CRAWLER_REGISTRY_GOVERNANCE.md`.
- `WebApplication` structured data on `/pricing`, built from the same `plans` array the visible
  pricing table renders (no separate, driftable data).
- `HowTo` structured data on guides with genuine `Step N:` headings (4 guides qualified).
- Substantive "What this checks" / "What this doesn't check" / "Related" content on all 5 free
  tool pages, which previously had only a form and a one-line description.

### Investigated, not resolved here

- CrawlPact's own production `robots.txt` (via a Cloudflare-managed "Managed content" block)
  disallows GPTBot, ClaudeBot, Google-Extended, CCBot, Applebot-Extended, Amazonbot, Bytespider,
  and `meta-externalagent` from crawling `crawlpact.com` itself. Traced to Cloudflare's Bot
  Management `ai_bots_protection` zone setting — but the connected API token lacks the Bot
  Management permission scope, so it could not be read or changed via API. Needs either a broader
  token scope or a manual change in the Cloudflare dashboard (Security → Bots).
- Legal entity name, registered address, jurisdiction, and a verified contact channel remain
  undetermined — deliberately not fabricated. Recorded as a release blocker; blocks `/terms`'
  governing-law clause and a real `/.well-known/security.txt`.

## Release-Flow Remediation Phase 2 — Shared Auth Fixtures, Automerge Reliability (2026-07-30)

### Added

- `apps/web/tests/e2e/setup/customer.setup.ts` / `admin.setup.ts` — Playwright "setup project"
  fixtures that register one real account each, save authenticated `storageState`, and let other
  specs opt in via `test.use({ storageState: ... })` instead of re-running a real WebAuthn
  ceremony. `admin-flows.spec.ts` (4 tests) and `responsive-smoke.spec.ts` (2 tests) migrated,
  cutting 6 independent ceremonies down to 2. See `docs/testing/TEST_STRATEGY.md`.

### Fixed

Three real bugs found while `merge-when-green.yml` handled its first few automated merges (PR
#44-#47) — all now self-healing for future PRs:

- Merges made with the workflow's default `GITHUB_TOKEN` never triggered `ci.yml`'s `push`
  trigger on `main` (documented GitHub anti-recursion behavior) — `deploy-production.yml`'s
  "CI succeeded for this exact commit" check would have permanently refused every automerged
  commit. Fixed by adding `workflow_dispatch` to `ci.yml` and having `merge-when-green.yml`
  explicitly call it after a successful merge.
- That fix itself needed `actions: write`, missing from the workflow's `permissions:` block —
  added.
- `ci.yml`'s new `workflow_dispatch` trigger made `gitleaks-action` fall back to a full-history
  scan (no commit range to diff incrementally) instead of its usual incremental scan, surfacing
  `PUBLIC_PADDLE_CLIENT_TOKEN` — a value that's intentionally public (Paddle.js needs it
  client-side, already documented as such) — as a false-positive leak. Fixed with a narrow
  `.gitleaks.toml` allowlist entry for that one value; the real ruleset is unchanged.

See `docs/status/KNOWN_RISKS.md` for full root-cause detail on each.

## Release-Flow Remediation Phase 2 — Nav Overflow Fixes (2026-07-30)

Fixed the two real, disclosed responsive-layout bugs the new `responsive-smoke.spec.ts` suite
surfaced during Phase 1 (see `docs/status/KNOWN_RISKS.md`), rather than leaving them deferred.

### Fixed

- **`SiteHeader.astro`'s desktop nav overflowed at 640/768px** (the "Audit domain" button ran
  off-screen) — the nav switched on at this project's remapped `md:` breakpoint (640px, not
  Tailwind's stock 768px the original bug report mischaracterized it as), too narrow for the full
  row. Moved the switch to `xl:` (1024px).
- **Customer dashboard (`AppNav.astro`) had no mobile nav at all** — built `AppMobileNav.tsx`
  mirroring the existing `MobileNav.tsx`/`AdminMobileNav.tsx` pattern.
- **Super Admin shell's header bar overflowed at 360/768px** — not the sidebar (`AdminMobileNav`
  already worked correctly), but the surrounding header's display name and "Customer view" link
  rendering unconditionally. Hid the display name below `sm:`, made "Customer view" icon-only
  below `xl:`.
- Corrected several stale doc/comment claims describing this project's remapped breakpoint scale
  (`packages/ui/src/tokens/tokens.css`) using Tailwind's stock `md:`/`lg:` meanings.

## Release-Flow Remediation — CI Redesign, Visual Regression Removal (2026-07-29)

Made the development/release flow fast, deterministic, and free of repository-controlled
blockers, per a full audit of GitHub Actions history, live GitHub/Cloudflare/Paddle
configuration, and this repo's own accumulated `KNOWN_RISKS.md` evidence.

### Removed

- **Pixel-by-pixel visual regression** (`.github/workflows/visual-regression.yml`,
  `playwright.visual.config.ts`, `apps/web/tests/visual/**`, ~51MB of committed baseline PNGs) —
  it failed ~9.5% of the time on a re-run of an identical, already-baselined commit, and a
  readiness-signal fix attempt (commit `51f984b`) did not resolve it. See
  `docs/architecture/adr/ADR-0008-remove-pixel-visual-regression.md`.

### Added

- `apps/web/tests/e2e/responsive-smoke.spec.ts` — deterministic functional responsive tests
  (no horizontal overflow, key content reachable, mobile nav usable, keyboard focus visible) at
  360/768/1280px, replacing the removed visual suite.
- `pnpm ui:review` (`scripts/ui-review.ts`) — optional, git-ignored screenshots for manual human
  review only; never a CI gate or committed baseline.
- `pnpm verify:push` (`scripts/verify-push.sh`) and `pnpm check:fast` — local commands that
  reproduce the required CI gate (and a fast subset of it) before pushing.
- `.github/workflows/merge-when-green.yml` — an owner-controlled auto-merge substitute (squash-
  merges an `automerge`-labeled PR once CI succeeds for its exact head SHA), since this
  repository's GitHub plan can't gate native auto-merge on required status checks (branch
  protection returns `403`, confirmed live).
- `docs/architecture/adr/ADR-0008-remove-pixel-visual-regression.md`.

### Changed

- `.github/workflows/ci.yml` redesigned: `quality` and a new `browser-smoke` job now run
  concurrently (no `needs:` dependency), with a `ci-gate` aggregate as the one required check.
  `browser-smoke` runs required Chromium-only E2E/accessibility tests (one worker, one retry — a
  flaky test is now a real reported failure, not silently re-run green). Testing against a real
  built Worker (`wrangler dev --local`) instead of Astro's dev server was attempted and reverted
  after it reproducibly crashed the dev server when a test's direct D1 write (a separate
  `wrangler d1 execute --local` process) ran concurrently with the live server's own D1
  connection — a disclosed follow-up, see `docs/status/KNOWN_RISKS.md`.
- `seo-metadata.spec.ts`'s canonical-tag check now compares against the final served URL rather
  than the pre-redirect request path, normalizing trailing slashes — the real Cloudflare Assets
  binding 307-redirects extension-less paths to their trailing-slash form (confirmed the same in
  production today), which Astro's dev server doesn't exercise but was briefly tested against
  while designing this change.
- Repository merge settings: squash-only (`allow_merge_commit`/`allow_rebase_merge` now `false`),
  `delete_branch_on_merge` now `true`.

### Known, disclosed gaps from this pass (see `docs/status/KNOWN_RISKS.md`)

- `deploy-preview.yml` is currently broken (a GitHub Environment secret naming mismatch) —
  requires the repository owner to reset the `preview` Environment's secrets, since it needs a
  live credential value this session shouldn't handle.
- The customer dashboard and Super Admin shell nav bars genuinely overflow at 360/768px (a
  pre-existing, disclosed, out-of-scope bug the new responsive-smoke tests surfaced).
- The public site's `SiteHeader` desktop nav genuinely overflows at exactly 768px (Tailwind's
  `md:` breakpoint, where it switches on, is narrower than the nav actually needs) — found via a
  real CI run, disclosed and out of scope here.
- Deeper E2E stability work (shared auth fixtures instead of ~13 independent passkey
  registrations, a deterministic SSRF-safe scanner test target to remove the `example.com`
  dependency from required CI) is deliberately deferred to a follow-up pass.

## Post-Launch Trust Fixes — Legal Pages, Domain Re-save, Branding (2026-07-29)

Two direct `wrangler deploy` pushes straight to production this session (bypassing the guarded
`scripts/build.sh` pipeline added below) put a stale build live again, re-surfacing the
"Local Development environment" banner bug on `crawlpact.com`'s marketing pages. Root cause
was already fixed 2026-07-27 (see below); it only reproduces when deploying from a build that
didn't go through `scripts/build.sh`, e.g. a local `wrangler deploy` run from a machine with a
`.dev.vars` file present. No code change needed here — the fix is deploying through the gated
`deploy-production.yml` workflow, which builds from a clean checkout.

### Fixed

- **Privacy Policy, Terms, and Acceptable Use all cited a nonexistent SRS section.** Every one
  said "Draft, pending formal legal review before production launch (see SRS §39)" — the SRS
  has no §39, and no section anywhere addresses legal review. Live since the very first commit,
  on pages real signed-up users rely on. Replaced with an honest notice that doesn't cite a
  document it isn't in: "Draft — not yet reviewed by a lawyer."
- **Re-saving a previously-removed domain returned a generic 500.** `domains` had a table-wide
  `UNIQUE(owner_user_id, canonical_origin)`, but removal is a soft delete (`deleted_at` only);
  the app's duplicate check filtered to live rows, missed the leftover soft-deleted row, and hit
  the real unique index on insert. Replaced with a partial unique index scoped to
  `WHERE deleted_at IS NULL` (migration `0017_domains_unique_origin_excludes_soft_deleted.sql`,
  applied to production D1).

### Added

- A real CrawlPact logo mark (SRS §10.13) wired into favicon, OG image, public header, app nav,
  admin sidebar, footer, and printed/exported audit reports (§10.44) — all previously showed
  plain text or a placeholder letter.

## Release-Engineering Hardening — CI/CD Pipeline, Environment Contract, Live Production Bugs (2026-07-27)

Full audit and implementation of the development-to-production lifecycle: git/GitHub/Cloudflare/
Paddle read-only reconciliation, then a focused branch implementing the fixes. See
`docs/architecture/adr/ADR-0007-DEPLOYMENT-PIPELINE.md` for the full reasoning.

### Fixed

- **CI had failed on every push since `gitleaks-action` was introduced** — `results.sarif` written
  to the repo root broke `pnpm format:check` every single run; no prior "quality gate passed"
  claim in any commit message was ever actually confirmed green in CI. Fixed via
  `.prettierignore`/`.gitignore`.
- **Production's prerendered marketing pages shipped a "Local Development environment" banner**
  baked into the static HTML — root cause: Astro's Cloudflare adapter resolves environment
  variables for static prerendering from a machine-local `.dev.vars` file first, regardless of
  shell env vars or `CLOUDFLARE_ENV`. `scripts/build.sh` now refuses to build for preview/production
  if `.dev.vars` exists anywhere in the checkout.
- **Prerendered/static pages served zero security headers** (no CSP, `X-Content-Type-Options`,
  HSTS) — they bypass `middleware.ts` entirely via the Workers Assets binding.
  `apps/web/public/_headers` now carries the same header set.
- **`env.preview.vars` in `apps/web/wrangler.jsonc` was missing `PADDLE_PRICE_ID_*` and
  `PUBLIC_PADDLE_CLIENT_TOKEN` entirely** — `vars` is non-inheritable per named environment in
  Wrangler's model, so preview never had these at all. Caught by the new `pnpm env:validate:preview`.
- **`PUBLIC_PADDLE_CLIENT_TOKEN` was missing from the canonical Zod env schema**
  (`packages/config/src/env.ts`) despite being required everywhere else.
- Preview's `PUBLIC_SITE_URL`/`WEBAUTHN_RP_ID`/`WEBAUTHN_RP_ORIGIN` referenced
  `preview.crawlpact.com`, which doesn't exist — updated to the real, confirmed-live
  `crawlpact-web-preview.rmtlbandara.workers.dev`.
- Checkout and customer-portal-session API routes did not check whether billing was actually
  configured before handing back a (possibly placeholder) Paddle client token — now gated by
  `isPaddleBillingConfigured()`, returning a controlled `SERVICE_UNAVAILABLE` instead.

### Added

- `BILLING_ENABLED` environment flag (local/preview `false`, production `true`) as the
  authoritative deployment-intent gate, cross-validated against `PADDLE_ENVIRONMENT`/
  `PUBLIC_APP_ENV` (local/preview can never carry a live Paddle credential, enforced by a Zod
  `.superRefine()`, not just convention).
- `scripts/env-validate.ts`, `scripts/build.sh`, `scripts/deploy.sh`,
  `scripts/verify-bindings.ts`, `scripts/smoke-test.ts` and the matching `pnpm env:validate:*` /
  `build:*` / `deploy:*` / `smoke:*` scripts.
- `.github/workflows/deploy-preview.yml` (automatic after CI succeeds on `main`) and
  `.github/workflows/deploy-production.yml` (`workflow_dispatch`, typed confirmation, commit must
  be contained in `main`) — the first automated deploy path this repository has ever had.
- `.github/PULL_REQUEST_TEMPLATE.md`, `.github/dependabot.yml`, `.vscode/` workspace config.
- `docs/architecture/adr/ADR-0007-DEPLOYMENT-PIPELINE.md`,
  `docs/deployment/GITHUB_ACTIONS_DEPLOYMENT.md`, `docs/deployment/GITHUB_DESKTOP_WORKFLOW.md`,
  `docs/release/RELEASE_CHECKLIST.md`, `docs/release/ROLLBACK_RUNBOOK.md`.

### Documentation

Corrected several stale claims found during this pass: `IMPLEMENTATION_STATUS.md` and
`KNOWN_RISKS.md` still described the repository as having zero Git commits;
`PADDLE_LIVE_CONFIGURATION_REPORT.md` and `PADDLE_LIVE_GO_LIVE_CHECKLIST.md` still described
`/pay` as unbuilt after it had shipped; `CLOUDFLARE_ENVIRONMENT_MATRIX.md` said production's
Paddle vars were "Not set" after they'd been confirmed live; `BACKUP_AND_RECOVERY.md` and
`CLOUDFLARE_UPGRADE_TRIGGERS.md` still said no production Cloudflare account existed. See
`docs/status/KNOWN_RISKS.md`'s "Release-engineering hardening pass" section for the full list,
including new findings not yet resolved (Cloudflare Workers Builds' broken competing deploy
integration, a Paddle webhook secret inadvertently surfaced in this session's transcript, GitHub
branch protection unavailable on the current plan).

## Cloudflare Infrastructure Alignment — Capacity Audit and Analysis (2026-07-26)

A 23-phase brief requested full alignment of CrawlPact's architecture with an approved Cloudflare
plan (Workers, D1, R2, Workers Static Assets/Pages, DNS/SSL/CDN, Cron Triggers, Paddle). Per the
user's explicit scope: R2 is not adopted (no current technical need), the analysis is framed
around extending Workers Free headroom rather than assuming an immediate Paid upgrade, and all
documentation/analysis phases were completed while risky code changes (wrangler.jsonc hardening,
cache-header implementation, D1 write batching, new tests) were deliberately deferred. See
`docs/status/IMPLEMENTATION_STATUS.md`'s matching entry for the full document list.

### Added

- **Verified current Cloudflare Free-plan limits** (`docs/deployment/CLOUDFLARE_RESOURCE_LIMITS.md`) —
  ~27 limits fetched live against official docs, including confirming D1's 500MB per-database cap
  is distinct from its 5GB account-wide total, and that Cloudflare Pages' "unlimited" claim is
  scoped to static-asset requests only, not Functions/dynamic requests.
- **A full current-state Cloudflare architecture audit** (`docs/deployment/CLOUDFLARE_ARCHITECTURE_AUDIT.md`)
  confirming R2 is unused anywhere in the codebase, production/preview D1 are structurally
  separate, and scan evidence lives entirely in D1 as capped TEXT.
- **ADR-0006**, formalizing the decision to keep Workers Static Assets over a Cloudflare Pages
  split, with the honest caveat that Workers Static Assets requests likely count against the
  shared Workers daily-request budget (unlike Pages' exempt static-asset requests) — not
  independently verified, flagged as a follow-up.
- **A D1/R2 data placement policy** (`docs/data/D1_R2_DATA_PLACEMENT_POLICY.md`) concluding R2 is
  not justified today, with five concrete, evidence-based triggers that would reopen the decision.
- **A D1 storage capacity model** (`docs/data/D1_STORAGE_CAPACITY_AUDIT.md`) finding the production
  database is expected to reach 45–70% of its 500MB cap within one year, and cross it entirely
  between year 1–2, at the SRS's own commercial target — driven by `scan_resources`'s `html_meta`
  rows capturing full homepage HTML rather than just meta tags, compounding across Pro/Agency's
  multi-year retention windows.
- **A scan capacity budget and monitoring capacity plan**
  (`docs/operations/SCAN_CAPACITY_BUDGET.md`, `docs/operations/MONITORING_CAPACITY_PLAN.md`)
  quantifying, for the first time, that a real scan's CPU cost (≈3–7ms typical, ≈12–25ms+ worst
  case) leaves thin-to-negative margin against Workers Free's 10ms ceiling — driven by an
  unbatched D1 write fan-out and an uncapped findings count — and that the scheduled monitoring
  sweep's current 20-domain default batch size is "essentially certain" to exceed that same
  ceiling, with backlog modeled to begin between 5 and 50 Solo customers.
- **Concrete upgrade triggers** (`docs/operations/CLOUDFLARE_UPGRADE_TRIGGERS.md`) and a **CDN
  cache policy** (`docs/deployment/CDN_CACHE_POLICY.md`, policy only — header implementation
  deferred) turning the above into warning/action thresholds.
- **A capstone capacity and cost report** (`docs/release/CLOUDFLARE_CAPACITY_AND_COST_REPORT.md`)
  synthesizing all of the above into a recommended launch configuration.

### Documentation corrections made along the way

- `docs/architecture/ARCHITECTURE.md` still described authentication, billing, monitoring, the
  scanner, and Super Admin as "architected for but not implemented" — stale since Part 1; all are
  now real, built features.
- `docs/deployment/ENVIRONMENTS.md` still described the environment indicator banner as pending
  ("once implemented") — it has been live since Part 3 Step 26.
- `docs/data/DATA_MODEL.md`'s migration table stopped at migration 8 of the now-16 that exist.

### Discovered, not fixed (out of scope for this docs-only pass — see `docs/status/KNOWN_RISKS.md`)

An unbatched D1 write fan-out and uncapped findings count in the scan-persistence path; a missing
`ON DELETE CASCADE` on `scan_diffs.previous_scan_id`/`current_scan_id` (same bug class as three
previously-fixed migrations); `product_events`/`security_events`/`notifications` having no purge
job; RSL parsing's missing pre-parse size bound; a sitemap sparse-`<loc>` full-scan gap; and the
scanner's subrequest counter undercounting true consumption by excluding redirect hops.

## UI/UX Conversion Audit — Trust and Consistency Fixes (2026-07-26)

A full route-by-route UI/UX and conversion audit (`docs/design/UI_UX_CONVERSION_AUDIT.md`) found
the product already faithful to the SRS and honest, with a short list of concrete, verifiable
bugs rather than a generic look needing a rebrand. This entry covers those fixes only — no new
brand/logo system or homepage rebuild was in scope for this pass.

### Fixed

- **Policy Health Score category breakdown now reaches real reports.** `computePolicyHealthScore`
  (`packages/policy/src/scoring.ts`) always computed a per-category breakdown, but it was
  discarded before persistence (`persist-scan.ts`) and absent from the API contract
  (`policyHealthScoreSchema`) — every real report (anonymous, saved-domain, shared-link) showed a
  bare score number, while only the landing page's synthetic demo showed the category detail.
  Added `scans.score_breakdown` (migration `0016_scan_score_breakdown.sql`), threaded it through
  the contract, `persist-scan.ts`, and `get-scan-report.ts`, and wired it into
  `AuditReportView`'s `ScoreComponent`. Also extracted the score→label mapping
  (`scoreLabelFor`) into `packages/policy` as the single source of truth, removing a duplicate
  private copy in `get-scan-report.ts`.
- **Domain detail page's score had no label.** `apps/web/src/pages/app/domains/[domainId].astro`
  passed a hardcoded empty label; now uses the shared `scoreLabelFor` helper.
- **Pricing page (`/pricing`) CTAs brought to parity with the homepage's own pricing teaser.**
  Added the same per-plan card pattern (per-plan CTA, "Recommended" badge on Pro) that already
  existed on the homepage — previously `/pricing` only had one generic "Create an account" link.
- **Missing analytics events (SRS §9.20).** Added `crawler_reference_page_opened` (fired from
  crawler-reference pages) and a `source` property on `audit_started`/`audit_completed`/
  `audit_failed` (forwarding each `AuditForm`'s `idPrefix`) so "Hero audit started" and "Final CTA
  audit started" can be distinguished from the same event stream, as the SRS requires.
- **Super Admin shell had no mobile/tablet navigation.** The desktop sidebar is `hidden lg:flex`
  with no replacement below 1024px. Added `AdminMobileNav.tsx` (same Drawer/IconButton pattern as
  the public site's `MobileNav`) wired into `AdminNav.astro`'s header.
- **A real WCAG 2.2 AA color-contrast violation**, found by the a11y coverage extension below:
  the admin sidebar's section headings used `text-neutral-500` (3.63:1) against the dark
  `neutral-950` background. Fixed to `text-neutral-300` (already used elsewhere in the same file
  against the same background).
- **Automated a11y/visual-regression coverage was public-site-only.** Added authenticated-route
  coverage: `/app` and `/admin` to `tests/a11y/home.spec.ts` (Chromium-only, real WebAuthn
  ceremony); `/app` (empty state) and `/admin/settings` to `tests/visual/core-pages.spec.ts` (14
  new baseline snapshots across all 7 breakpoints).

### Discovered, not fixed (out of scope for this pass — see `docs/status/KNOWN_RISKS.md`)

- The existing 91-snapshot visual-regression baseline is now confirmed stale against the current
  app: every one of the 13 pre-existing routes fails a fresh comparison, uniformly, by the exact
  height of the `PUBLIC_APP_ENV` environment banner added in Part 3 Step 26 — the baseline
  predates that banner and was never regenerated. Not regenerated in this pass since it's
  unrelated to any of the fixes above and out of this pass's scope.
- A pre-existing, unrelated a11y test failure on the `mobile-safari` Playwright project (the
  homepage's "skip link" keyboard-focus test) — a known Playwright/WebKit `Tab`-key limitation,
  confirmed unrelated to any file touched in this pass.

## Part 3 — Super Admin, Agency, SEO Launch, and Production Hardening (2026-07-24)

Super Admin Control Center (all 20 SRS §28 subsections), agency features, the full SRS §30.4 SEO
content minimum, accessibility/visual/performance hardening, operational runbooks, a real
privacy/retention bug fix, a real SRS traceability + security + production-readiness audit with
a genuine new e2e test suite, and production configuration preparation. See
`docs/status/IMPLEMENTATION_STATUS.md` for the detailed, maintained record — this entry is a
summary, not the source of truth.

### Added

- **Super Admin Control Center**: global dashboard (every §28.2 metric, date-range filters),
  user management (search/inspect/suspend/restore/revoke/delete with reason + audit log), full
  subscription/revenue/webhook administration (Paddle resync, temporary entitlements, webhook
  retry), global domain/scan operations (admin scans don't consume customer quota), scheduler
  health monitoring (missed/overlapping/stuck/long-execution/excessive-failure-rate detection),
  registry administration (crawler/operator CRUD, versioned release/publish/rollback/compare),
  findings analytics, security monitoring (suspend/block/revoke), content/notices, runtime
  configuration (validated safe ranges), maintenance mode, role model (6 roles defined, only
  `super_admin` assignable per the SRS's own stated MVP scope), and an audit log every sensitive
  action writes to automatically via one `requireAdminAction` chokepoint.
- **Agency features**: client groups, batch domain import with per-row error reporting, portfolio
  filters (group/monitoring/score/findings), client-safe share links with limited agency branding.
- **SEO content minimum (SRS §30.4), met and exceeded**: 20 crawler-reference pages (all
  source-verified against real operator documentation), 20 guides (10 decision/comparison + 5
  implementation + 5 troubleshooting), 5 free validator tools (`/tools/*`) that each genuinely
  lead with their own scoped section of a real scan rather than being relabelled duplicates,
  methodology/scoring/changelog pages, full technical SEO (canonical, Open Graph, structured
  data, sitemap, noindex rules) verified by a sitemap-driven Playwright test.
- **Accessibility, visual, and performance hardening**: skip-link/breadcrumb/focus-management
  fixes, a 91-snapshot visual-regression baseline (13 routes × 7 breakpoints), SQL-pushed admin
  list filtering with hard limit ceilings, 5 new database indexes.
- **Operational runbooks**: backup/recovery, incident response, system health, and the main
  runbook, all rewritten with real, verified admin routes and procedures.
- **A real, previously-undiscovered privacy/retention bug, found and fixed**: deleting a user
  account with any historical billing, scan, or admin-action row threw and aborted the entire
  daily data-retention cron job (14 actor-reference foreign key columns across `billing_customers`,
  `product_events`, `crawlers`, `registry_versions`, `ruleset_versions`, `admin_role_assignments`,
  `temporary_entitlements`, `scans`, `system_notices`, `security_events`, `admin_audit_logs`,
  `blocked_targets`, `runtime_configuration`, `internal_user_notes` all defaulted to `NO ACTION`
  instead of `SET NULL`). Fixed via migrations 0013–0015.
- **A real e2e test suite** (`auth-and-account.spec.ts`, `admin-flows.spec.ts`) using a real
  Chromium DevTools Protocol WebAuthn virtual authenticator — not a fabricated response — driving
  real passkey registration/sign-in, save-domain-and-scan, account deletion, report printing, and
  four Super Admin journeys end-to-end.
- **Three final audit reports**, each a real evidence-based pass, not a restatement of plans:
  `docs/status/FINAL_SRS_COMPLIANCE_REPORT.md`, `docs/status/FINAL_SECURITY_AUDIT.md`,
  `docs/status/FINAL_PRODUCTION_READINESS_REPORT.md`.
- **Production configuration fixes**: `env.preview` in `wrangler.jsonc` now has its own D1
  database binding and `PUBLIC_SITE_URL`/`WEBAUTHN_RP_ID`/`WEBAUTHN_RP_ORIGIN` (previously
  silently inherited production's or were missing entirely — the latter would have broken
  passkey auth outright on first production deploy); an SRS §10.43 environment indicator banner.
- Super Admin accounts now require keeping at least 2 registered passkeys (SRS §28.20) —
  `removeCredential` refuses to drop below that for an active admin account.

### Fixed

Issues found by actually running things, not by inspection:

- `PRAGMA foreign_keys=OFF` is silently a no-op inside a D1 migration file (D1 wraps it in one
  implicit transaction; SQLite ignores `foreign_keys` pragma changes mid-transaction) — the
  retention-fix migrations above originally shipped with it, passed against a fresh `sqlite3`
  CLI test, then failed against real D1. Fixed with `PRAGMA defer_foreign_keys=ON` instead.
- `db:validate`'s static parser false-positived on the SQLite table-rebuild pattern's intermediate
  `_new` tables.
- A real SSR crash in the customer dashboard's Overview page for any brand-new, zero-domain
  account (`EmptyState`'s `action` prop received Astro template syntax instead of a real React
  element; the dev server silently returned `200` with an empty body instead of a 500) — found by
  the new e2e suite, since it was the first thing in the project's history to render that page
  for a genuinely empty account through a real browser.
- Two stale claims in `docs/security/SECURITY_CHECKLIST.md` (administrative audit logs marked
  "schema only" when fully built; production/preview separation marked done when it wasn't).
- Registry publication workflow's traceability row incorrectly still said "Part 3" after Part 3
  built it.

### Known gaps (see `docs/status/KNOWN_RISKS.md`)

Paddle field-shapes still unverified against a live sandbox account (the single most important
remaining item before production launch); visual-regression baseline still not wired into CI
(platform-suffix mismatch); e2e coverage against SRS §35.3's full journey list is real but not
exhaustive (scheduled scan, Paddle purchase/portal, agency report have no dedicated e2e test yet);
`env.preview`'s domain-specific values are structurally correct but still placeholders pending a
real preview domain; no cross-request target-frequency abuse monitoring. **This repository still
has zero git commits.**

## Part 2 — Customer-Facing SaaS (2026-07-23)

Complete customer-facing product: live scanner, robots.txt engine, crawler registry, policy
evaluation, findings/scoring, recommendations, full report pipeline, passkey authentication,
saved domains, customer dashboard, scheduled monitoring, notifications, Paddle billing, and
first-party analytics. See `docs/status/IMPLEMENTATION_STATUS.md` for the detailed, maintained
record — this entry is a summary, not the source of truth.

### Added

- `packages/scanner`: safe-fetch chokepoint with full timeout/redirect/size/request-count
  enforcement; `packages/robots`: RFC 9309 parser + evaluator; `packages/registry`: versioned
  crawler registry (13 crawlers, 8 operators); `packages/policy`: presets, additional-signal
  parsers (llms.txt, RSL, Content Signals, HTML/HTTP, sitemap), conflict detection, findings,
  Policy Health Score, deterministic recommendations.
- `POST /api/audit` now runs a real, bounded scan end-to-end when `AUDIT_ENGINE_ENABLED=true` —
  still returns the honest `AUDIT_ENGINE_DISABLED` error, never a fabricated result, when `false`.
- Passkey-only (WebAuthn) authentication: registration, login, credential management, DB-backed
  revocable sessions, hashed one-time recovery codes, step-up auth for sensitive actions.
- Saved domains, domain groups, ownership-scoped everywhere; customer dashboard (`/app/*`).
- Scheduled monitoring sweep with drift detection and failure backoff/pause; notification centre
  with a private, revocable Atom feed.
- Paddle Billing v2 integration: checkout, customer portal, signature-verified/idempotent webhook
  processing with out-of-order protection — not verified against a live sandbox account.
- First-party, cookie-free analytics and shared-report tokens.
- Security/privacy hardening: CSP + full security headers on every SSR response, CSRF defence
  (SameSite + Origin/Referer check), anonymous-audit rate limiting, target blocklist enforcement,
  CSV formula-injection prevention, daily data-retention purge job, IP hashing.
- 252 unit/integration tests (28 files) against a real Miniflare-backed D1 database; 8 e2e tests,
  16 accessibility tests, and a new 42-snapshot visual-regression baseline (6 pages × 7
  breakpoints) — all run and passing this Part.
- 51 real public domains audited respectfully (sequential, 3s gap, no parallelism) as a real-world
  correctness check — see `docs/status/PART2_REAL_DOMAIN_TEST_RESULTS.md`.

### Fixed

Issues found by actually running the quality gate and the real-domain test, not by inspection:

- **Total-scan timeout (FR-FET-007) was missing** — only a per-resource timeout existed, so a
  slow target's 5 sequential resource fetches could compound to ~5× the per-resource timeout
  (confirmed: `npr.org` took 104s). Added an enforced, configurable total-scan budget (default
  30s); the same domain now completes in 30.5s.
- `persist-scan.ts` primary-key collision when a robots.txt fetch was fully refused.
- CSRF rollout required fixing ~15 existing integration tests' missing `Origin` headers.
- One e2e test bug (missing hydration wait on the mobile nav test, same class of race already
  documented for the audit form).

### Known gaps (see `docs/status/KNOWN_RISKS.md`)

Paddle field-shapes unverified against a live sandbox account; visual-regression baseline not
wired into CI (platform-suffix mismatch between local macOS generation and Linux CI); no
cross-request target-frequency abuse monitoring; billing records have no retention/purge job;
Super Admin and agency-feature polish are Part 3 scope. **This repository has zero git commits —
all Part 1 and Part 2 work exists only in the working tree.**

## Part 1 — Engineering Foundation (2026-07-22)

Initial repository build-out. See `docs/status/IMPLEMENTATION_STATUS.md` for the detailed,
maintained record — this entry is a summary, not the source of truth.

### Added

- pnpm workspace monorepo: `apps/web` (Astro on Cloudflare Workers) + `packages/{core,scanner,
registry,database,ui,config}`.
- Architecture Decision Records ADR-0001 through ADR-0005.
- Full documentation tree under `docs/` (architecture, design, api, data, security, testing,
  operations, deployment, seo, registry, status, release).
- D1 schema: 8 migrations, 38 tables, matching Drizzle schema mirror, `db:validate` drift check.
- Local dev seed: subscription plans, a non-production Super Admin fixture, an 8-operator /
  13-crawler development crawler registry.
- Design system: tokens (`packages/ui/src/tokens/tokens.css`) and 36 accessible components
  (Radix UI + Tailwind CSS v4).
- Public website: landing page (all 15 required sections), crawler directory, guides, free
  tools index + 5 validator pages, pricing, methodology, scoring, scanner info, changelog,
  status, security, privacy, terms, acceptable-use, limitations, sign-in placeholder.
- `POST /api/audit`: validates and normalises input, returns `AUDIT_ENGINE_DISABLED` honestly —
  never a fabricated result.
- Typed API contracts for audit, auth, domains, groups, notifications, billing, sharing, admin.
- CI workflow: format, lint, typecheck, unit + integration tests, migration validation,
  dependency audit, secret scanning, build, e2e + accessibility smoke tests.
- Agent governance: `CLAUDE.md`, `AGENTS.md`, nested `AGENTS.md` for `packages/scanner`,
  `packages/database`, `apps/web/src/pages/api`; `.claude/settings.json`; three repo-local
  skills (`quality-gate`, `security-review`, `release-audit`).

### Fixed

Issues found by actually running the quality gate (format, lint, typecheck, unit/integration
tests, D1 migrations + seed against a local database, e2e, and axe-core accessibility scans),
not by inspection — see `docs/status/KNOWN_RISKS.md` for full detail:

- `Astro.locals.runtime.env` access, removed in Astro v6+/`@astrojs/cloudflare` 14.x; moved to
  `import { env } from "cloudflare:workers"` via a dedicated `apps/web/src/lib/env.ts`.
- Legacy `src/content/config.ts` location and collection API; migrated to `src/content.config.ts`
  with the `glob()` loader.
- Two design tokens (`--color-warning`, `--color-neutral-500`) failing WCAG AA 4.5:1 contrast.
- Inline prose links relying on hover-only underline, failing axe's `link-in-text-block` check.
- A horizontally-scrollable table not reachable by keyboard (WCAG 2.1.1).

### Known gaps (see `docs/status/KNOWN_RISKS.md`)

Scanner, authentication, monitoring, billing, and Super Admin are not implemented. SEO content
minimum (SRS §30.4) is not yet reached. No visual-regression baseline exists yet. Content
Security Policy is not yet configured.
