# Phase 12 — Security, CI, Dependency and Quality-Gate Improvements — Completion Report

**Date**: 2026-08-09 · **Branch**: `phase-12-security-ci-quality-hardening`

## Summary

This phase hardened CI/CD supply-chain integrity, closed real dependency and preview-deployment
gaps found (not assumed) during evidence-first re-investigation, built a new privacy-minimized
cross-request abuse-detection feature, and reconciled several risk-register entries against
current reality — two of which (RISK-012, RISK-027) turned out to already be correct or already
fixed, and one (RISK-014) turned out to be diagnosed wrong at the root-cause level. No monitoring
cadence, pricing, or crawler-classification behavior was touched. No third-party notification
service was introduced. The Paddle webhook secret rotation (RISK-002) was deliberately **not**
attempted in this pass — it requires a separate, explicit live-operation authorization per its own
acceptance criteria, and is not bundled into this PR's scope.

## What shipped

### CI/CD supply-chain hardening

- Every third-party GitHub Action across all 4 workflows SHA-pinned (was: mutable tags).
- `ci.yml` gained a workflow-level `permissions: { contents: read }` default (two jobs previously
  had none).
- `merge-when-green.yml`'s PR-title interpolation into a `run:` shell command fixed (now passed via
  `env:`) — a real script-injection shape, though not externally exploitable as found (gated behind
  an owner-authored-PR check).
- Dependency-vulnerability gate (`pnpm audit --audit-level=critical`) made actually blocking —
  `continue-on-error: true` removed. 0 critical / 8 high / 4 moderate advisories currently, all
  confirmed dev-only tooling. See `docs/security/DEPENDENCY_VULNERABILITY_POLICY.md`.
- `content:validate` and the new `test:security` suite added to CI's `quality` job — both were
  previously either never run in CI at all (`content:validate`) or didn't exist.
- See `docs/security/CI_CD_SUPPLY_CHAIN_HARDENING.md` for full detail.

### Dependency fixes

- Wrangler bumped `4.114.0` → `4.120.0`; `@cloudflare/workers-types` aligned to `5.20260809.1`
  across every workspace package (was split across two versions, which produced a real,
  reproduced structurally-incompatible `drizzle-orm` install and 1,247 typecheck errors before the
  alignment fix). Full quality gate re-verified clean on the new versions.
- This directly fixes **RISK-026** (the open Dependabot `@astrojs/cloudflare` PR's CI failure) at
  its root cause: the newer package's transitive `@cloudflare/vite-plugin` requires Wrangler
  `^4.118.0`, which the repo was below. Verification of PR #65 itself is pending this branch's
  merge to `main` (Dependabot will need to rebase against the new Wrangler pin).

### New feature: cross-request target-frequency abuse monitoring (RISK-022)

- New table `target_abuse_observations` (migration `0031`), detection-only, storing two opaque
  HMAC digests per row — never a raw IP or raw target domain. Target hashing uses a **new,
  dedicated** `ABUSE_MONITORING_SECRET`, never `SESSION_SIGNING_SECRET`.
- Surfaced via a new `abuseMonitoring` block in the Super Admin operational capacity snapshot
  (`GET /api/admin/capacity`) — a count only, never raw values.
- 8 new integration tests. Full design: `docs/security/TARGET_ABUSE_MONITORING_DESIGN.md`.

### Real, previously-undiagnosed bugs found and fixed

- **RISK-014** (preview deploy failures): the documented root cause ("GitHub secret naming
  mismatch") was wrong. The real cause, found via `gh run view --log-failed` on the actual failing
  run: the live preview Worker was missing two `secret_text` bindings
  (`PADDLE_API_KEY`/`PADDLE_WEBHOOK_SECRET`), confirmed failing on **every** `deploy-preview.yml`
  run since at least 2026-08-04 (20/20 checked). Fixed by setting clearly-labeled placeholder
  values (billing is disabled on preview, so these are never used for a real Paddle call),
  matching the pattern already used for every other Paddle preview value. Verification of the
  actual next `deploy-preview.yml` run is pending (only triggers post-merge).
- **RISK-012** (billing webhook race-test flake): already fixed on 2026-08-04, per
  `docs/status/BILLING_WEBHOOK_RACE_TEST_FLAKE.md`'s own "Applied fix" section — `ACTIVE_RISKS.md`
  simply hadn't been updated to match. Re-ran the exact test 3× in isolation, all 3 passed cleanly.
  Moved to `RISK_ARCHIVE.md` as ARC-029.
- **RISK-027** (branch protection): a mistaken read during this phase's own investigation briefly
  showed the repo as `public` (leading to an accidental live branch-protection API write on
  `main`). A follow-up read confirmed the repo is genuinely **private**, and
  `GET .../branches/main/protection` correctly `403`s. Re-confirmed unchanged, not closed — the
  user has instructed this repo always be treated as private going forward regardless of any
  future API read.

### RISK-003 (Cloudflare zone-settings visibility) — re-confirmed, new finding

Re-tested with this session's broader Cloudflare MCP credential: the same zone-level settings
(SSL mode, HSTS, DNSSEC, page rules, rate limits) remain unreadable (401/403) — not a
credential-specific limitation. New finding: the zone has a **custom firewall ruleset**
(`http_request_firewall_custom`, v18) beyond the Free-plan managed defaults, whose contents are
still not readable via this credential — the prior "no custom WAF rules" claim can no longer be
fully confirmed and needs manual dashboard verification.

### RISK-023 (CSP `unsafe-inline`) — investigated, deliberately not implemented

Full investigation, not a shortcut: the installed Astro version has no built-in CSP nonce/hash
support, and genuinely inline `<script>` content (Google Analytics config, JSON-LD) exists even on
fully prerendered, edge-cached marketing pages, where a per-request nonce is architecturally
inapplicable (no per-request code path exists for static assets). A correct fix requires a
hash-based CSP build step — a separate, non-trivial initiative, not safely attempted inside this
already-large phase. Full reasoning: `docs/risks/ACTIVE_RISKS.md` RISK-023.

### RISK-015 (built-server E2E) — de-risked, not closed

The documented next step (Wrangler 4.115.0+) is done, along with a second, newly-discovered
version floor (4.118.0+, the same root cause as RISK-026). The actual CI-gate swap itself was
deliberately not re-attempted: its own acceptance criteria requires 3 consecutive **real CI**
passes (both prior attempts only ever failed in real CI, never locally), which can't be satisfied
inside one session without risking the CI gate this entire phase's own PR depends on.

### Canonical quality gate

- New `pnpm test:security` (curated allowlist, 8 files / 41 tests) —
  `docs/security/SECURITY_TEST_SUITE.md`.
- New `pnpm quality:gate`, now the canonical definition `pnpm quality`/`pnpm release:check` alias
  to — closes a real, confirmed gap where neither the local `quality` script nor
  `scripts/verify-push.sh` ran `docs:validate`/`brand:validate`/`trust:validate`/`status:validate`
  at all, even though CI's `quality` job did. `content:validate` had never run anywhere in CI.
- `scripts/verify-push.sh` updated to match.

### Public-exposure audit (end of phase)

Checked for CrawlPact content publicly exposed anywhere outside the private repo: 0 forks, GitHub
Pages disabled (404), all 6 repos under the account are private, 0 gists, and no `@crawlpact/*`
package published to the public npm registry. Nothing found.

## What was deliberately NOT done this phase

- **RISK-002** (Paddle webhook secret rotation) — requires separate, explicit live-operation
  authorization; not bundled into this PR.
- **RISK-023** (CSP nonces) — investigated, found to require a separate hash-based-CSP initiative;
  see above.
- **RISK-015**'s actual CI-gate swap — de-risked, not attempted; needs its own dedicated
  3-consecutive-real-CI-run verification cycle.
- No monitoring cadence, pricing, or crawler-classification change of any kind.
- No third-party notification/analytics service introduced.

## Test evidence

- `pnpm run quality:gate`: **exit 0** (format, lint, typecheck, unit — 376 tests, integration — 259
  tests, security — 41 tests, db:validate — 48 tables, docs/brand/trust/status/content validation,
  dependency audit, build).
- `pnpm test:e2e:chromium`: 132/133 passed, 1 flaky (known WebAuthn-ceremony timeout pattern,
  unrelated to this phase's changes).
- `pnpm test:a11y:chromium`: 109/109 passed.
- `pnpm db:validate`: 48 tables verified consistent (was 47 — one new table, `target_abuse_observations`).

## Risk register status (all 10 named risks)

| Risk     | Status before             | Status after                                        | Note                                                          |
| -------- | ------------------------- | --------------------------------------------------- | ------------------------------------------------------------- |
| RISK-002 | open                      | open (unchanged)                                    | Requires separate live-operation authorization                |
| RISK-003 | accepted                  | accepted (re-confirmed, new finding)                | Custom firewall ruleset contents still unreadable             |
| RISK-012 | open (stale)              | **closed** (ARC-029)                                | Already fixed 2026-08-04; docs caught up                      |
| RISK-013 | accepted                  | accepted (re-confirmed)                             | Real upstream WebKit limitation, no fix available             |
| RISK-014 | blocked (wrong diagnosis) | mitigating (fixed, verification pending)            | Real root cause found and fixed                               |
| RISK-015 | open                      | open (de-risked)                                    | Version blocker cleared; CI-gate swap itself deferred         |
| RISK-022 | monitoring                | **mitigating (fixed)**                              | New detection feature built and tested                        |
| RISK-023 | accepted                  | accepted (investigated)                             | Real architectural blockers found, documented                 |
| RISK-026 | open                      | open (root cause fixed, verification pending merge) | Wrangler bump should fix Dependabot PR #65                    |
| RISK-027 | accepted                  | accepted (re-confirmed)                             | Repo confirmed private; always treat as private going forward |

## Next steps

1. Push branch, open PR, merge (pending explicit confirmation).
2. After merge: verify `deploy-preview.yml` succeeds (RISK-014), verify Dependabot PR #65's CI now
   passes after rebase (RISK-026).
3. Deploy to production (pending explicit confirmation), including setting `ABUSE_MONITORING_SECRET`
   live on the production Worker before the deploy's binding-verification step runs.
4. Separately, explicitly: decide whether to proceed with the Paddle webhook secret rotation
   (RISK-002) as its own live-operation-authorized step.
