# Phase 4 — Redirect and Retirement Contract

Status 2026-09-14. Executable form: `apps/web/src/lib/legacy-redirect.ts`.

## Two-stage cutover

**Stage A (this pass, implemented)**: `LEGACY_REDIRECT_STATUS = 307` (Temporary Redirect).
Deliberately reversible and non-permanently-cacheable while Production health is unproven.

**Stage B (deferred, not performed by this pass)**: flip the same constant to `308` (Permanent
Redirect) — a one-line, trivially-reviewable diff, no other code change — only after a real
Production deployment of Stage A has passed the health gate described in the Phase 4 directive
§28 (a bounded live-observation window plus a synthetic GET/HEAD route matrix, zero rollback
triggers fired). This pass cannot perform or fabricate that gate — it requires an actual
Production deployment this session does not have standing authorization to dispatch without a
fresh, explicit, in-the-moment go-ahead (see `PHASE_4_STAGE_A_STATUS.md`).

## Redirect mappings

### `/sign-in`

```
crawlpact.com/sign-in[?continuation=|plan=&interval=]
  → app.crawlpact.com/sign-in[?<filtered>]
```

Query filtering (`filterSignInSearch` in `legacy-redirect.ts`):

- `continuation`: forwarded only if non-empty and ≤128 characters — the exact bound
  `sign-in.astro` itself already enforces before doing anything with it. This is a
  defence-in-depth pre-filter; the authoritative check happens again, server-side, at the app
  host, unchanged.
- `plan`: forwarded only if it is exactly `solo`, `pro`, or `agency`.
- `interval`: forwarded only alongside a valid `plan`, and only if it is exactly `month` or `year`.
- `continuation` takes priority — if present and valid, `plan`/`interval` are never also
  forwarded, matching `sign-in.astro`'s own existing precedence (a live continuation always wins).
- Every other query parameter (OAuth codes, `redirect_uri`, `access_token`, arbitrary UTM/tracking
  params, anything else) is silently dropped, never forwarded cross-origin.

### `/app`, `/app/**`

```
crawlpact.com/app/**  → app.crawlpact.com/app/**
```

Full path preserved verbatim — **no `/app` de-prefixing** (see `FINAL_ROUTE_OWNERSHIP_MATRIX.md`).
Full query string preserved unfiltered: source review of every `/app/**` page found no query
parameter that carries a credential, token, or secret (pagination/filter/display-state values
only, already re-derived and re-validated server-side wherever they matter).

### `/admin`, `/admin/**`

```
crawlpact.com/admin/**  → app.crawlpact.com/admin/**
```

Same treatment as `/app/**` — full path and query preserved, GET/HEAD only.

## Method safety

Every mapping above applies to GET/HEAD only. Any other method (`POST`, `PUT`, `PATCH`, `DELETE`,
...) reaching one of these apex paths is rejected outright (404) rather than redirected — the
Wrong-Host Policy never turns a mutation into a cross-origin request. Covered by
`worker.host-boundary.test.ts`'s `"rejects (404) a non-GET/HEAD request to a legacy app page..."`.

## Loop safety

Each redirect resolves in exactly one hop: the target is always the app host, and `worker.ts`'s
app-surface logic only ever redirects _away_ from the app host for `PUBLIC_ONLY` paths — every
`APP_ONLY` page this contract redirects to is, by definition, not `PUBLIC_ONLY`, so a follow-up
request to the redirect target is never redirected again. Proven directly in
`worker.host-boundary.test.ts`'s `"produces exactly one redirect hop..."` test, which issues the
real follow-up request against the constructed target and asserts it resolves (200), not another
redirect.

## Retirement check (Phase 4 directive §32)

Swept for stale comments/code asserting the Phase 2/3 compatibility window is still open:

- `worker.ts`'s host-boundary doc comment — rewritten to describe the current five-decision order
  (was three), with the compatibility-window paragraph updated to state it has ended.
- `route-ownership.ts`'s module doc comment — rewritten; previously stated "`crawlpact.com`
  continues to serve every `APP_ONLY` page/API during the Phase 2/3 migration-compatibility
  window by design," now describes the Phase 4 additions and points at `worker.ts` for the current
  behavior.
- `worker.host-boundary.test.ts`'s stale assertion (`"still serves /app and /sign-in on the public
host (Phase 2/3 migration-compatibility window — unchanged apex behavior)"`) — renamed and
  inverted to assert the new Phase 4 behavior, not silently deleted (test history/rationale
  preserved in the surrounding comment).
- `ORIGIN_AND_ROUTE_OWNERSHIP_MATRIX.md`'s historical LEGACY_REDIRECT table — a supersession note
  added above it (not rewritten) per the Phase 4 directive's explicit instruction to preserve
  historical evidence.

Not touched (explicitly out of scope, per the directive itself): `workers.dev` disposition,
Google's apex Authorized JavaScript Origin, and the BIC exception — all remain exactly as the
owner's 2026-09-11 authorization froze them.
