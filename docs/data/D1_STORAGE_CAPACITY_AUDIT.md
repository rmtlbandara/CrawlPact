# D1 Storage Capacity Audit (Phase 5)

Point-in-time capacity model for CrawlPact's production D1 database, built on the verified
Cloudflare limits in `docs/deployment/CLOUDFLARE_RESOURCE_LIMITS.md` (Phase 0) and the schema
evidence in `docs/deployment/CLOUDFLARE_ARCHITECTURE_AUDIT.md` (Phase 1). Audited on branch
`chore/cloudflare-capacity-alignment`, 2026-07-26. **This is an estimation exercise, not a
measurement** — no production Cloudflare account is connected yet and no real scans exist
(`CLOUDFLARE_ARCHITECTURE_AUDIT.md`'s "Existing backup strategy" finding). Every number below is
derived from actual schema/code (cited by file:line) combined with explicitly stated assumptions
about usage volume — never presented as a measured fact.

**Binding constraint used throughout:** 500 MB max size of a single D1 database
(`CLOUDFLARE_RESOURCE_LIMITS.md` §14), not the 5 GB account-wide total (§13) — production and
preview are separate databases, each individually capped at 500 MB. All "% of cap" figures below
are against 500 MB.

## Headline answer

At the SRS's own commercial target (150+ paid customers, ~1,000+ saved domains, end of 2027 —
`docs/product/CRAWLPACT_FINAL_SRS.md` §3.3), the production database is estimated to reach
**roughly 45–70% of the 500 MB cap within its first year of sustained operation, and to approach
or somewhat exceed the cap somewhere around year 2–3** — not because more domains get added, but
because the _same_ ~1,000 domains keep accumulating faithfully retained scan history (weekly for
Pro/Agency, monthly for Solo) across Pro's 24-month and, especially, Agency's 36-month retention
windows (`docs/data/DATA_RETENTION.md`). This is a materially different, more sensitive finding
than the ~800 KB-per-scan worst case in `CLOUDFLARE_ARCHITECTURE_AUDIT.md` suggested at first
glance — that figure is a per-_scan_ ceiling; the constraint that actually matters is per-scan
average size **times** scan volume **times** multi-year retention. See "Expected production size"
below for the full range and its main sensitivity (the size of the homepage HTML snapshot).

**Dominant table: `scan_resources`.** Its `snapshot_text` column is the single largest
contributor to per-scan bytes — and, notably, the largest single driver within it is not
`robots_txt`/`llms_txt` (small, still low-adoption text files) but `resource_type = 'html_meta'`,
which stores the **full truncated homepage HTML body**, not just extracted meta tags
(`apps/web/src/lib/persist-scan.ts:99` reuses the same `fetchResult.body.slice(0, 100_000)` used
for every other resource type). This is a genuinely useful refinement of Phase 1's finding, which
focused on policy-file text.

**Free/anonymous traffic is not the risk.** Counterintuitively, a "free-plan-anonymous-heavy"
growth scenario produces a _smaller_ steady-state database than the paid-customer target
scenario, because anonymous scans purge after 7 days and Free-plan domains have no scheduled
monitoring at all (`monitoring_frequency = 'none'`, `packages/database/seed/seed.sql:29`). The
capacity risk is concentrated entirely in **Pro and Agency's long retention windows combined with
weekly monitoring**, not in top-of-funnel volume.

---

## Method and headline caveat

Every number below is one of:

1. **A fact from schema/migrations/seed data** — cited directly, no estimation.
2. **An estimate with a stated assumption** — e.g. "assume average robots.txt is ~1.2 KB." These
   are best-effort, not measured, and flagged as such.
3. **A derived total** — assumption × fact, shown with its formula so the sensitivity is visible.

Where an assumption materially changes the conclusion (chiefly: average size of the `html_meta`
homepage-HTML snapshot, and average domains actively used per Pro/Agency customer), this document
shows the range rather than asserting one number as ground truth.

---

## Tables that grow with usage vs. fixed reference tables

Reviewed all 9 schema files (`packages/database/src/schema/*.ts`) and all 16 migrations
(`packages/database/migrations/0001`–`0016`). Fixed/reference tables (`plans`, `admin_roles`,
`crawler_operators`, `crawlers`, `registry_versions`, `registry_version_entries`,
`ruleset_versions`, `user_preferences`, `table_preferences`, `saved_filters`,
`runtime_configuration`, `system_notices`, `blocked_targets`) are small, slow-growing, or grow with
_registry curation activity_ (an editorial process, not customer usage) — excluded from the
capacity model below as immaterial (each is at most hundreds of rows, not thousands—millions).

The growing, usage-driven tables audited in detail: `scans`, `scan_resources`,
`scan_crawler_results`, `findings`, `scan_diffs`, `domains`, `product_events`, `admin_audit_logs`,
`security_events`, `notifications`, `webhook_events`, `transactions`, `shared_reports`.

---

## Per-table estimates

### `scans` (`packages/database/src/schema/domains-scans.ts:55-88`, migration `0005`)

- **Average row size: ~700 bytes.** Mostly fixed-width columns (ids, enums, timestamps, ints)
  plus two variable JSON `TEXT` columns: `score_breakdown` (category-score JSON object, assume
  ~250 bytes for ~5-6 category entries) and `recommended_additions` (JSON array of proposed
  registry additions, assume ~250 bytes for 2-4 items). `error_category` is usually NULL.
- **Max row size: ~2 KB** (larger `recommended_additions`/`score_breakdown` payloads for a scan
  with many proposed additions or a fuller category breakdown).
- **Rows created per scan: exactly 1** (`persist-scan.ts:33` — one `insert` per `persistScan`
  call, and the function's own doc comment confirms scans are insert-only, never updated
  in place).
- **Index overhead:** 4 indexes — `idx_scans_domain_id`, `idx_scans_status`,
  `idx_scans_canonical_origin` (migration `0005`), `idx_scans_started_at` (migration `0012`,
  explicitly called out there as "the single largest, fastest-growing table in the schema"). Most
  indexed columns are short (ids, enum strings, a date), so overhead is modest per row but this is
  the table with the most indexes of any growing table, which compounds with its high row count.

### `scan_resources` (`domains-scans.ts:90-119`, migration `0005:67-87`) — **dominant table**

- **Average row size: ~1.8 KB, blended across the 8 resource types.** Breakdown (assumption,
  reasoning):

  | Resource type     | Assumed avg | Reasoning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
  | ----------------- | ----------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | `robots_txt`      |     ~1.2 KB | Most real robots.txt files are well under a few KB.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
  | `llms_txt`        |     ~0.5 KB | Blended: still low real-world adoption (assume ~15% of scanned sites have one, ~2 KB when present; the other ~85% produce a small metadata-only row when the fetch 404s).                                                                                                                                                                                                                                                                                                                                                                        |
  | `llms_full_txt`   |     ~0.4 KB | Same reasoning, lower adoption still (~8% assumed).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
  | `sitemap`         |     ~1.5 KB | Many sitemaps are compact index files pointing at sub-sitemaps, not full URL lists.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
  | `html_meta`       |  **~10 KB** | **Stores the full truncated homepage HTML body**, not just meta tags — `persist-scan.ts:99`'s `snapshotText: fetchResult.body.slice(0, 100_000)` runs against `result.scanSignals.homepage`, the same raw-HTML fetch result used to derive `html.parsed` meta-tag signals elsewhere (`run-audit.ts:108`). Modern homepage HTML (SSR/hydration-heavy JS frameworks, marketing sites) commonly runs 5–40 KB; 10 KB is a defensible mid-estimate, **flagged as this document's single biggest sensitivity** (see "Expected production size" below). |
  | `rsl`             |     ~0.2 KB | Very new format, assumed rare (~3% adoption).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
  | `content_signals` |    ~0.25 KB | Short raw header-derived text (`persist-scan.ts:132`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
  | `http_headers`    |    ~0.15 KB | Small JSON of the `X-Robots-Tag` value (`persist-scan.ts:142`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

  Blended: (1200+500+400+1500+10000+200+250+150) / 8 ≈ **1,775 bytes/row**.

- **Max row size: 100,000 bytes** — the hard cap enforced by `persist-scan.ts:90,99`
  (`fetchResult.body.slice(0, 100_000)`), independent of the scanner's own 2 MiB fetch cap
  (`packages/scanner/src/safe-fetch.ts:52`). Confirmed already in `CLOUDFLARE_ARCHITECTURE_AUDIT.md`.
- **Rows created per scan: up to 8** — 6 attempted resource types (`robots_txt`, `llms_txt`,
  `llms_full_txt`, `sitemap`, `html_meta`, `rsl`, per `persist-scan.ts:64-70`) plus conditional
  `content_signals`/`http_headers` rows when the homepage fetch succeeds (`persist-scan.ts:124-145`).
  All 6 base types are attempted independently regardless of one another's outcome
  (`packages/scanner/src/orchestrator.ts` fetches each separately), so 8 is the _typical_ count
  for a scan that reaches the target at all, not just a worst case — consistent with the SRS's own
  98%+ scheduled-scan-success target. A scan whose target fails safety/reachability validation
  entirely attempts none (0 rows) — a small minority.
- **Worst case per scan: 8 × 100,000 = 800,000 bytes (~781 KB)**, matching
  `CLOUDFLARE_ARCHITECTURE_AUDIT.md`'s independently-derived ~800 KB figure — good cross-check on
  this document's methodology.
- **Index overhead:** 1 index, `idx_scan_resources_scan_id` (migration `0005:87`) — low overhead
  relative to row count.

### `scan_crawler_results` (`domains-scans.ts:121-144`, migration `0005:89-104`)

- **Average row size: ~220 bytes.** Small, uniform: ids (`${scanId}_${crawlerId}`, ~50-56 bytes),
  short enum `result`, an optional short `matched_rule` line, and `evaluation_explanation` is
  **always NULL in current code** (`persist-scan.ts:155`, hardcoded `null`) despite the column
  existing — so this column contributes 0 bytes today regardless of schema capacity.
- **Max row size: ~600 bytes** (a longer matched-rule line plus a populated `sourceResourceId`).
- **Rows created per scan: ~20**, one per crawler evaluated against the target's robots.txt.
  The registry currently seeds **21 crawlers** (`packages/database/seed/seed.sql:62-133`,
  counted directly: `crw_gptbot`, `crw_oai_searchbot`, `crw_chatgpt_user`, `crw_claudebot`,
  `crw_claude_user`, `crw_perplexitybot`, `crw_perplexity_user`, `crw_google_extended`,
  `crw_googlebot`, `crw_ccbot`, `crw_applebot_extended`, `crw_meta_external_agent`,
  `crw_amazonbot`, `crw_claude_searchbot`, `crw_bingbot`, `crw_meta_web_indexer`,
  `crw_meta_external_ads`, `crw_meta_external_fetcher`, `crw_oai_adsbot`,
  `crw_google_cloudvertexbot`, `crw_googleother`) — but a given scan evaluates against whichever
  registry version was _active_ at scan time, and the seed's own registry versions exclude a
  handful of crawlers each (`seed.sql:148-183`), so ~20 is a representative average, growing
  slowly as the registry itself grows (an editorial, not usage-driven, process).
- **Index overhead:** 1 index, `idx_scan_crawler_results_scan_id` — low.

### `findings` (`domains-scans.ts:146-168`, migration `0005:106-125`)

- **Average row size: ~800 bytes.** Several required free-text columns (`title`, `summary`,
  `business_impact`, `recommended_action` are all `NOT NULL`), plus an `evidence` JSON blob
  (`{evidenceSummary, fingerprint}`, `persist-scan.ts:169-172`, assume ~300-400 bytes).
- **Max row size: ~2.5 KB** (longer free-text fields, larger evidence payload).
- **Rows created per scan: assume ~2-3 average.** `packages/policy/src/findings.ts` defines 10
  distinct finding codes (`BROAD_WILDCARD_OVERRIDE`, `DEPRECATED_TOKEN_IN_USE`,
  `DUPLICATE_GROUP_UNEXPECTED_MATCH`, `HEADER_SITE_DISAGREEMENT`, `PAGE_DIRECTIVE_UNREACHABLE`,
  `REPLACEMENT_TOKEN_MISSING`, `RSL_CONTENT_SIGNALS_DISAGREEMENT`, `SEARCH_VISIBILITY_CONFLICT`,
  `TRAINING_RESTRICTION_CONFLICT`, `UNKNOWN_PURPOSE_REQUIRES_REVIEW`) — a well-configured site
  triggers 0, a poorly configured one triggers several; 2-3 is a reasonable blended assumption, not
  derived from real usage data (none exists yet). **Max ~8** in practice (several codes are
  logically near-mutually-exclusive, so all 10 firing simultaneously is unrealistic).
- **Index overhead:** 3 indexes — `idx_findings_scan_id`, `idx_findings_severity`,
  `idx_findings_finding_code` (migration `0005:123-125`) — moderate given the extra two indexes
  beyond the usual single `scan_id` FK index pattern.

### `scan_diffs` (`domains-scans.ts:170-187`, migration `0005:127-139`)

- **Average row size: ~600 bytes** (`summary`/`details` free text describing what changed between
  two scans).
- **Max row size: ~2 KB.**
- **Rows created per scan: 0-1** — only written when a domain's re-scan actually differs from its
  predecessor (website drift, registry drift, or preset change); not every monitoring scan
  produces one.
- **Index overhead:** 1 index, `idx_scan_diffs_domain_id`.
- **Caveat found in passing (out of scope to fix here, docs-only task):** `previous_scan_id` and
  `current_scan_id` (migration `0005:130-131`) reference `scans(id)` **without** an `ON DELETE`
  clause — unlike `domain_id`'s `ON DELETE CASCADE` on the same table. SQLite's default for an
  unqualified reference is `NO ACTION`, meaning if `purgeExpiredDomainScans`
  (`apps/web/src/lib/data-retention.ts:53-85`) ever deletes a `scans` row that a `scan_diffs` row
  still points to, that specific `DELETE` would throw `SQLITE_CONSTRAINT_FOREIGNKEY` rather than
  cascading — the same class of bug `DATA_RETENTION.md`'s "Part 3 Step 21" section already found
  and fixed for actor-reference columns elsewhere. If unfixed, this could cause older scans to
  silently fail to purge once a diff references them, which would make real storage growth exceed
  the model in this document. Flagging for `docs/status/KNOWN_RISKS.md` rather than fixing, per
  this task's docs-only scope.

### `domains` (`domains-scans.ts:17-53`, migration `0005:13-40`)

- **Average row size: ~650 bytes** (several `NOT NULL` text fields: `display_name`,
  `canonical_origin`, `original_input`, plus optional `notes`).
- **Max row size: ~1.2 KB.**
- **Not scan-driven** — one row per saved domain, essentially static relative to scan volume.
  Negligible contributor to total size at any realistic scale (at 1,000+ domains, ~650 KB total).
- **Index overhead:** 4 non-unique indexes (`owner_user_id`, `group_id`, `next_scan_at`,
  `monitoring_state`) plus 1 unique composite index (`owner_user_id`, `canonical_origin`) — the
  most-indexed growing table, but low row count keeps absolute overhead small.

### `product_events` (`admin-security.ts:94-101`, migration `0007:86-91`)

- **Average row size: ~300 bytes** (short `event_name`, optional `properties` JSON — deliberately
  shallow per `apps/web/src/lib/analytics.ts`'s own doc comment: "never full page HTML... never
  anything that would let this table double as an auth log").
- **Max row size: ~800 bytes.**
- **Volume assumption:** `analytics.ts:13-28` defines exactly **14 named funnel events**
  (`landing_viewed`, `audit_started`, `audit_completed`, `audit_failed`, `result_viewed`,
  `account_started`, `account_created`, `domain_saved`, `pricing_viewed`, `checkout_started`,
  `subscription_activated`, `report_shared`, `notification_opened`,
  `crawler_reference_page_opened`) — this is milestone/funnel analytics, not per-click or
  per-pageview tracking, which matters a lot for volume. Assume ~3 events per anonymous free audit
  (36,000/year at the SRS's 3,000/month target) plus ~15 events/year per active registered user
  (~1,650 at SRS target scale) ≈ 108,000 + 24,750 ≈ **~133,000 events/year** at target scale.
- **No purge job.** `apps/web/src/lib/data-retention.ts` purges anonymous scans, expired
  owned-domain scans, deleted accounts, and expired entitlements — it does **not** touch
  `product_events`. At the assumed rate this is a secondary contributor for the first several years
  (~120 MB after 3 years, ~400 MB after ~10 years at flat volume) — not a near-term risk like
  `scan_resources`, but genuinely unbounded and worth a future retention decision if event volume
  grows materially, since (unlike scans) nothing here plateaus.
- **Index overhead:** 2 indexes (`event_name`, `created_at`).

### `admin_audit_logs` (`admin-security.ts:5-19`, migration `0007:3-19`)

- **Average row size: ~450 bytes** (`previous_state`/`new_state` can carry small JSON snapshots of
  a changed entity; `reason` and `request_id` are always present).
- **Max row size: ~1.5 KB.**
- **Volume:** low — driven by admin actions (registry/ruleset publishes, blocked-target changes,
  manual corrections), realistically dozens to low hundreds per month platform-wide, not
  per-customer-scaling.
- **Kept indefinitely by design** (`DATA_RETENTION.md`: "at least 24 months," no purge job exists
  or is required — SRS §34 floor is trivially satisfied by never deleting). Low absolute volume
  keeps this immaterial even indefinitely retained.
- **Index overhead:** 3 indexes (`administrator_user_id`, `created_at`, `target` — the last added
  in migration `0012` specifically for admin dashboard filtering).

### `security_events` (`admin-security.ts:32-54`, migration `0007:31-54`)

- **Average row size: ~350 bytes** (`ip_hash` is a fixed 64-character HMAC-SHA256 hex string per
  `DATA_RETENTION.md`'s "IP addresses" section; `details` is a short optional JSON blob).
- **Max row size: ~900 bytes.**
- **Volume:** bounded by legitimate + malicious traffic patterns (rate-limit hits, auth failures,
  unsafe-scan attempts) — moderate but not customer-count-proportional in the same way scans are.
- **No purge job** (same gap as `product_events` — not in `data-retention.ts`'s scope). Low
  per-row size keeps this a minor contributor even growing indefinitely at realistic volumes.
- **Index overhead:** 3 indexes (`event_type`, `created_at`, `resolved_at` — the last added in
  migration `0012`).

### `notifications` (`notifications-sharing.ts:7-31`, migration `0006:3-17`)

- **Average row size: ~400 bytes** (`title` + `body` are short human-readable strings).
- **Max row size: ~700 bytes.**
- **Rows created per scan: ~0.1-0.3** — not every scan produces a notification, only ones with a
  meaningful change (critical/high-severity policy change, new crawler, registry drift, etc.).
- **Important retention nuance:** `notifications.domain_id` has `ON DELETE CASCADE` to `domains`
  (migration `0006:5`) but there is **no FK to `scans`** and **no time-based purge job** —
  notifications persist for a domain's entire lifetime regardless of the domain owner's plan
  retention window, unlike `scans`/`scan_resources`/`scan_crawler_results`/`findings` which are
  bounded by `history_retention_days`. At the low per-notification rate assumed above this stays a
  minor contributor, but it is structurally unbounded in the same way `product_events` is.
- **Index overhead:** 2 indexes (`user_id`, `read_at`).

### `webhook_events` (`billing.ts:54-72`, migration `0003:56-72`)

- **Average row size: ~1 KB** — dominated by `payload_redacted`, a redacted JSON copy of the
  Paddle webhook body (assume ~700-900 bytes after redaction).
- **Max row size: ~2.5 KB.**
- **Volume:** proportional to paid-customer billing lifecycle events (subscription
  created/updated/cancelled, transaction completed, occasional retries) — assume ~10-15
  webhook events per paid customer per year (signup, annual renewal, occasional plan change,
  payment retries). At 155 paid customers: ~1,700-2,300/year.
- **Kept indefinitely by design** — `DATA_RETENTION.md`: "as legally and operationally required,"
  explicitly never purged, and now provably survives account deletion
  (migration `0013_billing_customer_survives_account_deletion.sql`). At this volume/row-size,
  even 10 years of history is only ~15,000-23,000 rows (~15-23 MB) — immaterial next to
  `scan_resources`.
- **Index overhead:** 2 indexes (`status`, `received_at` — the latter added in migration `0012`).

### `transactions` (`billing.ts:37-52`, migration `0003:37-46`)

- **Average row size: ~300 bytes** (mostly ints/short enums: `currency`, `gross_amount_cents`,
  `status`).
- **Max row size: ~500 bytes.**
- **Volume:** plans are annually priced (`plans.annual_price_usd_cents`,
  `packages/database/src/schema/plans.ts:8`), so assume ~1 transaction per paid customer per year
  (renewal) plus occasional refund/chargeback status updates — at 155 paid customers, ~150-200
  rows/year. Trivial contributor even kept indefinitely.
- **Index overhead:** 2 indexes (`billing_customer_id`, `occurred_at` — the latter added in
  migration `0012`, called out there as high-priority for admin date-range queries).

### `shared_reports` (`notifications-sharing.ts:43-56`, migration `0006:27-40`)

- **Average row size: ~400 bytes** (`agency_branding` JSON is small — URL-only branding per
  `CLOUDFLARE_ARCHITECTURE_AUDIT.md`'s "File uploads" finding, just a logo URL string plus maybe
  color values, no binary data ever stored).
- **Max row size: ~700 bytes.**
- **Volume:** low — an Agency-tier feature (`agencyBrandingEnabled` only true for the Agency plan,
  `seed.sql:32`), occasional per-domain report shares.
- **Bounded by scan retention, not domain deletion:** `scan_id` has `ON DELETE CASCADE` to `scans`
  (migration `0006:30`) — so, unlike `notifications`, a `shared_reports` row is automatically
  removed whenever its underlying scan is purged by the retention job. This is the one
  non-scan-count table whose lifetime is correctly tied to the retention windows already modeled.
- **Index overhead:** 1 index (`owner_user_id`).

---

## Retention periods (per `docs/data/DATA_RETENTION.md` — cited, not re-derived)

| Data                     | Retention                                       | Bounds which tables                                                                               |
| ------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Anonymous scan cache     | 7 days (24h floor, admin-tunable)               | `scans` (domain_id NULL) → cascades to `scan_resources`, `scan_crawler_results`, `findings`       |
| Free plan scan history   | 30 days                                         | Same cascade, Free-owned domains                                                                  |
| Solo plan scan history   | 365 days (12 months)                            | Same cascade, Solo-owned domains                                                                  |
| Pro plan scan history    | 730 days (24 months)                            | Same cascade, Pro-owned domains                                                                   |
| Agency plan scan history | 1,095 days (36 months)                          | Same cascade, Agency-owned domains — **the longest window, and the main driver of eventual size** |
| Administrative logs      | ≥24 months (kept indefinitely, no purge needed) | `admin_audit_logs`                                                                                |
| Billing records          | Indefinite ("legally/operationally required")   | `transactions`, `webhook_events`                                                                  |
| Deleted account data     | Purged within 30 days (cascading hard-delete)   | Everything the account owns                                                                       |

**Not covered by any purge job** (confirmed by reading `apps/web/src/lib/data-retention.ts` in
full — it only performs the four operations listed in `DATA_RETENTION.md`'s table):
`product_events`, `security_events`, `notifications` (bounded only by domain deletion, not time),
`scan_diffs` (same, plus the FK caveat noted above). None of these are large individually at
today's assumed volumes, but they are the only genuinely _unbounded_ tables in the schema — worth
a future retention decision if usage scales well past the SRS's current targets.

---

## Expected production size (three scenarios)

All scenarios apply the per-row estimates above plus a flat **+20% index-overhead heuristic**
(SQLite/D1 index storage is roughly proportional to indexed-column size × row count; this is a
rough approximation, not a precise model, per the nature of the ask — the tables with the most
indexes, `scans` (4) and `domains` (5+1 unique), are where this heuristic is least precise).

### Scenario 1 — Low: 5 Solo customers (pilot scale)

Assume 5 Solo customers, ~2 domains each (of the 5-domain Solo limit) = 10 domains, monthly
monitoring. Solo's 365-day retention window exactly matches one year of monthly scans, so this
plateaus almost immediately: **10 domains × 12 scans/year = 120 steady-state scans**, ever.

At ~26 KB effective per scan (see "as-observed" cost below) plus negligible fixed-table overhead:
**~3 MB total — under 1% of the 500 MB cap, indefinitely, at this scale.** No capacity concern
exists at pilot scale under any reasonable assumption.

### Scenario 2 — Expected: 155 paid customers (SRS §3.3 target: "150+ active paid customers")

**Assumptions stated explicitly** (none of these are in the SRS/schema — they are this
document's own modeling choices):

- Plan mix: 80% Solo / 15% Pro / 5% Agency (typical early-stage skew toward the cheapest tier) →
  124 Solo, 23 Pro, 8 Agency.
- Domain utilization (not maxed against plan limits): Solo ~2 of 5 (40%), Pro ~4 of 25 (16%),
  Agency ~10 of 100 (10%) → 248 + 92 + 80 = **420 paid domains**.
- Free tier: ~600 domains (assume ~40% of the SRS's 1,500+ registered-account target save their
  1 allowed Free domain).
- Anonymous: 3,000 free audits/month (SRS target), 7-day retention → ~700 steady-state.
- **Total ≈ 1,020 domains — consistent with the SRS's own "1,000+ saved domains" target.**
- Manual re-scans (beyond scheduled monitoring) are not separately modeled — a conservative
  simplification that likely understates real volume slightly.

Per-scan effective cost (raw + 20% index overhead), **two sub-scenarios reflecting the `html_meta`
sensitivity** identified above:

|                                                     | `html_meta` avg | Per-scan raw | Per-scan effective (+20%) |
| --------------------------------------------------- | --------------: | -----------: | ------------------------: |
| **As-observed** (current code: full truncated HTML) |           10 KB |     ~21.7 KB |                  ~26.0 KB |
| **Lean** (hypothetical: meta-tags-only extraction)  |            3 KB |     ~14.7 KB |                  ~17.6 KB |

Steady-state scan counts (domains stay ~constant at ~1,020 once the target is reached; the
database keeps growing for up to 3 more years purely from continued monitoring until each plan's
retention window fully populates):

| Elapsed time            | Free (30d) |        Solo (1yr) |         Pro (2yr) |       Agency (3yr) | Anon (7d) | Total scans |
| ----------------------- | ---------: | ----------------: | ----------------: | -----------------: | --------: | ----------: |
| 1 year                  |       ~800 | 2,976 (plateaued) |   4,784 (not yet) |    4,160 (not yet) |      ~700 |  **13,420** |
| 2 years                 |       ~800 |             2,976 | 9,568 (plateaued) |    8,320 (not yet) |      ~700 |  **22,364** |
| 3 years (full maturity) |       ~800 |             2,976 |             9,568 | 12,480 (plateaued) |      ~700 |  **26,524** |

Total estimated database size (scan-derived tables only; other tables add low tens of MB at most
per the per-table sections above):

| Elapsed time | As-observed (10 KB html_meta) | Lean (3 KB html_meta) |
| ------------ | ----------------------------: | --------------------: |
| 1 year       |      ~333 MB (**67% of cap**) |         ~226 MB (45%) |
| 2 years      | ~582 MB (**116% — over cap**) |         ~376 MB (75%) |
| 3 years      | ~659 MB (**132% — over cap**) |         ~447 MB (89%) |

**Reading this honestly:** under the current code's actual behavior (full-HTML `html_meta`
snapshots), the expected scenario crosses the 500 MB single-database ceiling somewhere **between
year 1 and year 2** of sustained operation at the SRS's target scale — driven overwhelmingly by
Pro's 24-month and Agency's 36-month retention windows compounding `scan_resources`. Under a
leaner hypothetical (if `html_meta` captured only extracted meta-tag signals instead of full page
HTML — a possible future optimization, not implemented today and out of this docs-only task's
scope to build), the database stays under the cap through the full 3-year Agency retention window
maturing. **The single largest lever on this entire estimate is the size of the homepage HTML
captured under `resource_type = 'html_meta'`** — more than domain count, more than plan mix.

### Scenario 3 — High: free-plan/anonymous-heavy growth

Assume viral free-tier growth outpaces paid conversion: 5,000 registered free accounts (60% =
3,000 save their 1 allowed domain), minimal paid base (18 Solo + 2 Pro + 0 Agency = 36 + 8 = 44
paid domains), and 10,000 anonymous audits/month (3x the SRS target).

Steady-state at full maturity (3 years, as-observed 10 KB `html_meta`):

- Free: ~3,000 (baseline) + 3,000×4×0.082 ≈ **3,984**
- Solo: 36×12 = 432 (plateaued at 1yr)
- Pro: 8×52×2 = 832 (plateaued at 2yr)
- Anonymous: 10,000/month × 7/30 ≈ **2,333**
- **Total ≈ 7,581 scans** × ~26.0 KB effective ≈ **~197 MB (39% of cap)**

**This is smaller than the Expected scenario**, despite far higher top-of-funnel volume —
confirming the headline finding: free/anonymous growth is self-limiting (7-30 day retention, no
scheduled monitoring), while paid Pro/Agency growth with multi-year retention is what actually
consumes D1 capacity. A product strategy that over-indexes on free-tier growth without paid
conversion is, if anything, _safer_ for D1 capacity than successfully hitting the paid-customer
target — an interesting, non-obvious result worth carrying into future capacity planning.

---

## Disposition: D1, R2, or aggregation/deletion?

**Decision already made and out of scope to revisit here:** R2 is not being adopted at this time —
current volumes don't justify the added architectural complexity (a second storage system, a
second backup story per `docs/operations/BACKUP_AND_RECOVERY.md`, code changes to
`persist-scan.ts` and every report-rendering path). The column below is framed as "stays in D1,
revisit if X," not as an R2-migration recommendation.

| Table                  | Disposition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scans`                | Stays in D1. Revisit if per-scan JSON payloads (`score_breakdown`, `recommended_additions`) grow substantially beyond current shape.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `scan_resources`       | Stays in D1. **Primary future lever if the 500 MB cap is ever actually approached**: (a) populate the existing-but-unused `resource_hash` column and skip full-text rewrites when a monitoring re-scan's content is byte-identical to the prior scan's (already flagged as a future option in `CLOUDFLARE_ARCHITECTURE_AUDIT.md`); (b) reconsider whether `html_meta` needs the full homepage HTML or could store only the extracted meta-tag/Content-Signals fields already parsed out of it. Revisit if steady-state size approaches 300 MB (60% of cap) in a real deployed database. |
| `scan_crawler_results` | Stays in D1. Small, uniform rows; no action needed at any modeled scale.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `findings`             | Stays in D1. Small relative to `scan_resources`; no action needed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `scan_diffs`           | Stays in D1. Fix the missing `ON DELETE CASCADE` on `previous_scan_id`/`current_scan_id` if/when this area is revisited (see caveat above) — a correctness fix, not a capacity one.                                                                                                                                                                                                                                                                                                                                                                                                     |
| `domains`              | Stays in D1. Static, negligible size regardless of scan volume.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `product_events`       | Stays in D1. No purge job exists — revisit with a real retention decision if event volume grows well beyond the ~130,000/year assumed here, since (unlike scans) this table does not self-bound.                                                                                                                                                                                                                                                                                                                                                                                        |
| `admin_audit_logs`     | Stays in D1 indefinitely, by design (SRS §34 floor). Low volume keeps this immaterial.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `security_events`      | Stays in D1. No purge job exists, but low per-row size and volume keep it immaterial; revisit only if abuse/attack volume spikes sustained.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `notifications`        | Stays in D1. Bounded by domain deletion, not time — revisit if per-domain notification rate or domain lifetime grows well beyond assumptions here.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `webhook_events`       | Stays in D1 indefinitely, by design (billing/legal requirement). Immaterial size at any modeled paid-customer count.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `transactions`         | Stays in D1 indefinitely, by design. Immaterial size.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `shared_reports`       | Stays in D1. Correctly bounded by the underlying scan's own retention cascade; no action needed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

---

## What this document deliberately does not do

Per this task's scope (Phase 5, docs-only), this document does not recommend or design any code
change (no `resource_hash` deduplication, no `html_meta` payload reduction, no `scan_diffs` FK
fix) — it models current, as-built behavior and states honestly where the numbers land. The one
sensitivity that dominates every scenario above — the size of the `html_meta` homepage HTML
snapshot — is flagged prominently as the thing worth re-measuring against a real deployed database
before treating any of these projections as more than an estimate.
