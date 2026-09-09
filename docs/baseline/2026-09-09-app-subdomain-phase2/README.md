# Phase 2 — App-Subdomain Migration: Application-Origin Implementation

Evidence package for Phase 2 (ADR-0010). See `PHASE_2_COMPLETION_REPORT.md` for the full narrative
and verdict: `PASS — PHASE 3 READY / OWNER ACTIONS QUEUED`.

Phase 2 is code implementation and local/CI validation only. **No production cutover occurred.**
`app.crawlpact.com` still has no Cloudflare Custom Domain. No root→app redirect was enabled. The
one real deployable change (production `run_worker_first`) has not been deployed — see
`STATIC_ASSET_HOST_ENFORCEMENT.md`'s deployment caution.

## Documents in this folder

| Document                                    | Content                                                                             |
| ------------------------------------------- | ----------------------------------------------------------------------------------- |
| `APPLICATION_ORIGIN_IMPLEMENTATION.md`      | Integration overview and the deliberate no-de-prefixing scope decision              |
| `HOST_ROUTING_IMPLEMENTATION.md`            | `worker.ts`'s host-boundary decision tree                                           |
| `CSRF_ORIGIN_ENFORCEMENT.md`                | The self-referential CSRF redesign and the test-suite compatibility fix it required |
| `WEBAUTHN_ORIGIN_PINNING_IMPLEMENTATION.md` | Origin-pinned challenge tokens, proven with a real WebAuthn authenticator           |
| `AUTH_LAYOUT_AND_ANALYTICS_BOUNDARY.md`     | The new `AuthLayout` and its test coverage                                          |
| `STATIC_ASSET_HOST_ENFORCEMENT.md`          | The production `run_worker_first` change and its live-evidence basis                |
| `TEST_EVIDENCE.md`                          | Exact test counts and commands, including a real bug this phase's own tests caught  |
| `PHASE_3_EXTERNAL_ACTION_QUEUE.md`          | Sequenced owner actions for Phase 3                                                 |
| `PHASE_2_COMPLETION_REPORT.md`              | Full completion report and Phase 3 readiness verdict                                |

Phase 1 evidence remains authoritative and unmodified at
`docs/baseline/2026-09-09-app-subdomain-phase1/`.
