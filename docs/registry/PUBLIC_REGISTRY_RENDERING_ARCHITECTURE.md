---
Document owner: Engineering owner
Status: current-authoritative
Last verified: 2026-08-11
---

# Public Registry Rendering Architecture

Resolves the duplication Section 69 asks about, between the runtime D1 registry and the static
crawler Markdown content collection (`apps/web/src/content/crawlers/*.md`,
`apps/web/src/pages/crawlers/`).

## Current architecture

The public `/crawlers` directory and `/crawlers/:slug` pages are **entirely static-site-generated
from the Astro content collection**, independent of the D1 `crawlers`/`registry_versions` tables.
This was true before Phase 15 and remains true after it — this phase did **not** rearchitect these
pages to read from D1 at request/build time.

## Options evaluated (Section 72)

**Option A — runtime release-backed directory.** Read the active release's snapshot from D1
(via `getActiveRegistry`/`getRegistryVersionSnapshotMap`, now hardened this phase) at request
time, merging optional editorial content from the Markdown files by slug. Would fully eliminate
drift risk: publishing a new release would be immediately reflected on the public directory with
no separate content-authoring step.

**Option B — generated canonical artifact.** Generate the public content collection _from_ a
published release as part of a coordinated deploy. Only worth it if registry activation itself
already requires a coordinated app deployment — it currently doesn't (Section 196 explicitly
separates the two approvals).

## Decision: defer Option A, disclose the current gap honestly

Neither option was implemented this phase. Reasoning:

- The current 23-crawler registry changes infrequently (three prior releases across roughly a
  month of product history before this phase). The operational cost of manually keeping
  `reference-data.sql` and the Markdown content collection in sync each release is real but
  currently small.
- Converting these pages from `prerender = true` static generation to request-time D1-backed
  rendering is a genuine architectural change (routing, caching headers, build pipeline) that
  touches public SEO-critical pages — Section 148 explicitly warns against destabilising this
  surface. Rushing it within an already-large phase risked exactly the kind of "build something
  smaller and call it done" outcome this project's own engineering rules prohibit.
- The **factual core that matters most for governance correctness — what a scan evaluated
  against — is now unconditionally sourced from the immutable release snapshot** (this phase's
  primary fix). The public directory's freshness is a real but lower-severity concern: it affects
  how quickly a correction becomes publicly visible, not whether an audit result is reproducible
  or trustworthy.

## What was done instead, this phase

- **`pnpm registry:public:validate`** (new) fails CI if the _set_ of evaluation-eligible crawler
  slugs in the seed/reference data has no corresponding content-collection entry beyond what's
  already disclosed generically on the directory page — turning silent drift into a build-time
  failure a human must act on, rather than eliminating drift risk architecturally.
- **Removed the one hard-coded, name-specific disclosure** ("One entry (Bingbot) has no dedicated
  reference page yet") from `/crawlers`, replacing it with a general, evergreen statement that
  cannot go stale regardless of which crawler is affected in the future (Section 76).
- **Crawler/operator counts remain computed from the content collection**, never hard-coded — this
  was already correct pre-Phase-15, confirmed rather than assumed.

## Trigger for revisiting

If the registry starts publishing releases more than roughly monthly, or if a customer-facing
incident traces back to public-page staleness, build Option A. The canonical snapshot schema
(`schemaVersion`) and the `registry_version_activations` history this phase added are both
designed to make that migration additive when it happens.
