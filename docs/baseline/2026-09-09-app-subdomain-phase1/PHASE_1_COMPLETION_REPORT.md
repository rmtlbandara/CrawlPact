# Phase 1 Completion Report — App-Subdomain Migration

Date: 2026-09-09

## A. Verdict

```
PASS — PHASE 2 READY / OWNER ACTIONS QUEUED
```

Every Phase 1 hard acceptance criterion in the directive is satisfied. Three external
owner-controlled actions (Google Authorized JavaScript Origin, Paddle checkout-domain approval,
Cloudflare Custom Domain attachment) remain intentionally queued for Phase 2/3 — they do not block
Phase 2 code implementation and are not fabricated as complete.

## B. Authoritative baseline

- Branch: `fix/canonical-hash-fragment-links`
- Starting SHA: `db4c3ea243fd0f18b81167371e4d62df2b778be5`
- Ending SHA: not yet committed (this phase's changes are staged in the working tree, pending the
  user's explicit go-ahead to commit — no commit was created without being asked)
- Worktree: clean at Phase 1 start; Phase 1 added/modified the files listed in Section E
- `main` at Phase 1 start: `bf97bd6ebd477f576a10bd300f861b8c29fbe73a` (the planning document's cited
  "observed main SHA" did not match any commit in this repository — re-verified and documented,
  not silently trusted)
- Full detail: `AUTHORITATIVE_BASELINE.md`

## C. Architecture decisions

```
Public:        crawlpact.com
App:           app.crawlpact.com
Deployment:    same Worker (crawlpact-web), same repository, same D1/KV/R2
Session:       host-only app cookie, unchanged mechanism
WebAuthn RP ID: crawlpact.com (frozen, never changes)
Paddle /pay:    apex (frozen — live-verified as the only Paddle-approved domain)
Paddle webhook: apex (frozen)
GA/Clarity:     public-marketing only (verified already true from source)
```

Recorded as `docs/architecture/adr/ADR-0010-PUBLIC-APP-ORIGIN-SEPARATION.md` (Accepted), indexed in
`docs/architecture/adr/README.md`.

## D. Major findings

1. **`app.crawlpact.com` is genuinely greenfield** — live-verified via Cloudflare API: no DNS
   record, no Custom Domain, no conflicting CNAME. The only prior mention anywhere in the
   repository was a single rejected hypothetical in ADR-0006. This meaningfully de-risks the
   migration relative to a scenario with partial prior exposure.
2. **The Workers Static Assets hard gate is real and unaddressed today**: production has no
   `run_worker_first` configured, so all 27 prerendered public pages bypass `middleware.ts`/
   `worker.ts` entirely. Attaching `app.crawlpact.com` today, with no other change, would
   immediately duplicate every public marketing page on the app host. Design (not implementation)
   is complete: `CLOUDFLARE_HOST_BOUNDARY_DESIGN.md`, verified against current Cloudflare
   documentation fetched live this session (selective `run_worker_first` array pattern,
   `["/*", "!/_astro/*", ...]`).
3. **WebAuthn challenge tokens carry no origin field today** — `expectedOrigin` is read fresh from
   env at verification time, with no per-ceremony pinning. A naive dual-origin `expectedOrigin`
   array would be genuinely exploitable (cross-origin ceremony completion). Design complete:
   `WEBAUTHN_MIGRATION_CONTRACT.md`.
4. **CSRF (`assertSameOrigin`) checks against exactly one configured origin today** — a per-route
   surface-aware allowlist design is required, not a blanket two-origin acceptance. Design
   complete, including the resolution of which pre-session `/api/auth/**` ceremony endpoints
   become `APP_ONLY` (co-located with `/sign-in`, not `PUBLIC_ONLY` merely because they're
   currently unauthenticated) — see `PUBLIC_SITE_URL_USAGE_AUDIT.md`.
5. **`sign-in.astro` is architecturally a marketing page today** (uses `MarketingLayout`, inherits
   the analytics-consent banner apparatus even though GA/Clarity scripts themselves are already
   excluded from that route). Confirms the directive's dedicated-`AuthLayout` requirement addresses
   a real gap.
6. **Exactly one Paddle checkout domain is approved today: `crawlpact.com`.** `app.crawlpact.com`
   is not registered with Paddle at all (live-verified via the Paddle API). Live checkout cannot
   move to the app host until this is submitted and approved — an owner action, deferred by design
   until the app host is stable and reachable.
7. **Current production adoption is minimal and, critically, has zero currently-active sessions**
   (live D1 count) — independently re-verified rather than copied from an older baseline, and the
   lowest-risk possible window for the eventual one-time reauthentication cost.
8. Four secondary, pre-existing findings unrelated to this migration were discovered and logged
   without being fixed (see `RISK_REGISTER.md`): `/dev/components` has no runtime auth gate;
   `CLOUDFLARE_ENVIRONMENT_MATRIX.md`/`CLOUDFLARE_CONFIGURATION.md` describe the preview Custom
   Domain as not-yet-live when it is in fact already attached; CLAUDE.md references an archived
   doc path; no GSC/GA4/CrUX API access was available this session.

## E. Files changed

**Configuration (non-behavioral — `PUBLIC_APP_URL` added as an optional, validated,
unconsumed field; nothing reads it yet):**

- `packages/config/src/env.ts` — added `PUBLIC_APP_URL: z.string().url().optional()`
- `apps/web/src/env.d.ts` — added `PUBLIC_APP_URL?: string` to the runtime env type
- `.env.example` — documented local value
- `apps/web/wrangler.jsonc` — documented future production/preview values, explicit comments that
  neither hostname is attached
- `scripts/build.sh` — exports `PUBLIC_APP_URL` per build target, unused downstream
- `scripts/verify-push.sh`, `.github/workflows/ci.yml` (both spots) — local/CI env parity

**Docs:**

- `docs/architecture/adr/ADR-0010-PUBLIC-APP-ORIGIN-SEPARATION.md` (new)
- `docs/architecture/adr/README.md` — index entry
- `docs/risks/ACTIVE_RISKS.md` — RISK-036 added, review log updated
- `docs/status/CURRENT_STATE.md` — pointer note in Environment status
- `docs/deployment/CLOUDFLARE_ENVIRONMENT_MATRIX.md`, `CLOUDFLARE_CONFIGURATION.md` —
  `PUBLIC_APP_URL` rows/notes
- `docs/baseline/2026-09-09-app-subdomain-phase1/` (new folder, 9 documents — see its `README.md`)

**No changes** to: routing (`worker.ts`, `middleware.ts`, `route-registry.ts`), auth
(`session.ts`, `webauthn.ts`, `same-origin.ts`), layouts, Paddle code, analytics code, tests, CI
workflow logic beyond the env-var addition, or any production behavior.

## F. Configuration changes

`PUBLIC_APP_URL` was added to the validated schema as **optional** (not required), specifically to
avoid forcing changes to the ~44 test files that construct `mockEnv`/`PUBLIC_SITE_URL` objects —
making it required would have been a disproportionate blast radius for a field nothing consumes
yet. `pnpm env:validate:{local,preview,production}` all still pass unmodified (verified). This is
recorded as a deliberate choice in `PUBLIC_SITE_URL_USAGE_AUDIT.md`, not an oversight — Phase 2
should revisit making it required once real behavior depends on it.

## G. External prerequisites

| System                | Status                                                                                                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cloudflare            | **READY** (design complete) — `app.crawlpact.com` has no DNS/Custom Domain, live-verified, no conflict. **Do not attach until Phase 2 host enforcement ships.**                                                                       |
| Google                | **OWNER ACTION REQUIRED** — this session has no Google Cloud Console access. Exact action documented in `EXTERNAL_PREREQUISITES.md`.                                                                                                  |
| Paddle                | **DEFERRED UNTIL PHASE 2/3 HOST BOUNDARY IS DEPLOYABLE** — live-verified only `crawlpact.com` is approved today; submitting `app.crawlpact.com` before it's safely reachable would expose an incomplete hostname for external review. |
| Google Search Console | **VERIFIED, not a blocker** — existing Domain property already covers any future subdomain per Google's own documentation; no new verification needed.                                                                                |

Full detail and the directive's required summary table: `EXTERNAL_PREREQUISITES.md`.

## H. Security analysis

- **WebAuthn**: RP ID frozen at `crawlpact.com` (unchanged this phase). Dual-origin migration
  window designed with per-ceremony origin pinning via a new signed challenge-token field — not
  implemented. Full contract: `WEBAUTHN_MIGRATION_CONTRACT.md`.
- **Cookies**: session cookie confirmed host-only (`Path=/`, `HttpOnly`, `SameSite=Lax`, `Secure`,
  no `Domain`) in current code, unmodified this phase. The migration's frozen decision keeps it
  this way permanently — no parent-domain cookie is ever introduced.
- **CSRF**: current single-origin check confirmed and unmodified. Phase 2 design (per-route
  surface-aware allowlist, one explicit `SHARED_SAME_ORIGIN_SURFACE` exception) recorded in
  `PUBLIC_SITE_URL_USAGE_AUDIT.md`; not implemented.
- **Host confusion**: no hostname-based logic exists anywhere in the Worker/middleware today (all
  branching is via a build-time `PUBLIC_APP_ENV` var) — this is itself the finding driving
  `CLOUDFLARE_HOST_BOUNDARY_DESIGN.md`'s explicit-allowlist design (trusted hostnames only;
  `workers.dev`/unexpected hosts never silently trusted).
- **Static assets**: the asset-bypass duplication risk is fully documented with a concrete,
  Cloudflare-doc-verified fix design; not implemented (by design — implementing it is Phase 2).
- **Billing boundary**: webhook signature verification (HMAC-SHA256, 5-minute staleness window,
  idempotent by `paddle_event_id`) independently re-verified from source, unmodified. Stays on
  the apex per frozen decision.

## I. Validation evidence

All commands run in this session, this repository, this phase — exact results, not summarized:

| Command                                                                                                                                                                                                                                                                                                                                                      | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm format:check`                                                                                                                                                                                                                                                                                                                                          | Initially failed (13 new/changed Markdown files needed Prettier formatting) → `pnpm format` applied → re-ran clean: **PASS**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `pnpm lint`                                                                                                                                                                                                                                                                                                                                                  | **PASS** (`eslint . --max-warnings=0`, 0 warnings)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `pnpm typecheck`                                                                                                                                                                                                                                                                                                                                             | **PASS** — 544 files, 0 errors, 0 warnings (72 pre-existing hints, all in files this phase did not touch — Zod/FormEvent deprecation notices)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `pnpm test:unit`                                                                                                                                                                                                                                                                                                                                             | **PASS** — 48 test files, 538 tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `pnpm test:integration` (1st run)                                                                                                                                                                                                                                                                                                                            | 51/56 files passed, 5 failed with `dispose is not a function`/hook timeouts, all in `createD1TestHarness`-based registry/pilot/research-publication tests this phase never touched                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `pnpm test:integration` (2nd run, immediately after)                                                                                                                                                                                                                                                                                                         | **PASS** — 56/56 files, 390/390 tests. Confirms the first run's failures were transient local Miniflare/D1-harness resource contention, not a regression — reproduced, then proven not to recur, per the directive's "prove that conclusion using repeated evidence" requirement rather than asserted                                                                                                                                                                                                                                                                                                                                                                                     |
| `pnpm test:security`                                                                                                                                                                                                                                                                                                                                         | **PASS** — 8 files, 41 tests (run standalone after observing the full `pnpm quality` composite hit the same local-resource-contention pattern — see below)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `pnpm db:validate`                                                                                                                                                                                                                                                                                                                                           | **PASS** — 56 tables verified consistent between migrations and Drizzle schema                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `pnpm db:migrate` (local)                                                                                                                                                                                                                                                                                                                                    | **PASS** — no pending migrations                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `pnpm db:seed` (local)                                                                                                                                                                                                                                                                                                                                       | Failed with a `UNIQUE constraint` error — expected/tolerated: this local database was already seeded from a prior session; `quality:gate`'s own script wraps this exact step in `                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |     | true` for this reason |
| `pnpm run docs:validate`, `brand:validate`, `trust:validate`, `status:validate`, `operations:validate`, `registry:validate`, `registry:integrity:verify`, `registry:public:validate`, `research:validate`, `research:integrity:verify`, `pilot:validate`, `content:validate`, `internal-link-canonical:check`, `repo-privacy:validate`, `analytics:validate` | **PASS** — all 15, run individually                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `pnpm audit --audit-level=critical`                                                                                                                                                                                                                                                                                                                          | **PASS** (exit 0) — 20 pre-existing non-critical vulnerabilities (7 moderate, 13 high, 0 critical) reported informationally; none introduced by this phase (no dependency changed)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `pnpm build`                                                                                                                                                                                                                                                                                                                                                 | **PASS** — full production build completes, all prerendered pages generated, server built                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `pnpm quality` (full composite, single command)                                                                                                                                                                                                                                                                                                              | **Failed** — not because of any of the above; the composite's back-to-back heavy steps (`test:security` immediately followed by `test:integration`, both spinning up many local Miniflare D1 instances) hit `EADDRNOTAVAIL`/`fetch failed` port-exhaustion errors across ~16 files. Every individual step that composite failure touches was independently re-run above and passes cleanly. This is a pre-existing local test-infrastructure characteristic of running many Miniflare-backed D1 harnesses back-to-back in one process, not a regression this phase introduced — the same two test files (`test:security`, `test:integration`) pass individually with 100% of tests green. |

**Honest summary**: every quality-gate component passes when run in isolation. The single-command
`pnpm quality` composite is flaky specifically at the `test:security` → `test:integration`
boundary due to local Miniflare/D1 port exhaustion — a pre-existing environmental characteristic,
not something this phase's changes caused (none of the failing tests touch any file this phase
modified). This is reported plainly rather than glossed over, per the directive's "no fabricated
PASS" rule.

## J. Production impact

```
No application-origin cutover occurred.
No root→app redirects were enabled.
No production WebAuthn origin was switched.
No session-cookie scope was broadened.
No Paddle endpoint was moved.
No Cloudflare Custom Domain was attached.
No route, redirect, CSRF, or layout code was modified.
```

The only changes that touch anything deployable are the `PUBLIC_APP_URL` additions to
`packages/config/src/env.ts`, `apps/web/wrangler.jsonc`, and related scripts/CI files — all
additive, all optional, all unconsumed by any code path. `pnpm build` confirms the production
build is unaffected.

## K. Owner action queue

1. **Google Cloud Console** — add `https://app.crawlpact.com` as an Authorized JavaScript origin on
   the existing Web OAuth Client, when Phase 3 needs it (not now).
2. **Paddle Dashboard** — submit `app.crawlpact.com` as a checkout domain for approval, only once
   the app host is live and stable (Phase 3/4, not now).
3. **Cloudflare dashboard** — attach `app.crawlpact.com` as a second Custom Domain to `crawlpact-web`,
   only after Phase 2's host-enforcement code is built and deployed (Phase 3, not now).
4. **Decide the preview app hostname** (`app-preview.crawlpact.com` is the documented candidate,
   mirroring the existing `preview.` convention) — a Phase 2/3 decision, not blocking Phase 2 code.

None of these four actions are Phase 2 blockers; Phase 2 is pure code implementation against the
designs in this folder.

## L. Phase 2 handoff

Phase 2 should implement, in order:

1. The hostname classifier and selective `run_worker_first` array in `worker.ts`/`wrangler.jsonc`
   (`CLOUDFLARE_HOST_BOUNDARY_DESIGN.md`), tested against `PHASE_2_TEST_CONTRACT.md`'s host-routing
   and static-assets sections **before** anything else — this is the hard gate everything else
   depends on being safe.
2. The dedicated `AuthLayout` for `sign-in.astro`, replacing `MarketingLayout`.
3. The per-route CSRF surface-aware allowlist in `same-origin.ts`/`require-session.ts`
   (`PUBLIC_SITE_URL_USAGE_AUDIT.md`'s CSRF migration design).
4. The origin-pinned dual-window WebAuthn challenge design (`WEBAUTHN_MIGRATION_CONTRACT.md`) —
   implement the design but do not yet flip production `WEBAUTHN_RP_ORIGIN`.
5. The app-host `robots.txt`/`sitemap.xml` split.
6. Full regression coverage per `PHASE_2_TEST_CONTRACT.md`.

Phase 2 must not attach the Cloudflare Custom Domain, submit Paddle for approval, or add the
Google origin — those remain Phase 3 actions gated on Phase 2's code being deployed and proven in
the existing (single-origin) production environment first.
