# Release Checklist

Operational pre-release gate — not to be confused with `docs/release/PRODUCTION_READINESS_CHECKLIST.md`
(SRS §36's 46 launch criteria, a product-completeness audit). This one is "is it safe to ship right
now," re-run before every production deploy via `deploy-production.yml`'s `pnpm release:check`
step.

**2026-07-29 update:** the pixel visual-regression suite referenced in the "Current results" table
below was removed (see `docs/architecture/adr/ADR-0008-remove-pixel-visual-regression.md`) — it
was never actually stabilized past the "known gap" state recorded here, and chasing it further
past a second failed readiness-signal fix wasn't a good use of time. It is no longer part of
`release:check` or any release gate; the table below is kept as a historical record of the
2026-07-27 pass, not a current status.

## Current results (2026-07-27, branch `chore/release-pipeline-hardening`, local run)

| Check                  | Command                                                     | Result                                                                                                           |
| ---------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Format                 | `pnpm format:check`                                         | ✅ Pass                                                                                                          |
| Lint                   | `pnpm lint`                                                 | ✅ Pass — 0 errors, 0 warnings                                                                                   |
| Typecheck              | `pnpm typecheck` (root `scripts/` + all workspace packages) | ✅ Pass — 0 errors                                                                                               |
| Unit tests             | `pnpm test:unit`                                            | ✅ Pass — 202/202, 19 files                                                                                      |
| Integration tests      | `pnpm test:integration`                                     | ✅ Pass — 137/137, 22 files, against real D1                                                                     |
| Migration/schema drift | `pnpm db:validate`                                          | ✅ Pass — 38 tables verified consistent                                                                          |
| Build                  | `pnpm build`                                                | ✅ Pass                                                                                                          |
| Secret scan            | `pnpm secrets:scan`                                         | ✅ Pass — no known secret patterns in tracked files                                                              |
| Dependency audit       | `pnpm audit --audit-level=critical`                         | ⚠️ 3 high, all reviewed dev-only tooling advisories — see `docs/status/KNOWN_RISKS.md`                           |
| E2E / accessibility    | `pnpm test:e2e` / `pnpm test:a11y`                          | Not run in this pass (requires a running dev server + Playwright browsers; exercised by CI's `e2e-and-a11y` job) |
| Visual regression      | `pnpm test:visual`                                          | Not run — not yet CI-wired, known gap, see `docs/status/KNOWN_RISKS.md`                                          |

This is the first time `pnpm quality`'s constituent checks have been verifiably green together —
CI itself had been failing on every push since `gitleaks-action` was introduced (see
`docs/status/KNOWN_RISKS.md`), so no prior commit's "quality gate passed" claim was ever actually
confirmed by CI.

## Pre-deploy checklist

- [ ] `pnpm release:check` passes (this is what `deploy-production.yml` re-runs automatically)
- [ ] `pnpm env:validate:<target>` passes for the target environment
- [ ] No `.dev.vars` file present in the checkout doing the build (enforced by `scripts/build.sh`)
- [ ] Pending D1 migrations reviewed (`packages/database/migrations/`, forward-only, hand-authored)
- [ ] Preview deploy (if this change went through one) was smoke-tested and looked right
- [ ] Rollback target identified — see `docs/release/ROLLBACK_RUNBOOK.md`

## Post-deploy checklist

- [ ] `pnpm deploy:verify-bindings <target>` passes
- [ ] `pnpm smoke:<target>` passes
- [ ] Worker version ID and commit SHA recorded (automatic in the GitHub Actions job summary)
