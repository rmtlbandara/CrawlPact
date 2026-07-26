# Cloudflare Architecture Audit (Phase 1)

Point-in-time audit of CrawlPact's actual Cloudflare footprint, as built, against the documented
architecture (ADR-0001–0005, `docs/deployment/*`, `docs/performance/PERFORMANCE_AND_COST.md`).
This document **gathers evidence only** — it does not decide whether to introduce R2 or any other
service. All findings below are traced to real file:line citations, not assumed from generic
Cloudflare patterns. Audited on branch `chore/cloudflare-capacity-alignment`, 2026-07-26.

## Headline answer

**Yes — all scan evidence (robots.txt, llms.txt, llms-full.txt, sitemap metadata, RSL, HTML
policy snippets, Content Signals, and selected HTTP headers) is stored directly in D1**, as plain
`TEXT` in `scan_resources.snapshot_text` (`packages/database/migrations/0005_domains_scans.sql:83`).
There is no object storage anywhere in this codebase today. Per-resource storage is capped at
100,000 bytes by `apps/web/src/lib/persist-scan.ts:90` (`fetchResult.body.slice(0, 100_000)`) —
notably tighter than the scanner's own 2 MiB fetch cap (`packages/scanner/src/safe-fetch.ts:52`),
so what's fetched and what's persisted are two different limits. A single scan writes up to 8
`scan_resources` rows (6 attempted-resource types plus `content_signals` and `http_headers`,
conditionally — `persist-scan.ts:63-71,127-146`), so the worst-case per-scan D1 footprint from
resource snapshots alone is roughly 8 × 100 KB ≈ 800 KB, though real robots.txt/llms.txt files are
typically far smaller than the cap. There is no content-hashing/deduplication in the write path
today: `scan_resources.resource_hash` exists as a column
(`packages/database/src/schema/domains-scans.ts:114`) but nothing populates it in
`persist-scan.ts` — every scan (including a monitoring re-scan of an unchanged site) writes fresh
full-text rows rather than a hash pointer to unchanged content.

## R2 usage today: **No**

Verified by:

- Repo-wide search for `R2Bucket`, `r2_buckets`, `.R2.` across all `.ts`/`.tsx`/`.jsonc`/`.json`
  files — zero matches outside this new document.
- `apps/web/wrangler.jsonc` (full file, lines 1–81) declares exactly two binding types: `d1_databases`
  and `assets` (Workers Static Assets, `ASSETS` binding). No `r2_buckets` block exists.
- `apps/web/src/env.d.ts:12-25`'s `CloudflareRuntimeEnv` type — the exhaustive list of everything
  the Worker can access via `getEnv()` — has no R2 binding.
- `docs/operations/BACKUP_AND_RECOVERY.md:20-24`: "Nothing outside D1 needs backing up in this
  architecture: there is no separate file store for scan snapshots... This is a deliberate
  simplicity benefit of the single-D1-database architecture."

## Prod/preview D1: **Actually separate, but both still placeholder IDs**

`apps/web/wrangler.jsonc:11-21` (top-level, production) and `:55-62` (`env.preview.d1_databases`)
declare two distinct `d1_databases` blocks with different `database_name` values
(`crawlpact-db` vs `crawlpact-db-preview`). Both currently carry the same placeholder
`database_id` (`00000000-0000-0000-0000-000000000000`) because no real Cloudflare account is
connected yet (`docs/deployment/CLOUDFLARE_CONFIGURATION.md:71`, `IMPLEMENTATION_STATUS.md:259`) —
this is a pre-launch setup step, not an architectural flaw. Historically this _was_ a real bug:
`docs/deployment/CLOUDFLARE_CONFIGURATION.md:13-14` and `KNOWN_RISKS.md`/`IMPLEMENTATION_STATUS.md:210-212`
record that `env.preview` previously had no `d1_databases` block at all and silently inherited
production's — fixed at "Part 3 Step 26," now structurally correct.

## Worst-case cron batch size for monitoring today: **20 domains per tick (admin-tunable, 1–200)**

`apps/web/src/lib/monitoring.ts:22` (`MAX_DOMAINS_PER_SWEEP = 20`), used as the fallback in
`monitoring.ts:259` (`getIntConfig(db, "monitoring_scan_batch_size", MAX_DOMAINS_PER_SWEEP)`).
The live value is admin-tunable via `runtime_configuration` and seeded at
`packages/database/seed/seed.sql:198` with bounds `min=1, max=200` — so an administrator could
raise the effective worst case to 200 domains/tick without a code change. Claiming is bounded and
self-healing (`claimDueDomains`, `monitoring.ts:38-73`): each due domain is claimed via a
conditional `UPDATE` that pushes `next_scan_at` into a 15-minute lock window
(`CLAIM_LOCK_MINUTES = 15`, tunable via `monitoring_claim_lock_minutes`), so a crashed sweep
self-heals rather than double-scanning. There is no cursor/continuation mechanism across sweeps —
each cron tick independently re-queries "due" domains capped at the batch size; domains beyond the
batch size simply wait for the next tick (or accumulate if the due backlog exceeds daily capacity,
which is a capacity question for later phases, not evaluated in this document).

---

## Area-by-area audit

### Worker entry point

- **Current implementation**: `apps/web/src/worker.ts` is a custom Worker entry (per ADR-0001)
  exporting `fetch: handle` (delegates to Astro's Cloudflare adapter handler,
  `worker.ts:22`) and `scheduled()` (`worker.ts:24-49`), which dispatches to the monitoring sweep
  and data-retention purge and writes one `scheduled_job_runs` row per job per tick.
- **Current Cloudflare service**: Single Cloudflare Worker, custom `main` entry
  (`apps/web/wrangler.jsonc:4`).
- **Appropriate?** Yes — matches ADR-0001's explicit rationale (one deployable, no cross-origin
  session complexity, D1 reachable from both `fetch` and `scheduled` via the same `env`).
- **Capacity risk**: Low structurally, but see "Audit execution" below — all traffic (marketing,
  API, cron) shares one Worker's CPU/wall-clock budget per ADR-0001's "Known Limitations"
  (`ADR-0001-APPLICATION-ARCHITECTURE.md:139-142`).
- **Security risk**: None beyond what's covered under ADR-0005 (scanner isolation) — the entry
  point itself does not touch customer-supplied targets directly.
- **Cost risk**: See "Audit execution" — CPU-bound scan work is the primary cost driver, not the
  entry point shape itself.
- **Required change**: None.
- **Optional improvement**: None identified.
- **Evidence**: `apps/web/src/worker.ts:1-49`; `apps/web/wrangler.jsonc:4`.

### Astro/Cloudflare adapter

- **Current implementation**: `@astrojs/cloudflare` with `output: "server"`, `imageService:
"compile"`, `platformProxy: { enabled: true }` (`apps/web/astro.config.mjs:9-14`, or equivalent
  config file — confirmed via `astro.config.*`).
- **Current Cloudflare service**: Workers (SSR mode), not Pages.
- **Appropriate?** Yes — matches ADR-0001's decision and the SRS's Astro recommendation for a
  content-heavy, SEO-first public site combined with an SSR app/admin shell.
- **Capacity/Security/Cost risk**: None specific to the adapter choice itself.
- **Required change**: None.
- **Optional improvement**: None identified.
- **Evidence**: `apps/web/astro.config.mjs` (root of `apps/web`).

### Workers Static Assets configuration

- **Current implementation**: `assets: { directory: "./dist", binding: "ASSETS" }`
  (`apps/web/wrangler.jsonc:7-10`). Astro's build output is served directly by Workers Static
  Assets; unmatched routes fall through to SSR.
- **Current Cloudflare service**: Workers Static Assets (no separate Pages/CDN project).
- **Appropriate?** Yes for current scale — matches ADR-0001's "Static Asset Strategy" section.
- **Capacity risk**: None known — Cloudflare's own CDN serves these.
- **Security risk**: None specific.
- **Cost risk**: Low — static asset serving is free-tier friendly.
- **Required change**: None.
- **Optional improvement**: `docs/performance/PERFORMANCE_AND_COST.md:50-56` notes there is no
  `Cache-Control` layer for anonymous/SSR content beyond Cloudflare's auto-generated `_headers` for
  hashed static assets (`/_astro/*: immutable, max-age=31536000`) — a real, disclosed, deferred gap
  for cacheable dynamic content (e.g. crawler/guide pages), not evaluated further here since it's
  out of this audit's R2-focused scope.
- **Evidence**: `apps/web/wrangler.jsonc:6-10`; `docs/performance/PERFORMANCE_AND_COST.md:50-56`.

### Worker-first routing behaviour

- **Current implementation**: Static assets served directly by the `ASSETS` binding; everything
  else falls through to Astro's SSR handler (`ARCHITECTURE.md:30-32`). No separate router
  framework — Astro's file-based router under `src/pages/**` (including `src/pages/api/**`) is the
  only router (ADR-0001).
- **Appropriate?** Yes.
- **Required change**: None.
- **Evidence**: `docs/architecture/ARCHITECTURE.md:28-38`.

### D1 bindings

- **Current implementation**: Single binding name `DB`, production block at
  `apps/web/wrangler.jsonc:11-21`, distinct preview block at `:55-62`. `packages/database/src/client.ts:9`'s
  `createDb(d1: D1Database)` wraps the binding in a Drizzle instance; `apps/web/src/lib/env.ts`'s
  `getEnv()` is the sole place `cloudflare:workers`' `env` is imported, typed by
  `apps/web/src/env.d.ts:12-25`.
- **Current Cloudflare service**: D1 (SQLite at the edge).
- **Appropriate?** Yes per ADR-0002's rationale (single source of truth, typed query builder,
  hand-authored migrations).
- **Capacity risk**: D1 free-tier max database size is 500 MB (`docs/performance/PERFORMANCE_AND_COST.md:76`,
  verified live against Cloudflare's docs 2026-07-24) — directly relevant given `scan_resources`
  stores full-text snapshots (see headline finding above). Paid tier raises this to 10 GB.
- **Security risk**: None beyond standard D1 access controls; ownership scoping is enforced in
  application queries (`docs/security/THREAT_MODEL.md:48-50`).
- **Cost risk**: `docs/performance/PERFORMANCE_AND_COST.md:80-90` states plainly that CrawlPact's
  real workload (several sequential fetches + parsing + multiple D1 writes per scan) "almost
  certainly requires the Workers Paid plan, not the free tier" — a documented expectation, not yet
  measured against a real deployed Worker.
- **Required change**: None identified by this audit (a database-ID placeholder fix is a deploy
  precondition, not an architecture change).
- **Optional improvement**: None from this audit's scope.
- **Evidence**: `apps/web/wrangler.jsonc:11-21`; `packages/database/src/client.ts:9`;
  `apps/web/src/lib/env.ts:1-11`; `apps/web/src/env.d.ts:12-25`.

### Preview bindings

- **Current implementation**: `env.preview.d1_databases` (`apps/web/wrangler.jsonc:55-62`) is a
  genuinely separate block from production, fixed at "Part 3 Step 26" after being found missing
  entirely (`docs/deployment/CLOUDFLARE_CONFIGURATION.md:13-14`).
- **Appropriate?** Yes, now that the block exists structurally.
- **Capacity/Security risk**: Both database IDs are still the same literal placeholder value
  (`00000000-0000-0000-0000-000000000000`) — harmless today (no real Cloudflare account connected)
  but this is a hard precondition to fix correctly (with two _different_ real IDs) before any real
  deploy, called out explicitly in the config file's own comments
  (`apps/web/wrangler.jsonc:52-54,58-59`).
- **Required change**: None architectural — operational setup step only, already documented in
  `docs/deployment/CLOUDFLARE_CONFIGURATION.md:10-24`.
- **Evidence**: `apps/web/wrangler.jsonc:44-80`.

### Cron Triggers

- **Current implementation**: `triggers.crons: ["0 3 * * *"]` (`apps/web/wrangler.jsonc:22-28`) —
  one daily cron drives both the monitoring sweep and the data-retention purge via the same
  `scheduled()` export, rather than two separate triggers.
- **Current Cloudflare service**: Cloudflare Cron Triggers.
- **Appropriate?** Yes — `docs/performance/PERFORMANCE_AND_COST.md:34-36` notes this choice
  keeps the account comfortably under the free-tier 5-Cron-Trigger limit regardless of how many
  future maintenance jobs get added.
- **Capacity risk**: Low at today's scale (batch size 20, admin-tunable to 200 — see headline
  answer above).
- **Required change**: None.
- **Evidence**: `apps/web/wrangler.jsonc:22-28`; `apps/web/src/worker.ts:24-49`;
  `docs/performance/PERFORMANCE_AND_COST.md:34-36`.

### Environment variables

- **Current implementation**: Non-secret `vars` declared per environment in `wrangler.jsonc`
  (production top-level `:29-43`, preview `:63-78`); validated at boot via `packages/config`'s
  `parseEnv` (`docs/deployment/ENVIRONMENTS.md:21-22`).
- **Appropriate?** Yes.
- **Security risk**: `WEBAUTHN_RP_ID`/`WEBAUTHN_RP_ORIGIN` preview values are still placeholders
  (`preview.crawlpact.com`) — passkey ceremonies will fail on a real preview domain until updated
  (`docs/deployment/CLOUDFLARE_CONFIGURATION.md:41-45`, `KNOWN_RISKS.md:38`). Not an architectural
  gap, a pre-launch config task.
- **Required change**: None from this audit.
- **Evidence**: `apps/web/wrangler.jsonc:29-43,63-78`.

### Secrets

- **Current implementation**: `SESSION_SIGNING_SECRET`, `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`
  set via `wrangler secret put`, never committed to `wrangler.jsonc`
  (`docs/deployment/CLOUDFLARE_CONFIGURATION.md:47-55`).
- **Appropriate?** Yes — standard Cloudflare Workers secret handling, correctly separated from
  `vars`.
- **Required change**: None.
- **Evidence**: `docs/deployment/CLOUDFLARE_CONFIGURATION.md:47-55`.

### Database migrations

- **Current implementation**: 16 forward-only, hand-authored SQL migrations in
  `packages/database/migrations/` (`0001_plans.sql` through `0016_scan_score_breakdown.sql`),
  applied via `wrangler d1 migrations apply` (ADR-0002), mirrored in
  `packages/database/src/schema/*.ts` and checked for drift by `pnpm db:validate`.
- **Appropriate?** Yes, matches ADR-0002 exactly. `docs/data/MIGRATION_POLICY.md` and the
  `DATA_RETENTION.md` "Migration-authoring note" record a real, empirically-found D1-specific
  gotcha (`PRAGMA foreign_keys=OFF` no-ops mid-transaction; use `defer_foreign_keys=ON` instead) —
  a sign this process has actually been exercised against real D1, not just designed on paper.
- **Required change**: None.
- **Evidence**: `packages/database/migrations/` (16 files, listed above); `docs/data/MIGRATION_POLICY.md`.

### Static asset delivery

- Covered under "Workers Static Assets configuration" above — no separate finding.

### Dynamic route delivery

- **Current implementation**: 124 files under `apps/web/src/pages/**` set
  `export const prerender = false` (SSR, counted via repo grep) vs. 23 files with `prerender =
true` (build-time static, mostly marketing/content pages, e.g. `apps/web/src/pages/index.astro:2`).
  All dynamic routes (app, admin, API) render server-side per request against D1.
- **Appropriate?** Yes — matches ADR-0001's "prerendered where possible, SSR for authenticated
  areas" model.
- **Required change**: None.
- **Evidence**: `apps/web/src/pages/index.astro:2` (prerendered sample); `apps/web/src/pages/app/index.astro:2`
  and `apps/web/src/pages/admin/index.astro:2` (SSR samples).

### Public page rendering

- **Current implementation**: Marketing/content pages prerendered at build time
  (`prerender = true`), served as static assets thereafter.
- **Appropriate?** Yes — SEO-first, zero D1 cost per request for these pages.
- **Required change**: None.
- **Evidence**: `apps/web/src/pages/index.astro:2` and the other 22 `prerender = true` files.

### Customer app rendering

- **Current implementation**: `apps/web/src/pages/app/**` is SSR (`prerender = false`), reads/writes
  D1 per request via same-origin `/api/**` endpoints, session-gated by
  `apps/web/src/lib/auth/require-session.ts`.
- **Appropriate?** Yes, matches ADR-0001/0004.
- **Cost risk**: Every authenticated request costs one D1 session lookup
  (ADR-0004's documented, accepted tradeoff, `ADR-0004-AUTHENTICATION-STRATEGY.md:61-63`).
- **Required change**: None.
- **Evidence**: `apps/web/src/pages/app/index.astro:2`.

### Super Admin rendering

- **Current implementation**: `apps/web/src/pages/admin/**` is SSR (`prerender = false`), gated by
  a distinct `admin_role_assignments` check and stricter session rules (ADR-0004), with dedicated
  pages for jobs, health, scans, webhooks, security, subscriptions, registry/rulesets, and shared
  reports.
- **Appropriate?** Yes.
- **Required change**: None — the pagination gap noted below is a UI-completeness issue, not a
  Cloudflare-architecture one.
- **Evidence**: `apps/web/src/pages/admin/index.astro:2`; `docs/operations/RUNBOOK.md` (admin
  routes referenced throughout).

### Audit execution

- **Current implementation**: `POST /api/audit` runs the scan **synchronously within the request**
  — no background job queue exists (`apps/web/src/pages/api/audit/index.ts:20-23`'s own doc
  comment: "The scan runs synchronously within this request (no background job queue exists...)").
  Gated behind `AUDIT_ENGINE_ENABLED` (currently `"false"` in both environments,
  `wrangler.jsonc:33,77`) — when disabled, the route honestly returns a disabled-state response
  rather than fabricating a result (CLAUDE.md's non-negotiable rule; `IMPLEMENTATION_STATUS.md`).
- **Current Cloudflare service**: Worker request/response cycle (no Queues, no Durable Objects).
- **Appropriate?** Reasonable for current scan bounds (≤12 external requests per scan,
  `packages/scanner/src/orchestrator.ts:35`), but this is the single biggest **capacity/cost**
  concern in the whole audit.
- **Capacity risk**: **High, and explicitly disclosed already.**
  `docs/performance/PERFORMANCE_AND_COST.md:80-90` states CrawlPact's real workload "almost
  certainly requires the Workers Paid plan, not the free tier" — free tier's 10ms CPU-time-per-request
  budget is very tight for a scan that does several sequential fetches, parses each response,
  evaluates every registry crawler, and writes multiple D1 rows. This is a documented expectation,
  not yet measured against a real deployed Worker (`docs/status/KNOWN_RISKS.md:24`).
- **Security risk**: Covered exhaustively by ADR-0005/SSRF_SECURITY_MODEL — no new risk from the
  execution model itself.
- **Cost risk**: Same as capacity risk above — CPU time is the primary cost driver on Workers
  Paid, and a synchronous, in-request scan means every anonymous audit and every manual re-scan
  incurs this cost directly, with no queue/backpressure mechanism to smooth bursts.
- **Required change**: None mandated by this audit (Phase 1 is evidence-gathering only) — but the
  synchronous-execution-under-free-tier-CPU-budget risk should be treated as load-bearing input to
  any later capacity-planning ADR.
- **Optional improvement**: None proposed here (out of scope for Phase 1).
- **Evidence**: `apps/web/src/pages/api/audit/index.ts:14-24`; `packages/scanner/src/orchestrator.ts:35`;
  `docs/performance/PERFORMANCE_AND_COST.md:80-90`; `docs/status/KNOWN_RISKS.md:24`.

### Scheduled scan execution

- **Current implementation**: `runMonitoringSweep` (`apps/web/src/lib/monitoring.ts:246-303`),
  invoked from `worker.ts`'s `scheduled()`. Claims up to `monitoring_scan_batch_size` domains
  (default 20, admin-tunable 1–200) via a self-healing conditional-`UPDATE` claim lock
  (15-minute default window), running each claimed domain's scan sequentially within the same
  `scheduled()` invocation.
- **Appropriate?** Bounded and reasonable at current scale; see the headline "worst-case batch
  size" answer above for full detail.
- **Capacity risk**: Batch size is bounded but **not currently cross-checked against Cloudflare's
  Workers CPU/wall-clock budget for a single `scheduled()` invocation** — 20 (or up to 200,
  admin-configured) sequential scans, each doing several fetches and D1 writes, all inside one
  cron invocation, is a real capacity question this audit surfaces but does not resolve (no
  scheduled-invocation duration has been measured against a real deployed Worker, per the same
  disclosed gap in `PERFORMANCE_AND_COST.md`).
- **Security risk**: None beyond the shared ADR-0005 scanner containment (applies identically to
  scheduled scans — `blocked_targets` enforcement confirmed in `monitoring.ts:257`,
  `getBlockedTargetPatterns`).
- **Required change**: None mandated by this audit.
- **Evidence**: `apps/web/src/lib/monitoring.ts:22,38-73,246-303`;
  `packages/database/seed/seed.sql:198`.

### Data-retention execution

- **Current implementation**: `runDataRetentionPurge` (`apps/web/src/lib/data-retention.ts:150-158`),
  invoked unconditionally (not gated by `AUDIT_ENGINE_ENABLED`) from the **same** cron/`scheduled()`
  call as monitoring, but as an independent job with its own `scheduled_job_runs` row
  (`worker.ts:26,60-88`). Performs four bounded operations: purge anonymous scans past retention,
  purge expired owned-domain scans (grouped by plan — always exactly 4 rows, not looped per
  domain, per the Part 3 Step 19 fix documented in `PERFORMANCE_AND_COST.md:13`), hard-delete
  accounts past the deletion grace period (cascading via `ON DELETE CASCADE`), and revert expired
  temporary entitlements.
- **R2 cleanup involved?** None — confirmed by reading the full file
  (`apps/web/src/lib/data-retention.ts:1-158`): every operation is a D1 `DELETE`/`UPDATE`, nothing
  touches any object-storage API, consistent with there being no R2 usage anywhere in this
  codebase.
- **Appropriate?** Yes — matches the documented policy in `docs/data/DATA_RETENTION.md` closely;
  the one open item (`transactions`/`webhook_events` have no purge job, by design — "legally and
  operationally required" retention needs a real decision, `DATA_RETENTION.md:109-112`) is already
  disclosed, not a silent gap.
- **Required change**: None from this audit.
- **Evidence**: `apps/web/src/lib/data-retention.ts:1-158`; `apps/web/src/worker.ts:24-27,60-88`.

### File uploads

- **Current implementation**: **None exist today.** Agency branding (`shared_reports.agency_branding`,
  `AgencyBranding` type) is **URL-only** — `apps/web/src/components/app/ShareReportDialog.tsx:171-175`'s
  form field is literally labelled "Logo URL" with the description "Must be a public http(s) image
  URL," and `apps/web/src/lib/sharing.ts:44-46` stores whatever branding object is passed
  (including that URL string) as JSON text in D1 — there is no upload endpoint, no multipart form
  handling, and no binary storage anywhere in `apps/web/src` or `packages/database`.
- **Current Cloudflare service**: None (no upload path exists).
- **Appropriate?** Yes for current scope — a URL-only branding model has no storage-capacity
  implication at all.
- **Required change**: None.
- **Evidence**: `apps/web/src/components/app/ShareReportDialog.tsx:171-175`;
  `apps/web/src/lib/sharing.ts:1-13,29-51`; `apps/web/src/components/AuditReportView.tsx:324-327`
  (renders `agencyBranding.logoUrl` as a plain `<img src>`, i.e. the browser fetches the customer's
  externally-hosted image directly — CrawlPact never stores or proxies the image bytes).

### Generated exports

- **Current implementation**: CSV export (`apps/web/src/pages/api/domains/export.csv.ts:1-53`)
  builds the CSV entirely in-memory from a `listDomains` query and returns it directly as the
  response body with a `Content-Disposition: attachment` header — **not persisted anywhere**, plan
  entitlement-gated (`plan.csvExportEnabled`).
- **Current Cloudflare service**: None beyond the Worker's own response streaming.
- **Appropriate?** Yes — no storage need for a request-scoped, regenerate-on-demand export.
- **Required change**: None.
- **Evidence**: `apps/web/src/pages/api/domains/export.csv.ts:1-53`.

### Report assets

- **Current implementation**: Reports are rendered live from D1 data
  (`apps/web/src/lib/report-view-data.ts`'s `loadReportViewData`, used by both the authenticated
  report view and the public shared-token view) — there is no separately generated/stored report
  artifact (e.g. no PDF, no static HTML snapshot) at all today.
- **Required change**: None from this audit.
- **Evidence**: `apps/web/src/pages/shared/[token].astro:1-16` (calls `loadReportViewData` fresh,
  per request).

### Evidence storage

- **This is the audit's central finding** — see "Headline answer" at the top of this document.
  Scan evidence (`scan_resources.snapshot_text`) lives directly in D1, `TEXT` column, capped at
  100,000 bytes per resource by application code, up to 8 rows per scan, no deduplication/hashing
  applied despite a `resource_hash` column existing unused in the schema.
- **Current Cloudflare service**: D1 only.
- **Appropriate?** Reasonable at current, pre-launch scale (zero real scans exist yet — no
  production Cloudflare account connected). Becomes the central input to a future capacity
  decision as real scan volume accumulates, given D1's 500 MB free-tier / 10 GB paid-tier size
  ceiling — **this document deliberately does not decide whether/when that ceiling becomes a
  problem or whether R2 should be introduced; it only establishes the current facts** for that
  future decision.
- **Capacity risk**: Directly proportional to scan volume × retention window (see
  `docs/data/DATA_RETENTION.md`'s retention table — Agency plan history alone is 36 months) ×
  ~800 KB worst-case per scan (likely far less in practice, since most robots.txt/llms.txt files
  are well under the 100 KB per-resource cap).
- **Security risk**: Already well-covered — target-controlled content is stored as plain
  text/opaque bytes, never interpreted as executable, escaped on render
  (ADR-0005's "Consequences," `docs/security/THREAT_MODEL.md:40-43`).
- **Cost risk**: D1 storage cost/limits scale with this data; not measured against a real deployed
  database yet (no production account connected).
- **Required change**: None mandated by Phase 1 (evidence-gathering only, per this task's scope).
- **Optional improvement**: Populating `resource_hash` and skipping a full-text rewrite when a
  monitoring re-scan's content is byte-identical to the prior scan's would reduce write volume for
  monitored (as opposed to one-off) domains — noted here as a future option, not a Phase 1 action.
- **Evidence**: `packages/database/migrations/0005_domains_scans.sql:67-87`;
  `packages/database/src/schema/domains-scans.ts:114`; `apps/web/src/lib/persist-scan.ts:63-146`;
  `packages/scanner/src/safe-fetch.ts:52`; `docs/data/DATA_RETENTION.md:27-30`.

### Existing backup strategy

- **Current implementation**: No production D1 database exists yet — "nothing to back up in a
  live environment" (`docs/operations/BACKUP_AND_RECOVERY.md:5-6`). The documented target policy
  is Cloudflare D1's own point-in-time recovery (`wrangler d1 time-travel`), with a recovery drill
  explicitly deferred to before production launch (`BACKUP_AND_RECOVERY.md:26-32`) — the document
  is honest that no drill has been run yet rather than fabricating results.
- **Current Cloudflare service**: D1 time-travel (platform-native, no custom backup tooling).
- **Appropriate?** Yes, and explicitly the stated benefit of the single-D1 architecture — "no
  separate file store for scan snapshots... no external database" means nothing outside D1 needs
  its own backup story (`BACKUP_AND_RECOVERY.md:19-24`). If evidence storage ever moves to R2,
  this document's backup story would need a corresponding update (a matter for the later
  migration-decision document, not this one).
- **Required change**: None from this audit — a recovery drill remains an open pre-launch task,
  already tracked in the source document itself.
- **Evidence**: `docs/operations/BACKUP_AND_RECOVERY.md:1-38`.

---

## Summary table

| Area                     | Cloudflare service today                     | Appropriate?                                     | Notable risk                                             |
| ------------------------ | -------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------- |
| Worker entry point       | Workers (custom entry)                       | Yes                                              | Shared CPU/deploy unit (accepted, per ADR-0001)          |
| Astro adapter            | `@astrojs/cloudflare`, SSR                   | Yes                                              | None                                                     |
| Static assets            | Workers Static Assets                        | Yes                                              | No cache layer for dynamic-but-cacheable content         |
| D1 bindings              | D1 (`DB`)                                    | Yes                                              | 500 MB free-tier ceiling relevant to evidence growth     |
| Preview bindings         | D1 (separate block)                          | Yes (structurally)                               | Both IDs still placeholders (pre-launch task)            |
| Cron Triggers            | 1 daily cron, 2 jobs                         | Yes                                              | Batch-size × per-scan CPU unmeasured against real Worker |
| Env vars / secrets       | `vars` + `wrangler secret put`               | Yes                                              | Preview WebAuthn values still placeholders               |
| Migrations               | D1 SQL migrations (16 files)                 | Yes                                              | None                                                     |
| Audit execution          | Synchronous, in-Worker                       | Workable, high CPU cost                          | Free-tier CPU budget "very tight" per own docs           |
| Scheduled scan execution | Cron + D1 claim-lock                         | Yes                                              | Batch × per-scan cost unmeasured                         |
| Data-retention execution | Same cron, D1-only deletes                   | Yes                                              | None — no R2 involved, confirmed                         |
| File uploads             | None (URL-only branding)                     | Yes                                              | None                                                     |
| Generated exports        | In-memory, not persisted                     | Yes                                              | None                                                     |
| Report assets            | Rendered live from D1                        | Yes                                              | None                                                     |
| **Evidence storage**     | **D1 only (`scan_resources.snapshot_text`)** | **Central open question for future R2 decision** | **D1 size ceiling vs. scan volume × retention**          |
| Backup strategy          | D1 time-travel (undrilled)                   | Yes, as designed                                 | Recovery drill still outstanding (pre-launch)            |

## What this document deliberately does not do

Per the task brief, this is Phase 1 evidence-gathering only. It does not recommend introducing R2,
does not size a migration, and does not change any application code — it exists so a later
capacity/R2-migration decision has accurate, cited facts about current D1 usage (per-scan resource
count and size, retention windows, batch sizes, and confirmation that no object storage exists
anywhere today) to reason from.
