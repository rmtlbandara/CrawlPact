---
Document owner: Engineering owner
Status: current-authoritative
Last verified: 2026-08-11
---

# Crawler Lifecycle Model

Defines the five `crawlers.lifecycle_status` values precisely (Phase 15, Section 12), and
separates lifecycle state from purpose confidence (`unknown`) — these are frequently confused and
are fundamentally different questions.

## The five states

### `unverified`

A candidate record. Not eligible for active evaluation under any circumstances —
`getActiveRegistry()`/`resolveEvaluationRows` (`apps/web/src/lib/registry-data.ts`) filters
`unverified` out unconditionally, regardless of what a release snapshot contains. A crawler stays
`unverified` from `createCrawlerDraft` until an explicit `verifyCrawler` admin action records real
source evidence.

### `active`

Currently documented by the operator and verified against that documentation. Fully eligible for
evaluation.

### `deprecated`

Still meaningful — historically or presently — but the operator's own documentation marks it
de-emphasised (e.g. superseded guidance, reduced crawl volume) without a specific named
replacement. Still eligible for evaluation (a deprecated crawler can still visit sites and its
policy signal still matters) — only `unverified`/`retired` are excluded.

### `replaced`

Superseded by a specific, named replacement crawler (`replacementCrawlerId` set). Still eligible
for evaluation for the same reason as `deprecated` — the old token may still be seen in the wild
until the operator fully retires it.

### `retired`

No longer considered a current, active crawler signal, with evidence supporting retirement (the
operator explicitly says the token is gone, or equivalent). Excluded from evaluation. Historical
releases where it was active are preserved unchanged (Section 43).

## What does _not_ change lifecycle automatically

A temporary `404`/`403`/timeout/JS-rendering failure on a source-health check must never
auto-retire, auto-deprecate, or otherwise auto-transition a crawler's lifecycle
(`docs/registry/REGISTRY_REVERIFICATION_POLICY.md`). Lifecycle transitions are always an explicit
`deprecateCrawler` admin action with a reason, audit-logged.

## `purpose = unknown` vs `lifecycleStatus = unverified` — the critical distinction

These describe two unrelated axes and must never be conflated in code, UI copy, or public pages:

|                                | Means                                                                                                                                                                                                                                        | Example                                                                                                                       |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `lifecycleStatus = unverified` | CrawlPact has **not verified the crawler's identity/token** against an official source. Never evaluated.                                                                                                                                     | A newly-drafted candidate record awaiting admin review.                                                                       |
| `purpose = unknown`            | CrawlPact **has** verified the crawler/token from an official source, but that source's evidence does not establish one of the more specific purpose categories with sufficient confidence. Fully evaluated like any other `active` crawler. | `GoogleOther` — Google's own documentation says only "various product teams," with no more specific classification available. |

Public copy for a verified `unknown`-purpose crawler must say something like: _"The crawler
itself is documented by the operator, but the current official documentation does not establish a
more specific purpose that CrawlPact can verify."_ It must never say "unverified crawler" — that
would misrepresent a fully-verified, actively-evaluated crawler as an unreviewed candidate. See
`docs/registry/PUBLIC_REGISTRY_RENDERING_ARCHITECTURE.md`.

## `mixed` vs `unknown`

`mixed` is used only when official evidence **positively supports multiple material purposes**
and no more precise per-token split is available (example: `Amazonbot`, whose own documentation
states it serves both general product-improvement and potential AI-training purposes, with no
separate token for each — unlike Amazon's own `Amzn-SearchBot`/`Amzn-User`, which _do_ split by
purpose). `unknown` is used for genuine uncertainty. `mixed` must never be used as a shorthand for
"we're not sure" — that is what `unknown` exists for.
