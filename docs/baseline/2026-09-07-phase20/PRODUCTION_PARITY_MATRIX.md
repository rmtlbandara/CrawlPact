---
Document owner: Engineering owner
Status: current-authoritative
Date: 2026-09-07
---

# Production parity matrix (Phase 20 evidence freeze)

All entries below were captured fresh during this phase (2026-09-07), either from direct
production checks, a live read-only Cloudflare API/D1 query, or `git`. None are copied from
prior documentation without independent re-verification.

## Git

| Field                                      | Value                                                                                                                                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch                                     | `main`                                                                                                                                                                 |
| Working tree                               | Clean (`git status` — nothing to commit before this phase's changes)                                                                                                   |
| `main` HEAD (start of this phase)          | `0698829389d39ab4a91bf6fc0a578a5b88f9a38a`                                                                                                                             |
| `origin/main`                              | Identical to local HEAD — no divergence                                                                                                                                |
| Last **application-code-affecting** commit | `72a8630` — "fix(auth): correct Google Sign-In cross-site POST defect (ADR-0009)", 2026-09-07 15:45:37 +0530 (10:15:37 UTC)                                            |
| Commits since `72a8630`                    | `cfb3f3b`, `0698829` — both **docs-only** (confirmed: `git diff --stat 72a8630..0698829` touches only `CHANGELOG.md` and 4 files under `docs/`, zero application code) |

**Verdict: no application-code drift between the last deployed commit and current `main`.**

## Production deployment (live, via `wrangler deployments list` against the real Cloudflare account)

| Field                        | Value                                                                                                                                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Worker                       | `crawlpact-web`                                                                                                                                                                                       |
| Latest deployment timestamp  | 2026-09-07T11:04:51.100Z                                                                                                                                                                              |
| Latest deployment version ID | `4f775d19-7654-4af5-ab2e-b43cfb705e54`                                                                                                                                                                |
| Deployment immediately prior | 2026-09-07T09:26:13.666Z, version `acddbd04-2a9e-4509-8f98-68c02fe53ca2`                                                                                                                              |
| Deployment before that       | 2026-08-18T04:06:57.910Z, version `9efd4c33-9b64-4959-94f8-2f79a7d50294` — this is the version `docs/status/CURRENT_STATE.md`'s header still cited as current before this phase; **confirmed stale**. |

The 11:04:51Z deployment lands ~49 minutes after `72a8630`'s commit time (10:15:37 UTC) — consistent
with a normal CI build-and-deploy cycle, and is the last deployment on record. No deployment has
happened since, and none was needed (this phase's changes are covered by the
`READY_FOR_PRODUCTION_DEPLOYMENT` gate below).

Note: this account also has a Cloudflare "Workers Builds" GitHub-integration history
(`workers_builds_list_builds`) with entries as old as July 2026 — that integration is unrelated to
this repo's actual deploy path (`deploy-production.yml`/`deploy-preview.yml`, which run
`wrangler deploy` from GitHub Actions using repo secrets) and its most recent entries predate the
`wrangler deployments list` evidence above by weeks. It was not used as evidence here to avoid
citing a stale/parallel signal as if it were the authoritative deployment record.

## Database (live, read-only D1 query against production, `crawlpact-db`)

| Field                      | Value                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Applied migrations         | **38 / 38** (`SELECT COUNT(*) FROM d1_migrations` → 38)                                                             |
| Latest applied migration   | `0038_google_oauth.sql` (`SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 5` confirms this is the newest row) |
| Repository migration count | 38 files in `packages/database/migrations/` (`0001`–`0038`)                                                         |

**Verdict: production's applied-migration count and latest migration exactly match the repository.
No pending migration.** This also confirms `docs/status/CURRENT_STATE.md`'s previous claim of
migration `0037` as current was stale — `0038_google_oauth.sql` (added for the September 7 Google
Sign-In work) is applied and current.

## Google Sign-In (September 7 work, ADR-0009) — verified-live vs. automated-test-verified

Per `git log` and the existing ADR-0009 record: the corrected callback architecture (`72a8630`) was
deployed to preview and production, and the product owner performed real Google sign-in and
sign-up on both environments, independently confirmed via a direct D1 query
(`0698829`'s own commit). This phase did not repeat those real-account actions — no fresh evidence
suggested a regression, and Section 37 of the Phase 20 prompt explicitly says not to perform risky
real-account actions "merely for Phase 20 completeness" when automated coverage and a prior
real-account confirmation already exist. Account linking/disconnect/admin-isolation remain
**automated-test-verified**, not **verified-live** — this phase does not claim otherwise.

## Preview environment

| Field                            | Value (live, 2026-09-07)                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------ |
| `https://preview.crawlpact.com/` | Real, fully-rendered `200` — Custom Domain live                                                  |
| Before this phase                | Not search-isolated at all (see `PREVIEW_SEARCH_ISOLATION.md`) — **P0 defect, fixed this phase** |
| D1 database                      | `crawlpact-db-preview` (distinct UUID from production, confirmed via `d1_databases_list`)        |

## Host/protocol canonicalization (live, 2026-09-07)

| Check                        | Result                           |
| ---------------------------- | -------------------------------- |
| `http://crawlpact.com/`      | `301` → `https://crawlpact.com/` |
| `https://www.crawlpact.com/` | `301` → `https://crawlpact.com/` |
| `https://crawlpact.com/`     | `200`                            |

Matches existing documentation's claim that these redirects are implemented and one-hop — no
change needed. (`docs/status/KNOWN_RISKS.md` separately notes the underlying Cloudflare Redirect
Rule, `id 74b608d7e6b844cb80ab08fe41c9ff8b`, phase `http_request_dynamic_redirect`, exists but its
rule detail isn't readable with the currently-scoped API credential — unrelated to this phase's
scope, not re-investigated here.)

## Database/config changes made by this phase

**None.** No migration was added or needed — every fix in this phase (canonical redirects, sitemap
content, robots.txt, preview isolation) is application code and static configuration
(`wrangler.jsonc`, `public/_redirects`), never schema.

## Quality gate (run locally this phase, exact results)

| Command                                                                       | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm format:check`                                                           | Failed once (5 new files unformatted) → `pnpm format` → clean                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `pnpm lint`                                                                   | Pass (`eslint . --max-warnings=0`)                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `pnpm typecheck`                                                              | Pass, 0 errors (10/11 workspace projects; pre-existing Zod-deprecation hints unrelated to this phase)                                                                                                                                                                                                                                                                                                                                                                          |
| `pnpm test:unit`                                                              | Pass — 525/525 (47 files)                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `pnpm test:integration`                                                       | **Could not run to completion in this execution environment** — Miniflare/D1 test harness fails to bind a local socket (`Can't assign requested address`) inside this sandbox, a pre-existing constraint unrelated to this phase's changes (its harness spins up its own inline Worker script and never reads `wrangler.jsonc`). 35/56 suites not requiring the D1 harness passed; the 21 that need it failed identically before and would fail on any change in this sandbox. |
| `pnpm db:validate`                                                            | Pass — 56 tables verified consistent                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `pnpm build`                                                                  | Pass — 0 build errors, 24 `_redirects` rules parsed, no route conflicts from the `robots.txt.ts` conversion                                                                                                                                                                                                                                                                                                                                                                    |
| `wrangler dev --local` (real workerd runtime, production-target build)        | Verified live: `/about`, `/pricing`, `/crawlers/amazonbot`, `/for/agencies` all `301` to their trailing-slash form; `/about/` `200`; robots.txt correct                                                                                                                                                                                                                                                                                                                        |
| `wrangler dev --local` (real workerd runtime, `CLOUDFLARE_ENV=preview` build) | Confirmed the `run_worker_first`/`_redirects` interaction described in `CANONICAL_URL_CONTRACT.md`; full preview-branch (`PUBLIC_APP_ENV === "preview"`) runtime behavior could not be observed locally because this machine's `.dev.vars` unconditionally forces `PUBLIC_APP_ENV=local` in any local `wrangler dev` session — a deliberate, pre-existing safety mechanism this phase correctly did not bypass                                                                 |

## Deployment status

**`READY_FOR_PRODUCTION_DEPLOYMENT`** — not deployed by this phase. CrawlPact's repository rules
(`CLAUDE.md`) and this session's own operating rules require the user's explicit, in-the-moment
permission before any deploy, regardless of prior authorization. This phase implemented, tested,
and locally verified the change set; it did not ask for or receive deploy authorization.
