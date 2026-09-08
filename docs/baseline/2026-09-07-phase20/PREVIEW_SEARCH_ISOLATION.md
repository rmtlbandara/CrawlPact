---
Document owner: Engineering owner
Status: current-authoritative
Date: 2026-09-07
---

# Preview search isolation (Phase 20, P0)

## Why this was P0

`preview.crawlpact.com` became a real Custom Domain (not just a `*.workers.dev` fallback) as part
of the September 7 Google Sign-In work (ADR-0009). The connected Search Console property is a
**Domain property** for `crawlpact.com`, whose scope includes every subdomain — so a crawlable,
indexable preview would compete with production in search the moment Google discovered it. The
latest settled Search Console data (through 2026-09-05, per the seed evidence for this phase)
predates the Custom Domain going live, so its absence from that data is not evidence preview is
safe — it's evidence the risk window had not yet opened when that data was captured.

## What was found (fresh, 2026-09-07, direct production checks)

- `https://preview.crawlpact.com/` returned a real, fully-rendered `200` page — indistinguishable
  from production content.
- `https://preview.crawlpact.com/robots.txt` returned **the exact same content as production** —
  `Allow: /`, no disallow of the root. Preview was not blocking crawlers at all.
- No `X-Robots-Tag` header and no page-level `noindex` meta tag existed anywhere on preview.
- `https://preview.crawlpact.com/sitemap.xml` returned `200` (harmless in content — it only ever
  listed production URLs, since `sitemap.xml.ts` falls back to the build-time `site` config — but
  still an unreviewed, unintended surface).

**Preview was not search-isolated at all.** This was a genuine, live P0 defect, not a theoretical
risk.

## Fix

### 1. `robots.txt` converted from a static file to an SSR endpoint

`apps/web/public/robots.txt` (a static file, identical for every environment by construction) was
deleted and replaced with `apps/web/src/pages/robots.txt.ts` (`prerender = false`), which reads
`getEnv().PUBLIC_APP_ENV` at request time and serves:

- production: the original content, unchanged (`PRODUCTION_ROBOTS_TXT`);
- preview: `User-agent: *\nDisallow: /` — no `Sitemap:` line, so nothing on preview is ever
  submitted for indexing (`PREVIEW_ROBOTS_TXT`).

A static file at the same path would have shadowed this endpoint under Cloudflare's default
asset-first routing, so the static file had to be removed, not merely left alongside it.

### 2. `X-Robots-Tag: noindex` stamped on every preview response, regardless of rendering mode

`middleware.ts` already set `X-Robots-Tag` for specific path prefixes, but only for SSR
responses — prerendered pages never run Astro middleware at all (`middleware.ts`'s own doc
comment; confirmed by the same live evidence this phase gathered for the canonical-URL work).
Belt-and-suspenders with (1) requires a mechanism that reaches _every_ response.

`wrangler.jsonc` now sets `env.preview.assets.run_worker_first: true` — this forces every preview
request through the Worker first, including ones that would otherwise be served directly as a
static asset. `src/worker.ts`'s `fetchWithPreviewSearchIsolation` wraps the Astro handler and, only
when `env.PUBLIC_APP_ENV === "preview"`, stamps `X-Robots-Tag: noindex, nofollow, noarchive,
nosnippet` on the response before returning it. Production does not set `run_worker_first`, so
this wrapper's preview branch never executes in production and production's asset-serving
performance is unaffected.

Both mechanisms are deliberately layered: robots.txt stops a compliant crawler from ever fetching
a preview page; the header catches a crawler that reaches one anyway (a direct link, a
certificate-transparency-log-driven crawl, etc.). Google's own guidance advises against combining
`disallow` and `noindex` only when content is _already indexed_ under the disallowed path
(disallow would then prevent Google from ever seeing the `noindex` tag to act on it) — not
relevant here, since preview was not yet indexed anywhere.

### 3. A confirmed regression this fix required fixing

Enabling `run_worker_first` for preview has a second effect, discovered while verifying this fix
locally: it bypasses Cloudflare's `_redirects`/`html_handling` edge processing entirely for
asset-matched paths, which would have silently broken the canonical trailing-slash redirect for
every prerendered page — on preview only. See `CANONICAL_URL_CONTRACT.md`'s
"A third mechanism was required" section for the fix
(`needsTrailingSlashRedirectPreview` in `route-registry.ts`, applied in `worker.ts` before
`handle()` is called).

## Verification

Direct unit tests (`worker.preview-isolation.test.ts`, `robots-txt.test.ts`) exercise both
branches of every function with `PUBLIC_APP_ENV` mocked to `"preview"`, `"production"`, and
`"local"`. `CLOUDFLARE_ENV=preview pnpm --filter @crawlpact/web build` was run locally and its
generated `dist/server/wrangler.json` inspected directly, confirming `vars.PUBLIC_APP_ENV:
"preview"` and `assets.run_worker_first: true` are correctly baked into the deployable config from
`env.preview` in `wrangler.jsonc` (Wrangler's Vite-plugin-style environment selection via
`CLOUDFLARE_ENV`, not the `--env` CLI flag, which this repo's own `scripts/build.sh` already uses
for `pnpm run build:preview`).

**Full live runtime verification of the preview branch itself (`PUBLIC_APP_ENV === "preview"`
actually observed at request time) was not completed in this execution environment**: this
machine's `.dev.vars` file unconditionally sets `PUBLIC_APP_ENV=local` and Wrangler's local dev
overlays it regardless of which named-environment build is loaded — a deliberate, pre-existing
safety mechanism (see `scripts/build.sh`'s own comment about a past incident where a
locally-present `.dev.vars` baked local values into a production build) that this phase correctly
did not bypass. This is the one item this phase could not fully close from this execution
environment; final confirmation requires observing the actual deployed Preview environment
(Section 44 of the Phase 20 prompt: "deploy through the normal trusted Preview workflow... validate
preview noindex") — a normal, expected part of the release flow, not a gap introduced by this
phase's own verification effort.

## Outcome

| Check                                     | Before                              | After                                                                                                          |
| ----------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `preview.crawlpact.com/robots.txt`        | Identical to production, `Allow: /` | `Disallow: /`, no sitemap                                                                                      |
| `X-Robots-Tag` on preview responses       | Absent everywhere                   | `noindex, nofollow, noarchive, nosnippet` on every response (prerendered and SSR)                              |
| Preview canonical trailing-slash behavior | N/A (didn't exist)                  | Matches production exactly (own Worker-level check, since `_redirects` doesn't apply under `run_worker_first`) |
| Production behavior                       | —                                   | Unchanged; `run_worker_first` and the preview-only robots.txt branch never execute in production               |
