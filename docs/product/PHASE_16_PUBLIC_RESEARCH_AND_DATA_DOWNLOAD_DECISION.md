# Phase 16 public research and data download decision

## Decision

**No downloadable JSON/CSV export and no public research API this phase.** Publications are
rendered as HTML only (`/research/[slug]`, with an accessible data table for every key finding —
the table, not a chart, is the authoritative representation, per §80).

## Why

- §84 explicitly warns against building a broad public research API "merely because data exists" —
  no real product or research use case for programmatic access was identified this phase.
- §82/§83 make a JSON/CSV export optional ("Evaluate providing..."), not required, and require
  defining licensing terms first if one is built (§164) — that decision wasn't sought this phase,
  and shipping a download without it would create an implicit, unreviewed data-licensing
  commitment.
- The only publication that exists (Registry Landscape) has a small, fully-inline finding set — the
  HTML page's own accessible table already serves the "machine-readable enough to verify by hand"
  need; there's no large dataset a download would meaningfully unlock yet.

## What would change this

A real external consumer requesting the data (a journalist, a researcher, a partner integration) or
a second publication kind with a genuinely large finding set where inline HTML stops being a usable
representation. At that point: define licensing terms explicitly (§164 — CrawlPact's repository
stays proprietary/private regardless; a data licence is a separate, narrower grant), then add a
static JSON/CSV artifact per publication (§82, no API needed for a static file), reusing the
already-computed and already-checksummed `content_json`.

## No R2 needed yet

Since no downloadable artifact exists, R2 was not introduced (§168 — use R2 only when research
artifacts materially benefit from it; D1-stored `content_json` rendered server-side is sufficient
for what shipped).
