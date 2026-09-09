# Phase 1 — App-Subdomain Migration: Baseline, Architecture Contract & External Prerequisites

Evidence package for Phase 1 of the `crawlpact.com` / `app.crawlpact.com` origin-separation
migration (ADR-0010). See `PHASE_1_COMPLETION_REPORT.md` for the full narrative and verdict.

Phase 1 is investigation, architectural governance, and non-behavioral configuration prep only.
**No production behavior changed.** `app.crawlpact.com` has no DNS record and no Cloudflare Custom
Domain — it does not exist in production. No route, redirect, CSRF, session, or WebAuthn logic was
modified.

## Documents in this folder

| Document                               | Content                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `AUTHORITATIVE_BASELINE.md`            | Git/runtime/Cloudflare/Paddle/D1 baseline, all live-verified 2026-09-09                                      |
| `ORIGIN_AND_ROUTE_OWNERSHIP_MATRIX.md` | Every page/API route classified by final hostname owner — zero `UNRESOLVED`                                  |
| `PUBLIC_SITE_URL_USAGE_AUDIT.md`       | Every `PUBLIC_SITE_URL`/hardcoded-domain usage classified, plus the CSRF migration design                    |
| `CLOUDFLARE_HOST_BOUNDARY_DESIGN.md`   | The hard-gate design proving no public/app content duplication is possible before any Custom Domain attaches |
| `WEBAUTHN_MIGRATION_CONTRACT.md`       | Origin-pinned dual-window WebAuthn design; RP ID stays `crawlpact.com`                                       |
| `EXTERNAL_PREREQUISITES.md`            | Live-verified Cloudflare/Google/Paddle/GSC prerequisite status — no fabricated completions                   |
| `PHASE_2_TEST_CONTRACT.md`             | The test matrix Phase 2 must satisfy                                                                         |
| `RISK_REGISTER.md`                     | Points to `docs/risks/ACTIVE_RISKS.md` RISK-036 plus four secondary findings                                 |
| `PHASE_1_COMPLETION_REPORT.md`         | Full completion report and Phase 2 readiness verdict                                                         |

Companion changes outside this folder: `docs/architecture/adr/ADR-0010-PUBLIC-APP-ORIGIN-SEPARATION.md`
(and its `README.md` index entry), `docs/risks/ACTIVE_RISKS.md` (RISK-036), `docs/status/CURRENT_STATE.md`
(pointer note), `docs/deployment/CLOUDFLARE_ENVIRONMENT_MATRIX.md` and `CLOUDFLARE_CONFIGURATION.md`
(new `PUBLIC_APP_URL` rows/notes), and the non-behavioral `PUBLIC_APP_URL` config addition across
`packages/config/src/env.ts`, `apps/web/src/env.d.ts`, `.env.example`, `apps/web/wrangler.jsonc`,
`scripts/build.sh`, `scripts/verify-push.sh`, and `.github/workflows/ci.yml`.
