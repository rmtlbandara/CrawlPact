# Test and CI Baseline — 2026-08-03

Phase 0 baseline. All commands below were actually executed this session against HEAD
`0d23f5a4b589ade5e14e7070aadb8607357c7d46` on branch `phase-00-baseline-governance` (branched
directly from `main` at the same commit). No test code was modified. No failures were fixed.

## 1. Available commands (from `package.json`, verbatim)

| Purpose                | Command                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| Install                | (pnpm workspace install, implicit)                                                                    |
| Format check           | `pnpm format:check` (`prettier --check .`)                                                            |
| Lint                   | `pnpm lint` (`eslint . --max-warnings=0`)                                                             |
| Type check             | `pnpm typecheck` (`tsc --noEmit -p tsconfig.json && pnpm -r run typecheck`)                           |
| Unit tests             | `pnpm test:unit` (`vitest run --project unit`)                                                        |
| Integration tests      | `pnpm test:integration` (`vitest run --project integration`)                                          |
| Database validation    | `pnpm db:validate` (`node scripts/validate-db-schema.mjs`, via `packages/database`)                   |
| Registry validation    | `pnpm registry:validate` (`node scripts/registry-tools.mjs validate`)                                 |
| Registry checksum      | `pnpm registry:checksum`                                                                              |
| Registry changelog     | `pnpm registry:changelog`                                                                             |
| Secret scan            | `pnpm secrets:scan` (`bash scripts/secret-scan.sh`) — also run via `gitleaks-action` in CI            |
| Build                  | `pnpm build`                                                                                          |
| Combined quality gate  | `pnpm quality` = format:check + lint + typecheck + test:unit + test:integration + db:validate + build |
| E2E                    | `pnpm test:e2e` (all Playwright projects), `pnpm test:e2e:chromium` (Chromium only)                   |
| Accessibility          | `pnpm test:a11y`, `pnpm test:a11y:chromium`                                                           |
| Lighthouse             | `pnpm lighthouse:check`                                                                               |
| Env validation         | `pnpm env:validate[:local\|:preview\|:production]`                                                    |
| Preview smoke          | `pnpm smoke:preview`                                                                                  |
| Production smoke       | `pnpm smoke:production` (`scripts/smoke-test.ts production https://crawlpact.com`)                    |
| Deploy (manual, gated) | `pnpm deploy:preview`, `pnpm deploy:production`                                                       |
| Binding verification   | `pnpm deploy:verify-bindings`                                                                         |

Note: no dedicated `pnpm test:visual` script exists in the current `package.json` — the
pixel-comparison visual-regression suite was **removed entirely** per
`docs/architecture/adr/ADR-0008-remove-pixel-visual-regression.md` (persistent CI flakiness, cited
in KNOWN_RISKS.md). Any older document that still refers to `pnpm test:visual` as an active gate
is stale — logged in `DOCUMENTATION_CONFLICTS.md`.

## 2. Quality gate execution (this session, 2026-08-03)

**Command:** `pnpm run quality` · **Exit code:** `0` (pass end-to-end) · **Duration:** ≈45s
(15:50:54–15:51:43 local log timestamps, deploy/build stage included)

| Check              | Result                                                                                                                                                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `format:check`     | ✅ Pass — "All matched files use Prettier code style!"                                                                                                                                                           |
| `lint`             | ✅ Pass — 0 errors (max-warnings=0 gate)                                                                                                                                                                         |
| `typecheck`        | ✅ Pass — 330 files (`apps/web` `astro check`) — 0 errors, 0 warnings, 37 informational hints (all `z.*`/`FormEvent` deprecation hints, non-blocking); all 8 `packages/*` workspaces' `tsc --noEmit` also passed |
| `test:unit`        | ✅ Pass — **230/230** tests, 23 files, 654ms                                                                                                                                                                     |
| `test:integration` | ✅ Pass — **149/149** tests, 24 files, 18.27s (against real local D1)                                                                                                                                            |
| `db:validate`      | ✅ Pass — **"40 tables verified consistent between migrations and Drizzle schema"** (see note below on the 39-vs-40 discrepancy against the live production table count)                                         |
| `build`            | ✅ Pass — `astro build`, server + prerendered static output; 8 `packages/*` builds skipped ("None of the selected packages has a build script" — expected, not an error)                                         |

**No pre-existing failures found in this run.** Every check passed cleanly on the first attempt —
no flakes needed a rerun this session.

Discrepancy noted (not fixed): `db:validate`'s local schema-consistency check reports **40**
tables, while a live `sqlite_master` query against production `crawlpact-db` (see
`PRODUCTION_INFRASTRUCTURE_INVENTORY.md` §2.2) returns **39** real tables. Both counts are accurate
readings of what they each measure (one is local-schema-vs-migration consistency; the other is a
live production table enumeration) — the discrepancy itself, and its cause, was not investigated
further in this docs/inspection-only phase. Logged in `DOCUMENTATION_CONFLICTS.md`.

## 3. Not run this session (out of Phase 0's safe/authorized scope or requiring extra setup)

| Suite                                          | Status                          | Reason                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test:e2e` / `test:e2e:chromium`          | Not run this session            | Requires a running dev server, D1 migrate+seed, and Playwright browser install; per IMPLEMENTATION_STATUS.md's most recent quality-gate table (2026-07-26), e2e/a11y are re-run only when UI or behavior changes — Phase 0 makes no such change, so re-running was judged unnecessary for this docs-only baseline. CI's own `browser-smoke` job (see §4) provides the current real-CI evidence instead. |
| `pnpm test:a11y` / `test:a11y:chromium`        | Not run this session            | Same reasoning as above.                                                                                                                                                                                                                                                                                                                                                                                |
| `pnpm lighthouse:check`                        | Not run this session            | Same reasoning; no UI change occurred.                                                                                                                                                                                                                                                                                                                                                                  |
| `pnpm smoke:production`                        | Not run this session            | This session did not have a fresh reason to smoke-test production (no deploy occurred); public-route checks were instead done directly via `curl` (see `PRODUCTION_INFRASTRUCTURE_INVENTORY.md` §7), which covers the same surface at a lighter weight.                                                                                                                                                 |
| `pnpm audit --audit-level=critical`            | Not run standalone this session | Covered inside CI's `quality` job with `continue-on-error: true` (see §4) — cited from the workflow file rather than re-run locally.                                                                                                                                                                                                                                                                    |
| `pnpm registry:validate` / `registry:checksum` | Not run this session directly   | Delegated to the database/registry baseline research agent — see `CRAWLER_REGISTRY_BASELINE.md`.                                                                                                                                                                                                                                                                                                        |

None of the above are treated as failures — they are **not verified this session**, distinct from
a failing test.

## 4. CI/CD pipeline (`.github/workflows/`)

| Workflow                | Trigger                                                                                           | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`                | `pull_request`, `push` (main), `workflow_dispatch`                                                | Two required jobs run concurrently: `quality` (secret scan via gitleaks, format, lint, typecheck, unit+integration, db:validate, `pnpm audit --audit-level=critical` with `continue-on-error: true`, build) and `browser-smoke` (Chromium E2E + accessibility, against a real migrated+seeded local D1 and a real Astro dev server). A third job, `ci-gate`, aggregates both into one required check (`needs: [quality, browser-smoke]`, fails if either isn't an exact `success`). |
| `deploy-preview.yml`    | (not read in full this pass)                                                                      | Preview deployment                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `deploy-production.yml` | `workflow_dispatch` only, requires `commit_sha` + typed `"DEPLOY PRODUCTION"` confirmation string | No automatic path to production deployment exists — confirmed by direct file inspection.                                                                                                                                                                                                                                                                                                                                                                                            |
| `merge-when-green.yml`  | `workflow_run` (triggered by `CI` completing)                                                     | Owner-controlled substitute for GitHub's native auto-merge, since branch protection/rulesets 403 on this repository's current GitHub plan (private repo, Free plan — confirmed live via the API, see `PRODUCTION_INFRASTRUCTURE_INVENTORY.md` §8). Only merges same-repo, owner-authored PRs targeting `main` carrying an explicit `automerge` label, and only merges the exact SHA that CI tested.                                                                                 |

### 4.1 Latest real CI state (queried live via `gh` this session, 2026-08-03)

- Most recent `Merge when green` run: **success**, commit `0d23f5a4b589ade5e14e7070aadb8607357c7d46`
  (current HEAD), completed 2026-08-03T08:28:03Z.
- Most recent `CI` runs on dependency-update branches: two `success`
  (`dependabot/npm_and_yarn/lucide-react-1.28.0`, `dependabot/npm_and_yarn/astrojs/react-6.0.2`),
  one **`failure`** (`dependabot/npm_and_yarn/astrojs/cloudflare-14.1.7`) — an open Dependabot PR's
  CI is currently red. Not investigated or fixed this pass (out of Phase 0 scope); logged as a new
  P2 risk in `BASELINE_RISKS_AND_UNKNOWNS.md`.
- `main` branch: **no GitHub branch-protection rule configured** (`404 Branch not protected`,
  confirmed live) — a known, disclosed platform constraint (private repo on GitHub Free), not a
  newly discovered gap.

### 4.2 Tolerated failures / `continue-on-error` usage

Exactly one use of `continue-on-error: true` found in `ci.yml`: the `pnpm audit
--audit-level=critical` step in the `quality` job (line 105). Per the adjacent code comment
(reviewed 2026-07-29): 3 high advisories accepted, all in dev-only tooling
(sharp/libvips via wrangler's miniflare, brace-expansion via `@typescript-eslint`'s minimatch),
never in a production runtime dependency. This is a disclosed, reviewed acceptance, not a silent
gap — cross-referenced in `docs/status/KNOWN_RISKS.md`.

### 4.3 Deployment gates

- Preview: automated on some trigger (file not read in full this pass — recorded as
  **not verified — required access was unavailable** for full trigger detail beyond the filename).
- Production: **manual only**, `workflow_dispatch` + typed confirmation, per CLAUDE.md's
  non-negotiable "never deploy to production without explicit, in-the-moment permission" rule —
  this CI-level gate directly encodes that rule as a technical control, not just a written policy.

## 5. Verification limitations

- E2E, accessibility, Lighthouse, and production-smoke suites were not executed this session (see
  §3) — their most recent _actual_ results are the ones already recorded in
  `docs/status/IMPLEMENTATION_STATUS.md` (2026-07-26 pass: E2E 23 passed/7 skipped, a11y 27/27
  chromium + 24/25 mobile-safari with one known pre-existing WebKit limitation). Not re-verified
  this pass; cited, not re-claimed as current without re-running.
- `deploy-preview.yml`'s exact trigger/step detail was not read in full this pass.
- Cloudflare's own CodeQL/Dependabot/Renovate configuration state (beyond the two Dependabot PR CI
  results observed above) was not separately queried this pass.
