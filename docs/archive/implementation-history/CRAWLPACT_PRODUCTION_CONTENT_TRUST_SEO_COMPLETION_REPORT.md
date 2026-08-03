# CrawlPact Production Content, Trust, SEO and SaaS Authority Upgrade — Completion Report

> **Historical document.** This file records an earlier CrawlPact implementation state and is
> not authoritative for the current product. See `docs/status/CURRENT_STATE.md` for current
> status.
>
> - **Original date**: 2026-07-31
> - **Archive date**: 2026-08-03 (governance Phase 1)
> - **Superseded by**: `docs/status/CURRENT_STATE.md`
> - **Reason archived**: executive synthesis of the content/trust/SEO audit above, same age and
>   reason. Preserved in full below as an accurate historical record; not edited for currentness.

**Date:** 2026-07-31
**Full working log:** `docs/reports/CRAWLPACT_PRODUCTION_CONTENT_TRUST_SEO_AUDIT.md` (25 sections —
this report is an executive synthesis; that document has the line-by-line detail, evidence, and
verification method for every claim below).

## Executive summary

This workstream audited CrawlPact's production marketing site, free tools, legal pages, status
page, Super Admin area, crawler directory, and guide library against CLAUDE.md's non-negotiable
rules (no fabricated data, no silently-skipped requirements, no unauthorized production actions),
then fixed everything findable and safe to fix without inventing legal or business facts that
don't yet exist in the repository. Two items were intentionally left open and are called out
explicitly below, not buried: the legal-entity/jurisdiction/contact information gap, and a
pre-existing flaky billing-webhook test. Both are documented with enough detail that resolving
them later doesn't require re-discovering the problem.

- **Starting point:** `main` at commit `fd8eae5` (already includes the Google Analytics rollout,
  PR #56, and the robots.txt cleanup, PR #58 — both merged and verified earlier in this session).
- **This report covers:** all uncommitted work on `feat/google-analytics-marketing-pages` at the
  time of writing — 78 changed/added files, `1341` insertions across the 57 modified files alone
  (untracked new files add more on top of that).
- **Net result:** every P0/P1/P2 finding from the original audit is fixed, removed, or explicitly
  and honestly deferred. Nothing was marked resolved without independent verification (live curl,
  rebuilt HTML inspection, or a passing test) — see `KNOWN_RISKS.md` for the standing rule this
  followed.

## Files and routes changed, by area

### Content — crawler directory (16 pages standardized, 2 new)

`apps/web/src/content/crawlers/{amazonbot,applebot-extended,ccbot,google-cloudvertexbot,
google-extended,googlebot,googleother,meta-externalads,meta-externalagent,meta-externalfetcher,
meta-webindexer,oai-searchbot,perplexitybot}.md` — replaced generic "Standard robots.txt disallow
rules apply" boilerplate with crawler-specific content on what blocking that token actually
affects and which sibling tokens from the same operator are unaffected. Two new pages,
`amzn-searchbot.md` and `amzn-user.md`, model Amazon's other crawler tokens the same way OpenAI/
Anthropic/Perplexity/Meta's multi-token operators already are. `gptbot.md` and
`google-extended.md` were reviewed and already met the bar under a different heading — left as-is.

`apps/web/src/pages/crawlers/[slug].astro` and `crawlers/index.astro` — added a per-crawler
example `robots.txt` block generated from the real token, a wildcard-fallback explanation, a link
to the AI crawler checker tool, a source-verification note, and (on the index) a computed —
never hard-coded — page/operator count and latest verification date.

### Content — guides (10 files touched)

`apps/web/src/content/guides/{how-to-set-the-content-signal-header,
how-to-publish-an-llms-txt-file,how-to-publish-an-rsl-declaration}.md` — added concrete,
source-verified platform-specific steps (Netlify `_headers`, Vercel `vercel.json`, Cloudflare
Pages/Workers `_headers`, WordPress) replacing "consult your platform's documentation."
`relatedCrawlerSlugs` added to `content.config.ts`'s guide schema and set on the 7 guides genuinely
about specific crawlers, replacing keyword-matched "related guides" with a real relationship.
Tool links added to 5 guides that named a tool's use case without linking it;
`google-extended-vs-googlebot.md` now links both crawler pages it discusses.
`apps/web/src/pages/guides/[slug].astro` / `index.astro` updated to use the new schema field.

### Legal / trust pages

`apps/web/src/pages/{privacy,terms,acceptable-use}.astro` — removed the "Draft — not yet reviewed
by a lawyer" banner; added visible effective/last-updated dates; wired those dates to
`apps/web/src/lib/trust-config.ts` instead of a hand-typed literal string (new this round).
`methodology.astro` — added a last-substantive-update date on the same config, plus (earlier
round) a signal-support matrix stating what each signal (`robots.txt`, meta robots, `llms.txt`,
RSL, Content Signals) can and can't prove and how mature its underlying specification actually is.
`about.astro` — one paragraph distinguishing CrawlPact from a WAF, crawler blocker, log-analytics
tool, or general SEO crawler.

### Status page and incident tracking (new system)

`packages/database/migrations/0018_incidents.sql` + `packages/database/src/schema/incidents.ts` —
two new, purely additive tables (`incidents`, `incident_updates`); actor references nullable with
`ON DELETE SET NULL`, matching the convention set by migrations 0013–0015. Design doc:
`docs/architecture/INCIDENT_TRACKING_SYSTEM_DESIGN.md`.
`apps/web/src/lib/status/{components,public-status}.ts` — canonical 7-component list and the
public-status adapter (incidents can only escalate a component's displayed status, never mask a
worse internal signal — see the design doc's escalation-only rule).
`apps/web/src/lib/admin/incidents.ts` + `apps/web/src/pages/api/admin/incidents/**` — admin
create/update, using the existing `requireAdminAction`/`requireAdminSession` chokepoint (session +
role + recent-auth + reason + rate-limit + audit-log-write in one call), mirroring the
`system_notices` feature's pattern exactly.
`apps/web/src/components/admin/IncidentsManager.tsx` + `apps/web/src/pages/admin/incidents/
index.astro` — Super Admin UI, added to `AdminNav.astro`'s Security group.
`apps/web/src/pages/status.astro` — rewritten to show overall status, per-component status,
active incidents with full update timelines, scheduled maintenance, recently-resolved incidents,
and an honest "no uptime measurement exists yet" statement instead of a fabricated percentage.
Also removed "Super Admin Control Center" from the public capability list (internal-only, was
leaking to unauthenticated visitors).

### Super Admin copy cleanup

Removed three leaked internal `SRS FR-xxx` / `§xx` citations from user-facing strings: the
homepage FAQ (and its `FAQPage` JSON-LD), a public guide, and the passkey-removal API error
(`apps/web/src/pages/api/auth/passkeys/[credentialId]/remove.ts`).

### Free tools

`apps/web/src/pages/tools/{index,ai-crawler-checker,content-signals-checker,llms-txt-validator,
robots-txt-ai-validator,rsl-validator}.astro` — added substantive "What this checks" / "What this
doesn't check" / "Related" content to all 5 tool pages (previously a form and one line), plus a
"tool vs. full audit" explainer and per-tool signal labels on the index.

### Homepage

`apps/web/src/pages/index.astro` — fixed a leaked SRS citation in the FAQ; **the "Policy Evidence
Map" SVG artwork section was added earlier in this workstream and then fully removed** at the
product owner's explicit instruction ("remove only the new section with the art work on the home
page. It is not appropriate."). `apps/web/src/components/PolicyEvidenceMap.astro` no longer exists
in this repository; nothing else referenced it.

### R2

Not used. The original brief's OG-image work used Playwright (an existing dev dependency) to
rasterize SVG sources to PNG at build time via `scripts/generate-og-images.mjs`, avoiding both a
fabricated external asset pipeline and an unnecessary new storage dependency. Output committed
under `apps/web/public/og/`.

### SEO / structured data

Fixed a canonical/redirect mismatch on every crawler and guide detail page (canonical pointed at a
non-trailing-slash URL that itself 307-redirected). Fixed a dead citation URL on the
`Google-Extended` registry entry. Added `WebApplication` structured data to `/pricing` (built from
the same `plans` array the visible table renders — no separate, driftable data source) and `HowTo`
structured data to the 4 guides with genuine `Step N:` headings. `docs/seo/STRUCTURED_DATA.md`
updated to match.

### Accessibility

Fixed a real `scrollable-region-focusable` WCAG violation on the new methodology table
(`tabindex`/`role`/`aria-label`, matching the existing pattern on `pricing.astro`). Fixed 12
instances of a real, sitewide Astro whitespace-collapsing bug (`<code>`/`<a>` abutting the
preceding word with no rendered space) across 7 files, including one pre-existing instance on the
homepage hero. `pnpm test:a11y:chromium` — 82/82 passing against a live dev server as of this
report, including the four pages whose date-rendering changed in the final round.

### Editorial governance

`docs/seo/EDITORIAL_SOURCE_AND_CONTENT_POLICY.md` (new) — organizational (not fabricated
individual) authorship, explicit AI-assistance disclosure, an acceptable-sources hierarchy
(operator's own docs > spec text > platform docs; never SEO blogs/aggregators), and a rule that
"last verified" dates only change on genuine re-verification.

### Trust-metadata config (new, this round)

`apps/web/src/lib/trust-config.ts` — single typed source for values previously hand-duplicated
across pages (billing/infrastructure/analytics provider names, policy effective dates, registry/
ruleset version labels, data-retention summary). Legal-identity fields are explicitly `null`, not
a placeholder string; nothing in the codebase reads them yet (confirmed by `grep`), so there is no
path for an invented value to reach a page. Four pages (`privacy`, `terms`, `acceptable-use`,
`methodology`) now compute their displayed dates from this config; rendered output verified
byte-identical to the previous hand-typed strings.

### Database migrations

One new migration this workstream: `0018_incidents.sql` (additive only — two new tables, no
altered or dropped columns). Applied to the **local** D1 database only, to exercise the feature
during development. `pnpm db:validate` confirms 40 tables consistent between migrations and the
Drizzle schema (up from 38 before this change).

### Cloudflare changes

One zone-configuration change, made by the product owner directly in the Cloudflare dashboard
(outside this session's API token permissions and outside version control): disabling the Managed
robots.txt / AI-bot-blocking feature that was injecting a `Disallow` block for GPTBot, ClaudeBot,
Google-Extended, CCBot, Applebot-Extended, Amazonbot, Bytespider, and `meta-externalagent` into
production's live `robots.txt`. Independently verified via direct `curl` — see §24 of the audit
log. No Worker, KV, D1 binding, or Pages configuration was changed by this session.

## Tests executed and results

`pnpm quality` (format, lint, typecheck, unit, integration, db:validate, build): **all green**
except one test — `billing-webhook.integration.test.ts`'s concurrent-race test — which failed once
under full-suite load. This is the pre-existing, already root-caused flake documented in
`docs/status/BILLING_WEBHOOK_RACE_TEST_FLAKE.md`: the test's own `Promise.all` doesn't guarantee
which request's database write lands first, so the webhook handler's correct out-of-order
protection can (correctly) classify the "later" write as `ignored_out_of_order` when the test
assumes a fixed order. Confirmed unrelated to this session (`git log` shows zero diff to that test
file or the handler it exercises) and confirmed flaky, not deterministic, by re-running it in
isolation 4 times — passed all 4. Per explicit instruction, the handler and its ordering
protection were not touched; the fix belongs in its own dedicated, billing-critical change.

`pnpm test:a11y:chromium`: 82/82 passing.

`apps/web/src/lib/robots-txt.test.ts` (5 assertions, merged separately in PR #58): passing on
`main`.

## Production / preview verification

- Live production `robots.txt` (`curl https://crawlpact.com/robots.txt`): confirmed clean of
  AI-crawler-specific blocking directives (Cloudflare-side fix, verified independently — §24).
  Still shows the old `Disallow: /audit/*` wildcard form as of this writing, because the
  source-controlled fix (PR #58, merged to `main` as `fd8eae5`) has not yet been deployed to
  production — deploying is this report's next step, not something silently skipped.
- Full local `pnpm build` succeeds; rebuilt HTML directly inspected (not just assumed) to confirm
  the homepage artwork removal left no trace and the four trust-config-driven date strings render
  correctly.
- No preview-environment deployment was performed as part of this round; the change set goes
  through the same PR → CI → merge → explicit production-dispatch path as PR #58 did.

## Remaining limitations and missing legal/business facts

**Legal entity name, registered business address, governing jurisdiction, applicable
consumer-protection regime, and verified privacy/security/support contacts do not exist anywhere
in this repository.** Full list of exactly what's missing and what each item blocks:
`docs/release/LEGAL_INFORMATION_CHECKLIST.md`. Per the product owner's explicit 2026-07-31
instruction, this release proceeds without them — the gap is honestly disclosed and scoped, not
silently dropped or filled with an invented value. It blocks only: a jurisdiction-specific
governing-law/dispute-resolution clause in `/terms`, naming a specific data-controller entity in
`/privacy`, publishing `/.well-known/security.txt` (would require a real contact), and a public
content-correction submission channel. Everything else — the actual technical data practices
described in `/privacy`, the service-mechanics description in `/terms`, the acceptable-use rules —
is already accurate and unblocked.

**`billing-webhook.integration.test.ts`'s concurrent-race test is flaky** (see above). Root cause
and recommended remediation are fully documented; fixing it requires making the test's event
ordering deterministic (or asserting behavior independently of `Promise.all` call order) as its
own reviewed, billing-critical change — not bundled into this release.

## Manual actions required

1. **Deploy this release to production** — see next section for the exact procedure. Includes
   applying `0018_incidents.sql` to the live D1 database.
2. **Legal information**: when the product owner has the entity name, address, jurisdiction, and
   verified contacts, update `docs/release/LEGAL_INFORMATION_CHECKLIST.md` directly, then implement
   the specific blocked items listed there.
3. **Billing webhook test fix**: schedule as its own dedicated change with billing-specific review.
4. **Cloudflare Bot Management API scope**: if future automated verification of the AI-bot-block
   setting is wanted, the connected API token needs the Bot Management read/write permission scope
   added — not required for anything in this release.

## Rollback procedure

This release is additive at the database layer (one new migration, two new tables, no altered or
dropped columns) and does not change any authentication, billing, or scanner logic. If a rollback
is needed after deployment:

1. Re-run `deploy-production.yml` against the previous known-good commit SHA (`fd8eae5` or later,
   whichever was last verified healthy) — the workflow re-deploys the Worker from that SHA.
2. The `0018_incidents.sql` migration does not need to be reverted for a code rollback: the new
   tables being present but unused by older code is harmless (no foreign key from any pre-existing
   table points into `incidents`/`incident_updates`).
3. If the incidents feature itself needs to be disabled without a full rollback, remove the
   "Incidents" entry from `AdminNav.astro` and the feature becomes unreachable from the UI while
   the schema stays in place.

## Recommended next content priorities

1. Resolve the legal-information checklist — it is the single largest remaining trust gap and
   blocks real, user-visible functionality (`security.txt`, a corrections channel).
2. Fix the billing-webhook test flake as its own reviewed change, since a flaky billing test
   erodes confidence in an otherwise-green CI signal over time.
3. Consider adding real uptime measurement to back the status page's component-health signals,
   now that the status page correctly discloses it doesn't have one yet instead of fabricating a
   percentage.
