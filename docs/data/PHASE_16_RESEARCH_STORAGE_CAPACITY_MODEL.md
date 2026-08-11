# Phase 16 research storage capacity model

## Layer A (built) — negligible, bounded by design

`research_publications` stores one row per publication, not per observation. A single "AI Crawler
Registry Landscape" publication's `content_json` (title, summary, ~10 key findings, 4 sections,
4 limitations) is a few KB of JSON. Even a monthly cadence of this one publication kind indefinitely
retained (§128 — published aggregates are kept as historical evidence) is on the order of tens of
KB per year — immaterial against CrawlPact's existing D1 storage budget, and far smaller than a
single registry release's own `registry_version_entries` footprint.

No growth model beyond this was needed: `bytes per publication × publications per year × years` is
bounded by a manual publication cadence (§45, never automatic), not by any variable corpus size.

## Layer B (not built) — the model this document would need before Layer B ships

```
bytes per observation × corpus size × runs per year × retention
```

None of these variables have real values yet, since no corpus has been selected
(`PHASE_16_RESEARCH_CORPUS_DECISION.md`). This document will be filled in with real numbers once a
specific corpus size and run cadence are proposed — not estimated speculatively now, since a
speculative estimate would create false confidence about a system that doesn't exist.

## Capacity gate before Layer B collection is enabled

Before any automated research collection is built, measure (per §40 of the Phase 16 prompt): CPU
per research observation, D1 reads/writes per run, fetched bytes, runtime duration, storage growth,
and total corpus runtime — then compare against Phase 11's existing capacity triggers
(`docs/data/PHASE_11_RETENTION_DECISION_MATRIX.md` and the Phase 11 capacity documentation). Research
collection is explicitly lower priority than customer-facing operations, scheduled paid monitoring,
and retention/reliability jobs (§41) — it may be delayed under capacity pressure, and paid
monitoring cadence is never reduced to make room for it.
