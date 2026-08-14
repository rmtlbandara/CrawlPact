# Phase 19 Evidence Backlog

Status: current-authoritative, 2026-08-14. Per §131, this pass does not implement this backlog —
it establishes it, then selects only the smallest highest-evidence items (see "Selected for this
pass" below).

| ID      | Problem                                                                                                       | Evidence                                                    | Affected metric                                                     | Confidence                                                      | Effort                                                                       | Risk                            | Priority | Decision                                                                                          |
| ------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| P19-001 | 0 external pilot participants recruited                                                                       | Direct D1 query, this pass                                  | External activation, MRR                                            | High (directly measured)                                        | N/A — manual owner action                                                    | None                            | Highest  | `ready` — owned by product owner, see `PHASE_19_EXTERNAL_COMMERCIAL_VALIDATION_PLAN.md`           |
| P19-002 | Search Console not connected                                                                                  | Confirmed no auth tool exists, this pass and prior 3 passes | Organic acquisition baseline, content prioritization                | High                                                            | Low (one-time manual setup)                                                  | None                            | High     | `ready` — owned by product owner, see `docs/release/PHASE_18_SEARCH_CONSOLE_REQUIRED_ACTION.md`   |
| P19-003 | Preview Lighthouse consistently fails (~82/85, ~4980ms/3000ms) on unrelated commits                           | Two reproductions this session, identical numbers           | CI signal quality (false-negative risk on real preview regressions) | Medium (reproduced twice, not yet isolated to a specific cause) | Medium (requires controlled production/preview/local-Worker comparison, §79) | Low — doesn't affect production | Medium   | `investigate`                                                                                     |
| P19-004 | Pending registry candidate (Amazon/Google/Bingbot corrections) not yet published                              | `docs/status/CURRENT_STATE.md`                              | Registry freshness/accuracy                                         | High                                                            | Low (a Super Admin publish action)                                           | Low — reviewed, ready           | Medium   | `ready` — owned by product owner via Super Admin                                                  |
| P19-005 | Homepage/pricing-view top-of-funnel not measurable from this session (no GA reporting API, no Search Console) | This pass's funnel baseline                                 | Acquisition baseline completeness                                   | High                                                            | Unknown — depends on whether GA reporting API access is ever connected       | None                            | Low      | `deferred` — not blocking; low real traffic makes this low-value to solve before real users exist |
| P19-006 | 5 open Dependabot PRs (dev-tooling only)                                                                      | Confirmed unchanged across 3 sessions                       | Dependency freshness                                                | High                                                            | Low per PR                                                                   | Low (dev-tooling only)          | Low      | `deferred` — no security relevance, batching them is ordinary maintenance not foundation work     |

## Selected for this pass

**None implemented as code changes.** Per §152, this pass's scope was measurement verification,
documentation, and risk reconciliation — no concrete measurement/governance gap was found that
required a product-code change. P19-001 and P19-002 are the two highest-priority items and are
both manual, owner-only actions already fully documented elsewhere; nothing further for a coding
pass to do on them right now.

## Status vocabulary

`investigate` / `ready` / `testing` / `shipped` / `successful` / `neutral` / `reverted` /
`deferred` / `rejected` — per §133, used consistently across future updates to this backlog.
