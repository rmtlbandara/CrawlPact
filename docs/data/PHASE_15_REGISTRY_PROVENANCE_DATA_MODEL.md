---
Document owner: Engineering owner
Status: current-authoritative
Last verified: 2026-08-11
---

# Phase 15 — Registry Provenance Data Model

Section 13 asks Phase 15 to "evaluate" moving from the single `crawlers.official_source_url`
field to a richer multi-source provenance model (`crawler_sources` +
`crawler_source_verifications` tables). This document records that evaluation and the decision.

## Evaluation

Across all 23 currently-registered crawlers and 9 operators, **no crawler currently requires more
than one official source URL** to establish its identity, token, purpose, and lifecycle. Where an
operator documents multiple related crawlers on one page (e.g. Google's `Google-Extended`/
`Google-CloudVertexBot`/`GoogleOther`, Meta's four AI-purpose bots), CrawlPact already handles
this correctly — each crawler record cites that shared page's URL independently; nothing is lost
by not having a many-to-many `crawler_sources` join table.

A richer model would add real value in a case this registry doesn't currently have: a crawler
whose _identity_ is established by one official page and whose _purpose_ is established by a
different one (Section 16 anticipates this: "these may come from one or multiple official
sources... do not require one source URL to prove every claim when official documentation is
split"). No such crawler exists in the current 23.

## Decision: defer the richer provenance model, add lighter integrity instead

Building `crawler_sources` (source rows) and `crawler_source_verifications` (immutable
verification history) now would be schema scaffolding with no data to populate meaningfully — a
violation of Section 154's "do not add everything unless justified." Instead, Phase 15 hardens the
**existing** single-source model where it was structurally weak:

- **Release-time snapshot** (`registry-snapshot.ts`'s canonical schema v2) now captures
  `officialSourceUrl`, `firstVerifiedAt`, `lastVerifiedAt`, and `publishedIpInfo` as first-class,
  immutable, per-release fields — this is the "verification history" this registry actually
  needs today: what the evidence was _at the time each release was published_, permanently
  preserved per release rather than only reflecting whatever the live `crawlers` row currently
  says.
- **Release checksum** (`registry-checksum.ts`) gives each release an independently verifiable
  integrity fingerprint over its entire evidence set.
- **`registry:validate`** (existing, extended this phase) already flags missing sources and stale
  verification dates.

## Trigger for building the richer model later

If a future crawler genuinely needs multiple distinct sources (e.g. identity confirmed by an
operator's developer docs, purpose confirmed by a separate operator blog post), add
`crawler_sources`/`crawler_source_verifications` then, as an additive migration — nothing in this
phase's design blocks that. The canonical snapshot schema is already versioned (`schemaVersion`)
specifically so a future v3 could add multi-source support without rewriting historical release
snapshots (Section 156).

## Source types considered, not built

Section 15's controlled vocabulary (`operator_documentation`, `operator_help`,
`operator_repository`, `operator_policy`, `standard`, `manual_official_verification`) was
evaluated and would map cleanly onto the current single-URL model as an added `sourceType` column
on `crawlers` if desired later. Not added this phase, since without the multi-source table it
would only describe a single already-known URL with no consumer for the distinction yet.
