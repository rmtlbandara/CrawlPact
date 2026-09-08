---
Document owner: Engineering owner
Status: current-authoritative
Date: 2026-09-07
---

# Documentation conflicts found and resolved (Phase 20)

Each row: what the current-authoritative document claimed, what fresh evidence this phase
gathered, why it went stale, and what changed.

## 1. `docs/status/CURRENT_STATE.md` header

- **Claimed**: `Last verified: 2026-08-18`, commit `e72d7242…`, Worker version
  `9efd4c33-9b64-4959-94f8-2f79a7d50294`, migration `0037`.
- **Fresh evidence**: current HEAD `0698829`, latest deployment `4f775d19-…` (2026-09-07T11:04Z),
  migration `0038` (38/38, live D1 query) — see `PRODUCTION_PARITY_MATRIX.md`.
- **Why it went stale**: the September 7 Google Sign-In work (ADR-0009) shipped a real
  application-code change, a new migration, and a new production deployment, but no session had
  yet gone back and updated this file's own header/executive-status section to reflect it — the
  ADR-0009 commits themselves document the auth work in detail, but `CURRENT_STATE.md` is
  supposed to be the _single_ authoritative cross-cutting summary, and it wasn't updated.
- **Resolution**: header and executive status refreshed with the real values above, plus a Phase
  20 paragraph. Historical Phase 0–19 content preserved, not rewritten.

## 2. `docs/risks/ACTIVE_RISKS.md` RISK-032

- **Claimed**: `accepted (POST-LAUNCH)` — "No Search Console property connected."
- **Fresh evidence**: the Phase 20 seed evidence states a property has been connected since
  2026-07-30 (Domain property, `sc-domain:crawlpact.com`), with real cumulative performance data
  through 2026-09-05.
- **Why it went stale**: RISK-032's trigger condition (connecting a property) is a manual,
  one-time, external product-owner action outside this repository's own visibility — no automated
  signal in-repo would ever flip this risk's status on its own.
- **Resolution**: marked **resolved** (connection established), with an explicit note that this
  session could not independently re-verify the connection is still live (no GSC API access) —
  disclosed, not silently assumed. See `SEARCH_CONSOLE_BASELINE.md`.

## 3. `docs/seo/PHASE_19_SEARCH_CONSOLE_BASELINE.md`

- **Claimed**: "No Google-authenticated Search Console access exists" (true when written,
  2026-08-14).
- **Fresh evidence**: access now (reportedly) exists.
- **Why it went stale**: this document correctly recorded a point-in-time fact and was never
  intended to auto-update — its own text already anticipated this ("A future session with real
  authenticated access should…").
- **Resolution**: **not rewritten** — the historical record of Phase 19's attempt stays accurate to
  what was true then. A supersession notice was added at the top pointing to Phase 20's
  `SEARCH_CONSOLE_BASELINE.md` as the current state.

## 4. `docs/status/KNOWN_RISKS.md` — the trailing-slash/canonical entry

- **Claimed** (paraphrased): "the underlying redirect and canonical-format inconsistency are
  pre-existing, real, and not changed by this pass — a deliberate SEO decision… is a separate,
  future product call."
- **Fresh evidence**: that future call has now been made and implemented — see
  `CANONICAL_URL_CONTRACT.md`.
- **Why it went stale**: it was written explicitly as a deferred decision, correctly scoped to a
  prior, narrower release-flow-focused pass.
- **Resolution**: entry updated to record that Phase 20 resolved the inconsistency, with a pointer
  to the new contract doc, rather than leaving a "someone should fix this later" note standing
  after it was actually fixed.

## 5. `docs/seo/ROUTE_REGISTRY.md`

- **Claimed**: `/scanner` is "Prerendered."
- **Fresh evidence**: `apps/web/src/pages/scanner.astro` has `export const prerender = false` —
  it is SSR, and was independently confirmed live (both `/scanner` and `/scanner/` returned `200`
  before this phase's fix, the exact SSR duplicate-URL signature).
- **Why it went stale**: unclear — possibly changed to SSR in a later phase (Phase 11's public
  cache policy references `scanner.astro` setting its own `Cache-Control`, which only SSR pages
  need to do) without this table being updated to match.
- **Resolution**: corrected, and a "Canonical" column plus a pointer to
  `CANONICAL_URL_CONTRACT.md` added so this table can't silently drift from the enforcement
  mechanism again.

## What was checked and found _not_ stale

- `docs/deployment/CLOUDFLARE_CONFIGURATION.md`'s claims about HTTP→HTTPS and `www`→apex being
  implemented, one-hop redirects: confirmed correct by fresh `curl` checks (see
  `PRODUCTION_PARITY_MATRIX.md`).
- The existing GA4 architecture description (production-only, consent-gated, excluded from
  private routes): reviewed in source, found accurate, not touched.
- ADR-0009's own record of the Google Sign-In fix and real-account confirmation: independently
  corroborated by this phase's own D1 migration check (`0038_google_oauth.sql` applied) and
  deployment-timestamp correlation — not contradicted, not reopened.
