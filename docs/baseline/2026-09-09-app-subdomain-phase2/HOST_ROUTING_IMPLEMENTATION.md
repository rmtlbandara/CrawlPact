# Host Routing Implementation — Phase 2

Date: 2026-09-09. `apps/web/src/worker.ts`'s `fetchWithPreviewSearchIsolation` (name unchanged —
renaming was judged cosmetic churn not worth the diff; its doc comment now describes its full
responsibility) is now the single Worker-level host-boundary enforcement point, per
`CLOUDFLARE_HOST_BOUNDARY_DESIGN.md`.

## Decision order (exactly as implemented)

1. **Unknown host + sensitive path → 404.** `classifyRequestOrigin(request)` resolves `"public" |
"app" | "unknown"` from the request's own URL (never a header) against `lib/origin.ts`'s
   trusted-origin registry. If `"unknown"` and `isSensitivePath(pathname)` (`/admin`, `/api/`,
   `/app`, `/sign-in` — boundary-aware prefix matching, not a naive `startsWith`), the response is
   an immediate 404 before `handle()` ever runs. Public marketing content on an unrecognized host
   is untouched — there is no security boundary to enforce there.
2. **App surface, `/` → rewrite to `/app`.** The one deliberate internal rewrite this phase
   implements (see `APPLICATION_ORIGIN_IMPLEMENTATION.md`'s scope-decision section for why nothing
   broader was built). `rewritePathname()` constructs `new Request(newUrl, request)`, preserving
   method/headers/body/query untouched. No rewrite loop is possible (single-pass, deterministic,
   never re-entered for the same request), and no client-controllable header drives the decision —
   only the already-validated host classification and a literal `pathname === "/"` check.
3. **App surface, public-only path → redirect (GET/HEAD, 308) or reject (404, everything else).**
   `isPublicOnlyPath()` from `route-ownership.ts`. The redirect target is computed via
   `canonicalPublicPath()` (reuses `needsTrailingSlashRedirectPreview` to add the canonical
   trailing slash in the _same_ redirect, not a second hop) and `toPublicUrl()`, preserving the
   query string exactly. Non-GET/HEAD methods are rejected outright — the Wrong-Host Policy never
   replays a mutation to another origin.
4. **Everything else on the app surface passes through unchanged** — this covers `/sign-in`,
   `/app/**`, `/admin/**`, `/api/**`, which already live at their exact current paths and need no
   rewrite (see the de-prefixing scope decision).
5. **Canonical trailing-slash redirect, generalized.** Previously gated to
   `env.PUBLIC_APP_ENV === "preview"` only; now runs unconditionally for any request this
   function's `run_worker_first` configuration intercepts (which now includes production's
   prerendered paths too — see `STATIC_ASSET_HOST_ENFORCEMENT.md`). Applied to the (possibly
   rewritten) effective request, not the original — so the `/` → `/app` rewrite doesn't
   accidentally trigger a trailing-slash redirect for `/app` (it isn't in any indexable-route list,
   so `needsTrailingSlashRedirectPreview("/app")` is correctly `false`).
6. **`handle()` runs**, then the pre-existing preview `X-Robots-Tag: noindex` stamping applies
   unchanged.

## What is deliberately absent: apex→app enforcement

Only the app-surface direction is enforced. `crawlpact.com/sign-in`, `crawlpact.com/app/**` remain
fully functional and unredirected — this is the explicit Phase 2/3 migration-compatibility window
(ADR-0010), not an oversight. Phase 4's controlled cutover is what introduces the permanent
apex→app redirect, gated on every Phase 3 direct-host validation gate passing first.

## Test evidence

`apps/web/src/worker.host-boundary.test.ts` (new, 17 tests, all passing) exercises every branch
above directly against `fetchWithPreviewSearchIsolation` with a mocked `handle()` — proving, among
other things:

- a public prerendered page requested via the app origin never reaches `handle()` at all (asserted
  via `expect(handleMock).not.toHaveBeenCalled()`), closing the exact hard gate
  `CLOUDFLARE_HOST_BOUNDARY_DESIGN.md` exists to prove;
- the trailing slash and 308 redirect land in one hop with the query string intact;
- a non-GET/HEAD mutation to a public-only path on the app surface is rejected, never redirected;
- `/` rewrites to `/app` with method preserved, and is _not_ redirected to the public homepage
  (the one exception to rule 3, proven not to regress);
- the public surface's existing behavior (including `/app`/`/sign-in` continuing to work there) is
  completely unaffected by the new logic;
- an unrecognized host is rejected for `/sign-in`, `/app`, `/admin`, and a mutating `/api/*` call,
  but still served normally for public marketing content.

The pre-existing `apps/web/src/worker.preview-isolation.test.ts` (7 tests) continues to pass
unmodified in behavior — only its `getEnv` mock gained a real `PUBLIC_SITE_URL` value, since the
new host-classification logic now needs one (it previously mocked `getEnv` as `{}`, which nothing
before Phase 2 required).
