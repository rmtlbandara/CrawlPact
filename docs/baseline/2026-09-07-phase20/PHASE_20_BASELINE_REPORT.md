---
Document owner: Engineering owner
Status: current-authoritative
Date: 2026-09-07
---

# Phase 20 baseline report — executive summary

## Verdict

**PARTIAL** (implementation complete and locally verified; not yet deployed; two gates
explicitly blocked by execution-environment tool access — see below). Not `PASS`, because Phase 20's
own acceptance criteria (§63, §67) require Search Console to have been "actually analyzed" with
real tool access, which was unavailable this session, and require production validation _after_ an
authorized release, which has not happened. Not `BLOCKED` either, because the substantive
implementation work — the actual defects this phase exists to fix — is done, tested, and ready.

## What Phase 20 found (all fresh evidence, 2026-09-07)

1. **A real, live P0 defect**: `preview.crawlpact.com` was not search-isolated at all — same
   `robots.txt` as production (`Allow: /`), no `X-Robots-Tag`, no `noindex`. Fixed — see
   `PREVIEW_SEARCH_ISOLATION.md`.
2. **A confirmed canonical-URL defect broader than the seed evidence described**: every
   prerendered page redirected non-slash→slash with a _temporary_ (307) redirect, and — not
   previously documented — every SSR marketing page (`/pricing`, `/status`, `/changelog`,
   `/scanner`, `/observatory`, `/observatory/registry`, `/for/:slug`) had **no redirect between
   variants at all**, serving both forms independently at `200`. Fixed — see
   `CANONICAL_URL_CONTRACT.md`.
3. **The sitemap listed several of its own URLs in a form that redirected** (`/about`,
   `/tools/robots-txt-ai-validator`, etc., without the trailing slash their own canonical form
   requires) — a direct violation of "sitemap must list canonical, non-redirecting URLs." Fixed.
4. **A confirmed regression risk in the preview fix itself**: enabling `run_worker_first` to fix
   (1) silently breaks the `_redirects`-based fix for (2) on preview, discovered and fixed during
   this phase's own local verification — see `CANONICAL_URL_CONTRACT.md`'s "third mechanism"
   section.
5. **Five stale current-authoritative documents** — see `DOCUMENTATION_CONFLICTS.md`.
6. **No database/schema change was needed** for any of the above.

## What Phase 20 fixed

| Area                                                              | File(s)                                                                                                                                                                        | Change                                                                                                                                          |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Preview search isolation                                          | `src/pages/robots.txt.ts` (new, replaces `public/robots.txt`), `src/worker.ts`, `wrangler.jsonc`                                                                               | Environment-aware robots.txt; `X-Robots-Tag: noindex` stamped on every preview response via `run_worker_first`                                  |
| Canonical trailing slash — prerendered pages                      | `public/_redirects` (new)                                                                                                                                                      | Explicit 301 rules, one hop, for every `PRERENDERED_ROUTES` entry                                                                               |
| Canonical trailing slash — SSR pages                              | `src/middleware.ts`                                                                                                                                                            | 301 redirect for a GET/HEAD request to a bare `SSR_INDEXABLE_ROUTES`/`SSR_INDEXABLE_PREFIXES` path                                              |
| Canonical trailing slash — preview (run_worker_first side effect) | `src/worker.ts`, `src/lib/route-registry.ts`                                                                                                                                   | `needsTrailingSlashRedirectPreview` — preview's own copy of the redirect logic, since `_redirects` doesn't apply once `run_worker_first` is set |
| Single source of truth                                            | `src/lib/route-registry.ts` (new)                                                                                                                                              | `sitemap.xml.ts`, `middleware.ts`, `worker.ts`, and `_redirects` (via a drift test) all read the same route lists                               |
| Sitemap                                                           | `src/pages/sitemap.xml.ts`                                                                                                                                                     | Static routes now list their canonical trailing-slash form                                                                                      |
| Test strengthening                                                | `tests/e2e/seo-metadata.spec.ts`, `src/middleware.test.ts`, `src/lib/route-registry.test.ts` (new), `src/worker.preview-isolation.test.ts` (new), `src/lib/robots-txt.test.ts` | Exact canonical-equality assertion (no slash-normalization tolerance); redirect behavior tested end-to-end at the middleware/worker level       |

## What Phase 20 deliberately did not touch

- Content, pricing, plan entitlements, crawler registry semantics, OAuth architecture, CSP,
  consent, GA4 wiring — none of these had a Phase-20-blocking defect, so none were changed
  (§50–52 of the execution prompt).
- Metadata/structured-data content rewriting beyond what was already technically necessary — no
  systemic defect was found in Organization/Article JSON-LD or per-page metadata during this
  pass's file review that rose to a Phase 20 blocking level; a deeper metadata/structured-data
  audit (title/description quality, Organization logo, Article image policy — Sections 20–26 of
  the execution prompt) was not performed in this pass given the scope already covered and is
  recorded as Phase 20 backlog below, not silently dropped.
- `docs/deployment/CLOUDFLARE_CONFIGURATION.md`'s host/protocol canonicalization claims — verified
  correct, left as-is.

## Backlog surfaced but not completed this pass (explicitly deferred, not dropped)

- Full route/indexability/canonical inventory table (`ROUTE_INDEXABILITY_CANONICAL_MATRIX.md`,
  Section 13) — `docs/seo/ROUTE_REGISTRY.md` was corrected (the `/scanner` staleness) rather than
  fully rebuilt as a new machine-checked matrix; the existing table plus this evidence package
  cover the same ground with less duplication risk.
- Full Organization/Article/BreadcrumbList JSON-LD audit (Sections 22–24) and image-alt audit
  (Section 26) — not performed; no evidence of a defect was found in the files this phase did
  read (`BaseLayout.astro`), but a dedicated pass was out of scope given the P0 canonical/preview
  work took priority.
- Bulk Search Console URL Inspection (Section 18) and post-release annotation (Section 48) —
  blocked on tool access; owner action documented in `SEARCH_CONSOLE_BASELINE.md`.
- GA4 account-scope connection status and CrUX field-data state (Sections 29, 31) — not
  independently re-checked; no tool access.

These become explicit Phase 21/22 handoff items — see the completion report.

## Immediate next step

Deploy through the normal trusted Preview workflow (`deploy-preview.yml`), validate the preview
branch's actual runtime behavior there (the one thing this session's `.dev.vars`-constrained local
environment couldn't observe — see `PREVIEW_SEARCH_ISOLATION.md`), then production, per this
repository's standard release process and only with the user's explicit, in-the-moment
authorization.
