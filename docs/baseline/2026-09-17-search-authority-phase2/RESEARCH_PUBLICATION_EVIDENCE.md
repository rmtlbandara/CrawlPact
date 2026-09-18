---
Document owner: Engineering owner
Status: current-authoritative (Phase 2, §15-16 — first research publication readiness)
---

# First Research Publication Readiness — "AI Crawler Registry Landscape" — 2026-09-17

Phase 2 §15-16 asks whether CrawlPact should publish its first original research asset this
phase, and requires that decision be evidence-based, not a scaled/fabricated content exercise.

## Infrastructure check (real, live)

- `research_publications` table: confirmed empty in Production (`SELECT id, title, slug, status,
  published_at FROM research_publications LIMIT 10` → `[]`). The research-publication feature has
  never been used for a real publication — this would be the first.
- `generateRegistryLandscapeDraft(db, { createdByUserId })` in
  `apps/web/src/lib/admin/research.ts` deterministically builds the entire report from
  `getRegistryObservatorySnapshot()` — no hand-authored content, no scaled/templated filler. It
  requires only a real user id (the same governed-action pattern as the registry release above).
- `buildRegistryLandscapeContent()` in `apps/web/src/lib/research/publication-content.ts`
  produces, from real registry data: a `findings` array (evaluation-eligible count, purpose
  distribution per category with exact numerator/denominator/scope, verification counts,
  review-due counts on a 180-day threshold, operator count), a `sections` array (Dataset,
  Methodology, Results/release history, Registry/ruleset provenance), and a `limitations` array
  (four explicit caveats about what the data does and does not prove). This structure already
  satisfies Phase 2's anti-fabrication bar — it cannot produce a claim the registry data doesn't
  support, because it's computed, not written.

## What the report would actually say, using real production data (previewed this pass)

Queried live against the current published release (`2026.07.3`, 23 crawlers, 9 operators):

- **Purpose distribution**: search 7 (30%), training 5 (22%), user_triggered 4 (17%), agent 2
  (9%), advertising_validation 2 (9%), unknown 1 (4%), research 1 (4%), mixed 1 (4%) — sums to 23.
- **Verification health**: 23/23 evaluation-eligible crawlers verified (100%), 0 past the
  180-day review-due threshold. This is a genuinely strong, reportable finding — every governed
  entry is currently fresh, none overdue.
- **Operator count**: 9 distinct operators governing the 23 published crawlers.
- **Release history**: exactly 1 published release ever (`2026.07.3`) — so this first report
  cannot yet describe a release-over-release trend (e.g. "crawlers added per quarter"); it can
  only describe a single snapshot. This is an honest limitation the generator's own `limitations`
  array is built to surface, not something to paper over.

## Should Phase 2 publish it this pass?

**Recommend yes, but sequenced after the registry release decision above, not before it.**
Publishing the research report first, then the `Applebot` release second, would mean the report's
own headline numbers (23 crawlers / 9 operators) go stale within the same phase — undermining the
"authoritative reference" positioning this content is meant to establish. Recommended order:

1. Publish registry release `2026.09.1` (24 crawlers, 9 operators) — see
   `REGISTRY_RELEASE_DECISION.md`.
2. Generate the research draft against the **updated** release (so its numbers are 24/9, not
   23/9), review it, and publish.

## Why this pass does not generate or publish the draft directly

Same governance boundary as the registry release: `generateRegistryLandscapeDraft` requires a
real `createdByUserId`, and the subsequent publish step requires audit-trail attribution to a
real authenticated admin. Inserting a `research_publications` row directly via D1 with a
synthetic user id would fabricate the audit trail this feature is designed to preserve, and is
the same category of action already correctly deferred for the Production deploy and the
registry release in this session.

## Concrete next step (owner action required, after the registry release is published)

1. Sign in as a Super Admin and trigger the "Generate Registry Landscape draft" action (calls
   `generateRegistryLandscapeDraft` with the real session's user id).
2. Review the generated draft against this document's preview — headline numbers should read
   24 crawlers / 9 operators / 24 verified / 0 review-due once the new release is live.
3. Decide the exact title/publication date at that time (Phase 2 §15 leaves title selection to
   publication time, based on the evidence available then) and publish through the governed
   review→publish workflow.
4. Once live, this content becomes a real internal-linking and distribution asset for the
   remaining Phase 2 sections (§6 internal architecture, §8 distribution) — those sections should
   link to the actual published URL, not a placeholder.
