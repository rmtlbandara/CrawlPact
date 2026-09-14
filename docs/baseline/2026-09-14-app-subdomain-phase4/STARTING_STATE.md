# Phase 4 — Starting State

Status 2026-09-14. Baseline independently reconstructed at the start of this pass, not assumed
from the Phase 4 directive's own claimed starting point.

## Baseline commit

```
main = ce953a480b2cc5488cf808409d31b670ba1363fc
```

Confirmed live via `git rev-parse main` before any Phase 4 edit — matches the directive's stated
baseline exactly.

## What was independently re-read before implementation (SOURCE INSPECTION)

- `docs/architecture/adr/ADR-0010-PUBLIC-APP-ORIGIN-SEPARATION.md`
- `docs/baseline/2026-09-09-app-subdomain-phase1/ORIGIN_AND_ROUTE_OWNERSHIP_MATRIX.md`
- `apps/web/src/worker.ts` (the full current host-boundary implementation)
- `apps/web/src/lib/origin.ts`, `route-ownership.ts`, `route-registry.ts`
- `apps/web/src/lib/auth/same-origin.ts`, `webauthn.ts`, `safe-redirect.ts`
- `apps/web/src/pages/sign-in.astro`, `app-shell.astro`
- `apps/web/src/middleware.ts`
- Every file under `apps/web/src/pages/api/**` (directory listing, not assumed from the Phase 1
  matrix) — 13 top-level API families, individually enumerated; see `FINAL_ROUTE_OWNERSHIP_MATRIX.md`.
- `apps/web/src/pages/api/AGENTS.md`, `api/auth/AGENTS.md`, `api/billing/AGENTS.md` (specialized
  area rules for auth/billing routes this pass's Worker-level boundary check affects).
- `apps/web/src/worker.host-boundary.test.ts`, `route-ownership.test.ts`, `origin.test.ts` (existing
  test conventions, and the exact pre-Phase-4 assertions this pass needed to correct rather than
  silently break).

## Confirmed still true (not re-assumed)

- **Production**: deployment `689a7055-8be7-4abf-8d6d-a49d40f68681`, Worker version
  `886fb70e-d760-4f3b-87b1-4a71820074ff`, commit `f1d817e` — observability enabled and verified
  (see `docs/baseline/2026-09-11-app-subdomain-final-pre-phase4/OBSERVABILITY_READINESS.md`'s
  Step 4). Confirmed via a fresh Cloudflare API read, 2026-09-14, before this pass began.
- **Preview**: `app.preview.crawlpact.com` remains unattached as a real Cloudflare Custom Domain —
  a fact established earlier in this migration and re-confirmed, not re-derived, here. This is why
  this pass's E2E coverage cannot prove real cross-origin navigation on Preview (see
  `ENTRY_POINT_INVENTORY.md`'s testing-strategy note).
- **Pre-Phase-4 readiness verdict**: `PASS — PHASE 4 READY`
  (`docs/baseline/2026-09-10-app-subdomain-phases1-3-closure/PHASE_4_READINESS_REPORT.md`).

## Scope of this pass

This pass implements and locally/CI-validates the **Stage A route-cutover candidate** — the
symmetric apex↔app host-boundary enforcement, the two-stage (307→308) legacy redirect mechanism
at its Stage A (307) setting, and the first-party entry-point migration. It does **not** deploy
anything to Preview or Production, and does not perform Stage B (permanentization) or Stage C
(WebAuthn origin finalization) — those require a real, owner-approved Production deployment and
health-gate window this pass cannot itself perform or fabricate evidence for. See
`PHASE_4_STAGE_A_STATUS.md` for the explicit gate-by-gate accounting.
