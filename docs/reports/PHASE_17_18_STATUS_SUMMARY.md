# Phase 17 & 18 — Status Summary

Status: current-authoritative, 2026-08-14. **This is a summary document, not a completion
report.** Neither Phase 17 nor Phase 18 has completed in the canonical sense used elsewhere in
this repository (a real GO decision with recorded owner approval, for Phase 18; real external
commercial validation, for Phase 17). No `PHASE_17_..._COMPLETION_REPORT.md` or
`PHASE_18_PRODUCTION_LAUNCH_READINESS_FINAL_AUDIT.md` exists, and creating either now — before the
real evidence each requires — would itself violate this project's core rule against presenting a
fabricated outcome as real (`CLAUDE.md`). This document exists to give one clear, evidence-linked
picture of where both phases actually stand, for a reader who doesn't want to reconstruct it from
the dozens of underlying documents each phase produced.

## The one-sentence version

**Both phases are technically complete and commercially/operationally blocked** — Phase 17 by the
absence of real external pilot participants, Phase 18 by Phase 17's own unresolved Gate E plus one
newly-confirmed security blocker (an unrotated Paddle webhook secret). Nothing async or automated
can resolve either blocker; both require the product owner to act in the real world.

---

## Phase 17 — Customer Pilot and Commercial Validation

**Framing.** Phase 17 was explicitly designed as an evidence-generation phase, not a feature
phase. Its purpose was to determine — with real people, not synthetic tests — whether CrawlPact is
understood, activated without help, returned to, and paid for. An autonomous coding agent cannot
recruit real pilot participants; that was disclosed before the phase began and held throughout.

### What shipped (deployed to production, verified live)

- **Data model** (migration `0036`): `pilot_cohorts` / `pilot_participants` / `pilot_feedback` —
  deliberately minimal, structurally incapable of granting a plan entitlement (no plan/
  subscription/domain-count column anywhere in the schema).
- **Super Admin workspace** (`/admin/pilots`): cohort/participant management, live activation /
  monitoring-enabled / paid-conversion metrics computed directly from existing
  `domains`/`subscriptions`/`billing_customers` data — never a duplicated field.
- **In-app feedback capture** (`PilotFeedbackLink`, `POST /api/app/pilot/feedback`),
  ownership-scoped.
- **Governance**: 23 new documents — pre-registered hypotheses, frozen success criteria,
  participant qualification rules, change-control policy, commercial-validation decision
  framework, security/privacy threat review (`docs/pilot/`, `docs/product/`, `docs/security/`,
  `docs/data/`, `docs/operations/`).
- **Tests**: 11 new integration cases + 1 retention case, all passing against real D1.
- Shipped via PR #113 (code, merged `bc1b212`) → deployed as Worker
  `7d79dfd1-7978-4ee1-ac99-4e43e7f23129` → PR #114 (deployment record, merged `5473410`). Both
  independently re-verified post-deploy (D1 query, live HTTP checks).

### What was found, not built (a genuine discovery)

Two real, live production Paddle subscriptions already existed on the product owner's own Super
Admin account, independently re-verified read-only against the Paddle API — a real checkout →
payment → webhook → plan-grant chain. This **closes RISK-001's technical sub-question**
(`docs/pilot/REAL_PAID_CHECKOUT_VALIDATION_PROTOCOL.md`) but is explicitly excluded from
commercial-validation evidence per the phase's own rules (an owner-funded transaction proves
nothing about market demand).

### What remains open

- **0 real external pilot participants, 0 real external paying customers.**
- `docs/pilot/PHASE_17_COMMERCIAL_VALIDATION_DECISION.md`: **Outcome C — insufficient evidence**
  (honest, not a failure — the test has not run yet).
- Full unblock path is in `docs/pilot/PHASE_17_PILOT_READY_AWAITING_EXTERNAL_EVIDENCE.md`: recruit
  ≥8 real participants (weighted agency/multi-site), observe ≥14 days, bring the evidence back.

---

## Phase 18 — Production Launch Readiness and Final Audit

**Framing.** Phase 18's own mandatory Stage 18-0 precondition check requires stopping before any
implementation work if Gate E (Phase 17 commercial validation) is unmet. It was. Per an explicit
product-owner decision made in-session, a **technical-only** audit ran anyway — every domain
independent of commercial evidence — on the upfront, held condition that it would not produce a
GO decision, Gate E/F completion, or a completion report. That condition was honored throughout.

### Decision: HOLD

Two independent reasons, either sufficient alone:

1. **Gate E unsatisfied** — unchanged from Phase 17 above.
2. **RISK-002 is a launch BLOCKER** — the Paddle webhook signing secret has never been rotated
   since a prior session's plaintext exposure. Phase 18's own policy defaults this to a blocker
   until proven otherwise; no rotation evidence exists anywhere in the repository. Rotating it
   requires the product owner's separate, explicit, in-the-moment live-operation approval — not
   sought this pass, since it's a real production credential change with its own risk.

### What was genuinely verified this pass (docs-only PR #115, merged `54d3e586`)

- **Repo/production alignment**: `main` HEAD = deployed Worker commit, no drift.
- **Database**: 36/36 migrations; live table count now matches the local validator exactly.
- **Registry**: re-investigated the seed-immutability guard (RISK-018) and confirmed the gap is
  **still real** — a new crawler added under one of 9 specific operators could still be silently
  inserted into an already-published, supposedly-immutable release on a future seed re-run.
- **Billing**: live Paddle catalog verified read-only (9 prices: 6 current + 3 legacy); confirmed
  by direct code read that new checkouts can never resolve to a legacy price.
- **Security**: live production headers (CSP, HSTS, private-route no-store) all correct;
  `security.txt`/`robots.txt`/`sitemap.xml` all correct.
- **GitHub/Cloudflare governance**: branch protection and zone-settings restrictions re-confirmed
  unchanged; one new finding (GitHub's check-runs API is now also restricted for this token).
- **Full canonical quality gate**: 402 unit + 344 integration + 41 security tests, all validators,
  dependency audit, production build — **all green** (confirmed twice, after a local
  ephemeral-port exhaustion mid-pass — caused by this session's own repeated test runs, not a
  product defect — was diagnosed and cleared).

### Resolved this pass

| Risk                               | Resolution                                                          |
| ---------------------------------- | ------------------------------------------------------------------- |
| RISK-019 (table-count discrepancy) | No longer reproduces — archived (`ARC-034`).                        |
| RISK-028 (SRS tagline conflict)    | Resolved via explicit SRS supersession note — archived (`ARC-033`). |

### Explicitly not attempted

Secret rotation, RISK-006's retention decision, Search Console connection, launch rehearsal, and
the canonical completion report — all require either owner action or a genuine launch decision
this pass was scoped never to produce.

Full detail: `docs/release/PHASE_18_TECHNICAL_AUDIT_INTERIM_REPORT.md`,
`PHASE_18_LAUNCH_RISK_MATRIX.md`, `PHASE_18_LAUNCH_READINESS_MATRIX.md`,
`PHASE_18_CURRENT_PRODUCTION_MANIFEST.md`, `PHASE_18_EXTERNAL_SERVICE_VERIFICATION.md`,
`PHASE_18_SEARCH_CONSOLE_REQUIRED_ACTION.md`.

---

## The combined blocker chain to Phase 19

In order, each requiring the product owner (none of these are things a future coding session can
resolve alone):

1. **Recruit real external pilot participants** (Phase 17's actual unblock) — target ≥8, weighted
   agency/multi-site, ≥14-day observation window.
2. **Authorize `PADDLE_WEBHOOK_SECRET` rotation** as a separate, explicit, live-operation decision
   — a future session then executes and verifies it.
3. **Decide RISK-006** — implement bounded `security_events`/`notifications` retention, or
   formally accept the unbounded-growth risk.
4. **Connect Google Search Console** — one-time manual setup
   (`docs/release/PHASE_18_SEARCH_CONSOLE_REQUIRED_ACTION.md`).
5. Only then: a future session re-attempts the Lighthouse re-measurement, runs the launch
   rehearsal, and produces the real Phase 18 GO/HOLD/NO-GO decision and, if warranted, the
   canonical completion reports for both phases.

## What this document deliberately does not do

It does not claim commercial validation, does not claim a launch decision, and does not backdate
either phase to "complete." Both phases are exactly as open as their own detailed decision
documents say they are — this file is a map to that evidence, not a replacement for it.
