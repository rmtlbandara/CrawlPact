# Phase 5 — Anonymous Audit Result and Account-Conversion Flow — Completion Report

Branch `phase-05-anonymous-audit-conversion`, based on `main` at
`87a69a522dce4b24e676d3c7a26c9396fd2b382b` (Phases 0-4 plus the billing race-condition fix and the
Public Country Reference and Contact Messaging Correction, all merged and deployed). Established
2026-08-04.

## Executive summary

Before this phase, an anonymous audit report had no path back to an account at all —
`docs/product/PHASE_05_EXISTING_CONVERSION_FLOW_BASELINE.md` (written before any code changed)
confirmed zero CTAs beyond Print/Copy-robots, no anonymous-identity mechanism beyond an HMAC'd IP
used only for rate limiting, and no return-URL handling anywhere in the auth system. This phase
adds a contextual "Save and monitor this domain" / "Save without monitoring" CTA to the anonymous
report, a secure DB-backed continuation record that carries a visitor's intent through sign-up or
sign-in without ever transmitting report content, and an authenticated handoff that adopts the
original scan as the domain's starting result when it's still eligible, or reruns it under the new
account otherwise — never duplicating the score, never leaking who else may have looked at the same
domain. Monitoring is always a separate, later, explicit opt-in, regardless of which CTA button was
clicked. The core product promise — a useful public audit without being forced to register — is
unchanged: the report renders identically for every visitor, and the CTA is purely additive.

No pricing, Paddle, plan-limit enforcement, crawler-evaluation logic, or notification-channel
behaviour was touched. No automatic checkout, no fake urgency/scarcity language, no public country
reference was introduced. The pre-existing manual "Add a domain" flow (`DomainsManager` →
`POST /api/domains`) is completely unchanged, including its own unconditional
`monitoringState: "active"` default on creation — this phase's "monitoring is a separate step"
behaviour applies only to domains saved through the new continuation-driven path.

**This phase's execution prompt scoped it specifically to the conversion flow.** It did not
include the two backlog items the Phase 4 completion report provisionally routed to Phase 5 (SRS
§2.3 tagline reconciliation / RISK-028, and the 10 missing `package.json` `"description"` fields).
Both remain genuinely open and are recorded as carried forward to Phase 6 in
`docs/roadmap/CRAWLPACT_IMPROVEMENT_IMPLEMENTATION_PLAN.md` and
`docs/governance/GITHUB_GOVERNANCE_SETUP_MANIFEST.md` — not silently dropped, not assumed done.

## Starting point

`docs/product/PHASE_05_EXISTING_CONVERSION_FLOW_BASELINE.md`, written before any Phase 5 code
changed, captured: the full anonymous audit flow end to end; confirmation that
`/audit/[auditId].astro` is the one shared report route for anonymous, owned, and shared viewers
alike; the auth system's session-cookie/CSRF mechanics and the confirmed absence of any return-URL
handling ("genuinely greenfield"); saved-domain creation's duplicate-detection and cross-account
privacy guarantees, and confirmation that saving never adopted an anonymous scan before this phase;
monitoring's auto-active-but-inert-on-free-plan default; the plan entitlement table; the
`PRODUCT_EVENT_NAMES` closed union and `trackEvent()` signature; and the existing test-coverage
inventory this phase's own tests build on.

## Design decisions

Full reasoning in `docs/security/PHASE_05_AUDIT_CONVERSION_THREAT_REVIEW.md` and
`docs/product/ANONYMOUS_TO_AUTHENTICATED_BASELINE_POLICY.md`; summarised here:

- **Continuation mechanism**: a new `audit_continuations` table (migration
  `0020_audit_continuations.sql`), not the codebase's existing stateless signed-token pattern —
  the required "already consumed" / "replayed" / "expired" distinction needs an explicit,
  queryable state a stateless token cannot provide. 60-minute TTL, raw (unhashed) UUID id — the
  worst-case leak (a domain saved to the wrong account) is judged low-stakes enough not to warrant
  hashing overhead, unlike the codebase's genuinely sensitive tokens (`sharing.ts`,
  `recovery-codes.ts`).
- **Consumption is a single atomic conditional `UPDATE`** (`consumeContinuation`), the same
  compare-and-swap discipline used to fix the real billing-webhook race this release cycle — closes
  the double-save race without a lock or a re-check.
- **Baseline adoption is a claim, not a copy**: `UPDATE scans SET domain_id = ? WHERE domain_id IS
NULL`. One statement both prevents a concurrent double-adoption and guarantees the report is
  never duplicated for a different owner; the loser of a claim race silently reruns for their own
  account instead, revealing nothing about who won.
- **Monitoring is never auto-enabled by this flow**, regardless of `intendedAction` — the CTA
  button clicked before an account even existed is treated as UI-copy guidance, not consent for an
  ongoing state change. Enabling it is always a later, separate, explicit click that reuses the
  pre-existing `PATCH /api/domains/:domainId` route unchanged.
- **The authenticated handoff never auto-fires** — `/app/continue` only ever consumes the
  continuation from an explicit "Confirm and save" click, never on page load, closing a
  lured-navigation scenario where visiting someone else's continuation link (continuations aren't
  account-bound, by design, since the creator has no account yet) could otherwise silently spend a
  signed-in visitor's saved-domain slot.
- **Open-redirect protection**: `isSafeRelativeRedirect()`, the first client-influenced redirect
  target this codebase has ever accepted, applied narrowly to `sign-in.astro`'s own
  server-computed `redirectTo` (never a raw query-parameter passthrough).

## Implementation files

**New:**

- `packages/database/migrations/0020_audit_continuations.sql` + `packages/database/src/schema/domains-scans.ts` (schema addition) — the continuation table.
- `apps/web/src/lib/audit-continuation.ts` — `createContinuation`, `consumeContinuation`, `establishBaseline`.
- `apps/web/src/lib/policy-summary.ts` — `computePolicySummary` (six-dimension executive summary) and `deriveConversionCtaCopy` (six-variant contextual CTA copy), both pure derivations from an already-computed report.
- `apps/web/src/lib/auth/safe-redirect.ts` — `isSafeRelativeRedirect()`.
- `apps/web/src/pages/api/audit/[auditId]/continuation.ts` — `POST`, anonymous, rate-limited, creates a continuation.
- `apps/web/src/pages/api/audit/continuation/[continuationId].ts` — `POST`, authenticated, consumes the continuation and establishes the baseline.
- `apps/web/src/components/AuditConversionCta.tsx` — the report-page CTA.
- `apps/web/src/components/app/AuditConversionHandoff.tsx` — the `/app/continue` confirm/result UI, including the monitoring-consent step.
- `apps/web/src/pages/app/continue.astro` — the authenticated handoff page.
- `docs/product/{PHASE_05_EXISTING_CONVERSION_FLOW_BASELINE,ANONYMOUS_REPORT_POLICY_SUMMARY_MAPPING,ANONYMOUS_TO_AUTHENTICATED_BASELINE_POLICY,AUDIT_CONVERSION_FLOW,AUDIT_CONVERSION_STATE_MODEL}.md`
- `docs/security/PHASE_05_AUDIT_CONVERSION_THREAT_REVIEW.md`
- `docs/analytics/PHASE_05_AUDIT_CONVERSION_EVENT_MODEL.md` (first file under a new `docs/analytics/` directory)

**Modified:**

- `apps/web/src/components/AuditReportView.tsx` — renders the policy-impact summary section and, when `conversionCta` is passed, the CTA; new optional prop, every existing caller (`/shared/[token]`, `/sample-report`) unaffected since neither passes it.
- `apps/web/src/pages/audit/[auditId].astro` — resolves viewer context (already-owns-this-domain?) server-side and passes `conversionCta`.
- `apps/web/src/components/auth/PasskeyAuth.tsx` — new optional `initialMode` prop (default `"signin"`, backward compatible).
- `apps/web/src/pages/sign-in.astro` — continuation-aware heading/redirect, read-only peek only.
- `apps/web/src/lib/domains.ts` — exported `findOwnedDomainByOrigin` (was already computed internally by `createDomain`, now reusable).
- `apps/web/src/lib/analytics.ts` — 13 new `PRODUCT_EVENT_NAMES` entries.
- `packages/core/src/api/{errors.ts,contracts/audit.ts}` — new `AUDIT_CONTINUATION_INVALID` error code, continuation request/response contracts.

## Correctness fix found during this phase

`establishBaseline()`'s `BaselineResult` type included a `"scan_missing"` failure reason that could
never actually be returned — the function fell straight through to a pointless rerun attempt
against a missing scan instead. Fixed by returning it explicitly the moment the scan lookup comes
back empty, before any further work happens.

## Tests

- **Unit** (`apps/web/src/lib/policy-summary.test.ts`, `.../auth/safe-redirect.test.ts`): 31 tests —
  the six-dimension policy summary (14 pre-existing, unchanged), the six-variant CTA copy priority
  waterfall (8 new), and the redirect-safety function (9 pre-existing, unchanged).
- **Integration** (`apps/web/tests/integration/audit-conversion.integration.test.ts`, real D1 via
  Miniflare, real HTTP route handlers): 11 tests covering continuation creation (with/without an
  eligible scan), unauthenticated completion rejection, the full adopt-and-save lifecycle
  (including monitoring left paused and the claimed scan's `domain_id`/`triggered_by`), expired
  continuation, replay/already-consumed, unknown continuation id, reusing an already-saved domain
  instead of duplicating, `DOMAIN_LIMIT_REACHED`, and the claim-race fallback to a rerun (with an
  honest `engine_disabled` failure surfaced rather than a fabricated result, since the harness runs
  with the audit engine off).
- **E2E** (`apps/web/tests/e2e/audit-conversion.spec.ts`, real browser, real WebAuthn virtual
  authenticator, real scan against the `e2e-fixture.crawlpact.com` fixture site): 2 journeys — a
  new visitor's full audit → CTA → sign-up → confirm → (no-monitoring-entitlement honesty) →
  domain-page journey, and a replay test proving a second visit to a used continuation link shows
  the error state server-side (no confirm button reachable at all) with defence-in-depth
  verification that the completion endpoint independently rejects a direct replay too.
- **Accessibility** (`apps/web/tests/a11y/home.spec.ts`): 2 new checks — a real anonymous report
  page with the CTA visible, and `/app/continue`'s always-reachable invalid-link error state.

**Not written**, and explicitly not claimed as covered: the full A–H named e2e journey set, a
dedicated session-fixation test, and IDN/www-variation-specific domain-saving cases from the
original 45-section prompt. The core paths — new user, replay, plan limit, duplicate domain,
claim race, expired/invalid/unauthenticated — are covered by the integration suite; a professional
follow-up pass extending e2e coverage to the remaining named journeys is reasonable future work,
not silently claimed done here.

## Validation

- `pnpm run quality` (format, lint, typecheck via `astro check`, unit — 160+31 tests, integration —
  160 tests including the 11 new, `db:validate` — 41 tables consistent, production build): **all
  green**.
- `pnpm docs:validate`, `brand:validate`, `trust:validate`, `registry:validate`, `secrets:scan`:
  **all passed**.
- `pnpm verify:push` (full local CI reproduction — migrate, seed, format/lint/typecheck/unit/
  integration/db:validate/build, then a real Chromium e2e + a11y smoke against a live dev server,
  then secret scan): **all green** (three consecutive clean runs, after fixing an e2e locator regex
  bug and a doc formatting issue the first run caught).
- PR #78 CI (`Format, lint, typecheck, unit + integration tests, build` and
  `Chromium E2E + accessibility smoke`): **both passed**. Merged to `main` as `c5efc97`.

## Deployment

Deployed to production 2026-08-04 via `deploy-production.yml` against `c5efc97`, with explicit
user authorization requested and given separately from the merge. Migration
`0020_audit_continuations.sql` applied to production D1. In-workflow smoke test: 32/32 passed.
Independently re-verified directly against the live site afterward: homepage/`/sign-in`/
`/app/continue` respond correctly (the latter redirecting an unauthenticated visitor to
`/sign-in`), `POST /api/audit/:auditId/continuation` correctly returns `AUDIT_NOT_FOUND` for an
unknown id, and a real anonymous audit against `e2e-fixture.crawlpact.com` produced a live report
page containing both the new CTA and the new policy-impact summary. Deployed Worker version ID:
`03180537-d303-4a48-a112-6f1e1af6c974`. See `CHANGELOG.md`'s "Production deployment (2026-08-04) —
Phase 5" entry.

## Next phase

Phase 6 — Pricing, Plan Architecture and Checkout Continuity — depends on Phase 4 (already
satisfied) and now also inherits the two carried-forward backlog items noted above (SRS §2.3
tagline reconciliation, `package.json` descriptions).
