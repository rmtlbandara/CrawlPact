# Cloudflare Capacity and Cost Report

**Date:** 2026-07-26. Phase 21 (capstone) of the Cloudflare infrastructure-alignment brief. This
document synthesizes every other document produced in this pass — it does not re-derive figures,
it summarizes and cross-references them. See each linked document for full evidence and method.

## Current architecture

One Cloudflare Worker (`crawlpact-web`, `apps/web/wrangler.jsonc`), Astro's `@astrojs/cloudflare`
adapter (SSR mode), Workers Static Assets for built static output, one D1 database per environment
(production `crawlpact-db`, preview `crawlpact-db-preview`, structurally separate but both still
holding placeholder IDs pending a real Cloudflare account), one daily Cron Trigger driving both the
monitoring sweep and the data-retention purge. **No R2 usage** — see
`docs/data/D1_R2_DATA_PLACEMENT_POLICY.md` for the evidence-based decision not to adopt it yet.
Full detail: `docs/deployment/CLOUDFLARE_ARCHITECTURE_AUDIT.md` (Phase 1).

## Latest verified Cloudflare limits

Fetched live against `developers.cloudflare.com` on 2026-07-26 — full table with sources, per-limit
CrawlPact impact, and recommended warning/upgrade thresholds:
`docs/deployment/CLOUDFLARE_RESOURCE_LIMITS.md` (Phase 0). The two figures every other document in
this pass is built on: **10ms CPU time per Workers invocation** (HTTP request and Cron Trigger
alike) and **500MB max size of a single D1 database** (distinct from the 5GB account-wide total,
which is shared across production and preview but is not the binding constraint — each database is
separately capped at 500MB regardless of how much of the account pool is otherwise unused).

## Current binding map

| Binding  | Type                  | Environment separation                                                                                                                                                                                    |
| -------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DB`     | D1 database           | Production and preview are distinct databases (structurally, since Part 3 Step 26); both currently hold the same placeholder ID pending a real account — a pre-launch setup task, not an architecture gap |
| `ASSETS` | Workers Static Assets | Shared build output per environment                                                                                                                                                                       |
| —        | R2                    | Not bound — no R2 usage exists (`D1_R2_DATA_PLACEMENT_POLICY.md`)                                                                                                                                         |

## D1 size estimate

Full method, per-table breakdown, and three scenarios: `docs/data/D1_STORAGE_CAPACITY_AUDIT.md`
(Phase 5). Headline: at the SRS's own commercial target (150+ paid customers, ~1,000 domains), the
production database is estimated to reach **45–70% of the 500MB cap within one year**, and to
**cross it entirely somewhere between year 1–2** under current code behavior — driven almost
entirely by `scan_resources` rows tagged `resource_type = 'html_meta'`, which capture the full
truncated homepage HTML body (not just meta tags), compounding across Pro's 24-month and Agency's
36-month retention windows. A "free/anonymous-heavy" growth scenario, counter-intuitively, produces
a _smaller_ database (~39% of cap at 3 years) than the expected paid-customer scenario, since
free/anonymous data self-limits via short retention and no scheduled monitoring.

## R2 size estimate

Not applicable — R2 is not adopted. `docs/data/D1_R2_DATA_PLACEMENT_POLICY.md` records five
concrete triggers that would reopen this decision, the most relevant being the D1 growth finding
above: the recommended _first_ response, if/when the D1 database approaches its cap, is two
cheaper D1-side changes (reducing `html_meta` capture size; populating the unused
`resource_hash` column to skip duplicate full-text writes), not necessarily an R2 migration.

## Worker request estimate

No production traffic exists yet (pre-launch). Per `docs/deployment/CLOUDFLARE_RESOURCE_LIMITS.md`,
the Free-plan daily request ceiling is 100,000/day, shared across marketing traffic, the audit API,
the customer/admin apps, and cron-internal invocations (not cron-internal fetches, which are
subrequests, not separate Worker requests). At every usage scenario modeled in
`docs/operations/MONITORING_CAPACITY_PLAN.md` (up to 1,000 monitored domains), daily request/D1
quota consumption stays comfortably under 5% of the Free-plan ceiling — **the daily request quota
is never the binding constraint** at any realistic near-term scale.

## Scheduled scan estimate

Full method: `docs/operations/SCAN_CAPACITY_BUDGET.md` (per-scan cost) and
`docs/operations/MONITORING_CAPACITY_PLAN.md` (aggregate scheduling, six scenarios). Headline: a
single scan is estimated at ≈3–7ms CPU typical, ≈12–25ms+ worst case — thin-to-negative margin
against the 10ms Free-plan ceiling. The scheduled monitoring sweep runs its entire per-tick batch
sequentially inside one Cron Trigger invocation, sharing that same 10ms budget across the whole
batch — meaning the current 20-domain default batch size is "essentially certain" to exceed the
ceiling, and the realistically CPU-safe batch size is closer to **1 domain per tick**. Modeled
against the SRS's own monitoring cadence (Solo monthly, Pro/Agency weekly), backlog begins
accumulating somewhere between 5 and 50 Solo customers — **the current design cannot reach the
SRS's own 150+/1,000-domain commercial target under Workers Free at all.**

## Free-plan suitability

**Mixed, tier by tier:**

- **D1 storage**: suitable for roughly the first 1–2 years at commercial target scale; not
  suitable indefinitely without either the two D1-side optimizations named above or a Paid
  upgrade (10GB per database).
- **D1 daily rows read/written, Workers daily requests**: comfortably suitable at every modeled
  scale up to 1,000+ domains — never the binding constraint.
- **Workers CPU time (per-invocation)**: **not confidently suitable** even at a modest pilot scale
  for the scheduled monitoring sweep specifically (strain begins ~50 Solo customers); thin-margin,
  not confidently safe, for individual anonymous/manual audit scans even at zero scale, since a
  worst-case public target (which an anonymous audit tool will encounter by design) can plausibly
  exceed 10ms on its own.
- **Everything else audited** (bundle size, static asset counts, Cron Trigger count, D1 database
  count) has ample headroom at CrawlPact's actual current scale.

**Overall verdict**: Workers Free is realistically suitable for **local development, a small
private pilot, and initial soft-launch traffic** — not for reaching the SRS's own stated commercial
targets. This is not a new conclusion (`docs/performance/PERFORMANCE_AND_COST.md` already
documented this expectation from Part 3), but this pass adds the specific, quantified mechanisms
behind it (D1 write fan-out, uncapped findings, per-tick CPU sharing) rather than leaving it at a
shape-level judgment.

## Paid-plan upgrade conditions

Full trigger table: `docs/operations/CLOUDFLARE_UPGRADE_TRIGGERS.md`. Concrete, in order of how
soon each is likely to actually bind at realistic growth:

1. **Recurring CPU-limit (error 1102) failures** on the monitoring-sweep or audit-scan code path —
   likely the first trigger to fire in practice, potentially before any other metric looks
   concerning, since it's an invocation-level failure, not a gradual quota approach.
2. **D1 production database crossing 60–80% of its 500MB per-database cap** — modeled to occur
   within year 1–2 at commercial target scale; the two cheaper D1-side mitigations
   (`html_meta` size reduction, `resource_hash` deduplication) should be tried first and could
   defer this substantially, but are not implemented in this pass.
3. **Monitoring cadence obligations (SRS §25) cannot be completed reliably** — modeled to begin
   between 5–50 Solo customers, well before the D1-storage trigger above.

None of the daily aggregate quotas (100,000 requests/day, 100,000 D1 rows written/day, 5,000,000
D1 rows read/day) are expected to bind first at any modeled scale.

## Data growth model

See `docs/data/D1_STORAGE_CAPACITY_AUDIT.md` for the full per-table model. Summary across the four
required scenarios:

| Scenario                                                        |                            Domains |                                                Steady-state D1 size (3yr, as-observed `html_meta`) |         % of 500MB cap |
| --------------------------------------------------------------- | ---------------------------------: | -------------------------------------------------------------------------------------------------: | ---------------------: |
| Low (5 Solo customers, pilot)                                   |                                 10 |                                                                                              ~3 MB |                    <1% |
| Expected (155 paid customers, SRS §3.3 target, "2027 scenario") |                             ~1,020 |                                                                                            ~659 MB |        132% (over cap) |
| High (free/anonymous-heavy growth)                              | ~7,000+ scan volume, low paid base |                                                                                            ~197 MB |                    39% |
| 1,000-monitored-domain (domain-count-driven)                    |                              1,000 | Consistent with the Expected scenario above (the SRS pairs 1,000 domains with 150+ paid customers) | Same range as Expected |

The "Expected" scenario is the one that matters most, since it is the SRS's own explicit
commercial target — and it is the one scenario that crosses the cap under current code behavior.

## Cost risks

- **D1/CPU headroom, as above** — the primary cost risk is not Cloudflare's list pricing itself,
  but the _timing_ of needing to upgrade to Workers Paid, which this report suggests is likely
  needed well before the SRS's own commercial success milestones are reached, not after.
- **No measured cost figure exists** — this report does not, and should not, claim a specific
  dollar cost, since no production Cloudflare account or Workers Paid subscription exists yet.
  Cloudflare's current Workers Paid pricing (a base subscription plus usage-based overages) should
  be checked against real traffic once a production account exists, not assumed from this report.
- **Do not claim zero cost.** Free-plan use during development/pilot is genuinely free; the
  moment real commercial traffic materializes, this report's own findings indicate a paid
  subscription is a near-term, not distant, expectation.

## Security risks

No new security risk is introduced or found by this pass — the Cloudflare alignment work is
capacity/cost/architecture-focused, and this report defers to the existing, current security
documentation: `docs/security/THREAT_MODEL.md`, `docs/security/SSRF_SECURITY_MODEL.md`,
`docs/status/FINAL_SECURITY_AUDIT.md`. One item worth naming here since it touches both capacity
and security: the scanner's `MAX_EXTERNAL_REQUESTS` counter undercounts true subrequest
consumption by not including redirect hops (up to 6× understatement in the worst case, per
`docs/operations/SCAN_CAPACITY_BUDGET.md` §1.1) — comfortably within the 50/request Free-plan
ceiling today, but worth folding into the external-request budget explicitly if scan scope ever
broadens.

## Operational risks

- **Recovery window is narrow on Free**: D1 Time Travel only reaches back 7 days
  (`docs/operations/BACKUP_AND_RECOVERY.md`) — an incident discovered later than that cannot be
  recovered via platform point-in-time restore.
- **No production Cloudflare account connected yet** — every figure in this report is an estimate
  against verified platform limits, not a measurement against a real deployed Worker. This is
  stated plainly throughout rather than presented as confirmed.
- **Preview domain/WebAuthn placeholders remain unresolved** (`docs/deployment/CLOUDFLARE_CONFIGURATION.md`)
  — a known, already-tracked pre-launch task, restated here for completeness.
- **Manual Cloudflare setup remaining**: real D1 database creation (production + preview, with
  distinct IDs), real domain/DNS configuration (`docs/deployment/CLOUDFLARE_CONFIGURATION.md`'s
  "DNS, SSL, and domain configuration" checklist), Universal SSL confirmation, and the recovery
  tabletop drill (`docs/operations/BACKUP_AND_RECOVERY.md`) — none of these can be performed
  without a real Cloudflare account, which this pass deliberately does not create or modify.

## Recommended launch configuration

1. **Do not launch commercially on Workers Free.** Use Free for continued local development and a
   small, invite-only pilot (comfortably fits Scenario 1, ~5 Solo customers). Budget for a Workers
   Paid subscription before any public/commercial launch push, not as a reactive fix after hitting
   a wall.
2. **Before or alongside the Paid upgrade, implement the cheaper tightening measures** identified
   in `docs/operations/SCAN_CAPACITY_BUDGET.md` (D1 write batching via `db.batch()` — highest
   leverage found in this pass — and capping the findings count) and
   `docs/data/D1_R2_DATA_PLACEMENT_POLICY.md` (`html_meta` size reduction, `resource_hash`
   deduplication). These reduce real CPU/storage cost regardless of plan tier, so they are worth
   doing even after upgrading to Paid, not just as a Free-plan stopgap.
3. **Fix the `scan_diffs` foreign-key gap** (`docs/status/KNOWN_RISKS.md`) before it can cause a
   real retention-purge failure in production — same class of bug as the Part 3 Step 21 fixes,
   same straightforward remedy.
4. **Complete the manual Cloudflare setup checklist** in `docs/deployment/CLOUDFLARE_CONFIGURATION.md`
   (real D1 IDs, real domain/DNS/SSL configuration, real preview `WEBAUTHN_RP_ID`/`RP_ORIGIN`)
   before any deploy is requested.
5. **Do not adopt R2 speculatively.** Revisit only per the concrete triggers in
   `docs/data/D1_R2_DATA_PLACEMENT_POLICY.md`.
6. **Do not adopt Cloudflare Pages.** ADR-0006 formalizes why the current single-Worker
   architecture remains the right choice.

## What this report deliberately does not do

It does not claim a specific dollar cost (no production account exists to measure against), does
not implement any of the tightening measures it references (all are documented follow-ups, per
this pass's explicit docs-only scope), and does not perform any deployment or live Cloudflare
resource change. See `docs/status/IMPLEMENTATION_STATUS.md` for the full accounting of what was
and was not done in this pass.
