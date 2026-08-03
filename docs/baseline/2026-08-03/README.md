# Phase 0 Baseline — 2026-08-03

Start here: [`PHASE_0_BASELINE_REPORT.md`](./PHASE_0_BASELINE_REPORT.md) — the main human-readable
report for this Phase 0 governance/baseline audit.

## Contents

| File                                     | Covers                                                                            |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| `PHASE_0_BASELINE_REPORT.md`             | Main report — executive summary, all section summaries, completion decision       |
| `ROUTE_INVENTORY.md`                     | Per-route classification of all 61 Astro pages + 93 API routes                    |
| `CAPABILITY_MATRIX.md`                   | 24-capability status matrix with evidence and future-phase routing                |
| `PRODUCTION_INFRASTRUCTURE_INVENTORY.md` | Cloudflare Workers/D1/KV/R2/cron, Paddle live catalog, public-route HTTP checks   |
| `ENVIRONMENT_AND_BINDING_INVENTORY.md`   | Every environment variable and Cloudflare binding, presence/purpose (no values)   |
| `DATABASE_AND_MIGRATION_BASELINE.md`     | Migration list, table list, FK/ON DELETE audit, seed-data review                  |
| `BILLING_AND_PLAN_BASELINE.md`           | Plan catalog, checkout/webhook/entitlement code, plan-consistency check           |
| `CRAWLER_REGISTRY_BASELINE.md`           | Registry schema, crawler/operator counts, validation tooling, governance findings |
| `ANALYTICS_AND_CONSENT_BASELINE.md`      | GA + first-party analytics, consent mechanism, SRS-deviation status               |
| `TEST_AND_CI_EVIDENCE.md`                | Quality-gate execution results, CI/CD pipeline breakdown                          |
| `SCREENSHOT_MANIFEST.md`                 | Visual evidence status (blocked — no browser tool available this session)         |
| `DOCUMENTATION_CONFLICTS.md`             | 15 documentation conflicts (DC-001–DC-015) found against code/production          |
| `BASELINE_RISKS_AND_UNKNOWNS.md`         | 13 new risks (R-001–R-013) and 6 access-limited unknowns                          |
| `phase-0-baseline.json`                  | Machine-readable summary (no secrets)                                             |
| `phase-0-baseline.schema.json`           | JSON Schema for the above                                                         |
| `file-hashes.sha256`                     | SHA-256 of every file in this directory, for tamper-evidence                      |

## Related documents

- `../../governance/GITHUB_GOVERNANCE_SETUP_MANIFEST.md` — exact GitHub milestones/labels/issues
  to apply later (not applied live, per explicit user decision this session).
- `../../roadmap/CRAWLPACT_IMPROVEMENT_IMPLEMENTATION_PLAN.md` — the master 20-phase roadmap and
  release gates this baseline feeds into.

## Validation

Run `pnpm baseline:validate` to check this directory's internal consistency (required files
present, JSON matches its schema, no obvious secret patterns, evidence manifest complete).
