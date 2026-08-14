# Phase 19 Organic Growth Operating Model

Status: current-authoritative, 2026-08-14.

## Search Console

Not yet connected — see `PHASE_19_SEARCH_CONSOLE_BASELINE.md`. Once connected, it becomes the
primary demand signal for content prioritization (§55, §64) — not the only one.

## Content discovery priority (§55)

1. Search Console demand (once available).
2. Actual audit/customer questions (currently: none received, 0 external users).
3. Crawler-registry changes (ongoing, per `PHASE_19_REGISTRY_MAINTENANCE_POLICY.md`).
4. Official crawler documentation changes.
5. Platform-specific implementation problems.
6. Repeated support friction (currently: no support volume exists to draw from).
7. Observatory research.

Not keyword-volume speculation alone (§55). With 0 external users and no Search Console
connection, the practical near-term source is #3/#4/#7 — registry and Observatory-driven, not
demand-driven — until real external signal exists.

## Content updates

Reuses `docs/seo/CONTENT_FRESHNESS_AND_REVIEW_POLICY.md`'s existing review-trigger and cadence
model (Phase 7) unchanged — extended this pass with an explicit `research-dependent` content
classification for Observatory material, which postdated that policy's original Phase 7 scope.
See that document's new addendum.

## No thin programmatic SEO (§60)

No crawler × platform × purpose combinatorial page generation is planned or in progress. The
existing `/crawlers/*`, `/platforms/*`, `/for/*` pages remain hand-curated.

## Internal linking

Existing `docs/seo/INTERNAL_LINK_ARCHITECTURE.md` governs this; unchanged, not duplicated here.

## Measurement

Per-change tracking (change date, affected pages, reason, baseline, evaluation window, result)
applies to any future content/metadata change (§65) — none has been made in this Phase 19
foundation pass, since no code/content change was needed to establish the operating model itself.

## Quality guardrail

No mass content publication without content-quality review, source verification, duplicate/thin
check, and indexability review (§144) — unchanged standing rule, enforced by the existing
`content:validate`/`content:links:check` gates plus editorial judgment.
