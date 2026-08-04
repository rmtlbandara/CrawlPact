# Anonymous audit result and account-conversion flow (Phase 5)

Connects an anonymous, public audit report to a saved, monitored domain,
without ever making the report itself require an account. See
`docs/product/PHASE_05_EXISTING_CONVERSION_FLOW_BASELINE.md` for the
pre-Phase-5 state this builds on, and
`docs/security/PHASE_05_AUDIT_CONVERSION_THREAT_REVIEW.md` for the security
reasoning behind each design choice below.

## Product promise

> A user can receive a useful public audit without being forced to
> register.

Nothing in this flow changes that. `/audit/[auditId]` renders the full real
report — score, crawler matrix, findings, policy-impact summary, every
signal section — for every visitor, signed in or not. The conversion CTA is
additive: declining it, or never seeing it (e.g. on a shared report link or
the sample report, which never render it), leaves the report exactly as
useful as it always was.

## The six-step journey

1. **Anonymous audit.** Unchanged — `AuditForm` → `POST /api/audit` →
   `/audit/[auditId]`, exactly as before Phase 5.

2. **Contextual CTA.** `AuditReportView` computes a six-dimension policy
   summary (`computePolicySummary`, already existed) and derives one of six
   CTA copy variants from it (`deriveConversionCtaCopy`, new in Phase 5) —
   see `docs/product/ANONYMOUS_REPORT_POLICY_SUMMARY_MAPPING.md` for the
   underlying classification and the priority order
   `conflict_detected > registry_uncertainty > search_risk >
incomplete_evidence > training_unspecified > clean_baseline` in
   `apps/web/src/lib/policy-summary.ts`. Only rendered when the current
   viewer doesn't already own the domain (`AuditConversionCta.tsx`); if they
   do, a "Manage this domain" link replaces it instead.

3. **Continuation created.** Clicking "Save and monitor this domain" or
   "Save without monitoring" calls `POST /api/audit/:auditId/continuation`,
   which creates a 60-minute, single-use `audit_continuations` record and
   returns its id — no report content, no account reference (there isn't
   one yet).

4. **Sign-in / sign-up, continuation-aware.** The browser navigates to
   `/sign-in?continuation=<id>`. That page peeks (read-only) at the
   continuation to show "Continue to save and monitor `<domain>`" as its
   heading and defaults to the sign-up tab (`PasskeyAuth`'s `initialMode`
   prop) — the common case is a new visitor. An already-authenticated
   visitor skips this step entirely (`sign-in.astro` redirects immediately).
   Either way, the passkey ceremony itself is completely unchanged.

5. **Authenticated handoff, one explicit confirmation.** `PasskeyAuth`'s
   `redirectTo` carries the continuation through to `/app/continue`, which
   shows a "Save `<domain>`?" confirmation (never auto-fires — see the
   threat review for why). Clicking "Confirm and save" calls
   `POST /api/audit/continuation/:continuationId`, which:
   - consumes the continuation exactly once (atomic CAS);
   - saves the domain (or reuses an already-saved one for the same
     account/origin — never a duplicate);
   - establishes a baseline result via adopt-or-rerun
     (`docs/product/ANONYMOUS_TO_AUTHENTICATED_BASELINE_POLICY.md`);
   - leaves monitoring paused, regardless of which CTA button was clicked.

6. **Monitoring, a separate explicit step.** The result screen offers
   "Enable monitoring" / "Not now" only when the account's plan actually
   includes it (`plan.monitoringFrequency !== "none"`); otherwise it
   honestly says monitoring isn't included and links to plans. Enabling
   calls the pre-existing `PATCH /api/domains/:domainId` with
   `{ monitoringState: "active" }` — no new endpoint, no change to that
   route's own behaviour.

## Error and edge states

| Situation                                          | Where it's handled                      | Behaviour                                                                                                                                                                         |
| -------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Continuation expired                               | `POST /api/audit/continuation/:id`      | `AUDIT_CONTINUATION_INVALID` (410), "expired" message                                                                                                                             |
| Continuation already consumed / replayed           | same                                    | `AUDIT_CONTINUATION_INVALID` (410), "already been used" message                                                                                                                   |
| Continuation id never existed                      | same                                    | `AUDIT_CONTINUATION_INVALID` (410), generic "not valid" message                                                                                                                   |
| Re-visiting a consumed continuation's link         | `/app/continue` (GET)                   | Read-only peek fails too — the confirm UI never even renders; `ErrorState` instead                                                                                                |
| Underlying scan not eligible (not completed)       | `POST /api/audit/:auditId/continuation` | `VALIDATION_FAILED` (400) — the CTA is only shown for a completed report anyway                                                                                                   |
| Domain already saved to this account               | `POST /api/audit/continuation/:id`      | Reuses the existing domain id; no duplicate created                                                                                                                               |
| Saved-domain plan limit reached                    | same                                    | `DOMAIN_LIMIT_REACHED` (403)                                                                                                                                                      |
| Scan already claimed by a different account (race) | `establishBaseline` inside same         | Falls through to a fresh rerun scoped to this account; if the audit engine is disabled, an honest `baselineEstablished: false` + explanatory `warning`, never a fabricated result |
| Not authenticated when confirming                  | `requireSession` inside same            | `UNAUTHENTICATED` (401)                                                                                                                                                           |

## What this flow explicitly does not do

No pricing, billing, plan-limit enforcement, crawler-evaluation logic, or
notification-channel behaviour was changed. No checkout is triggered
automatically. No urgency/scarcity language is used anywhere in the CTA or
handoff copy. No public country reference was introduced (consistent with
the prior release's correction). The pre-existing manual "Add a domain"
flow (`DomainsManager` → `POST /api/domains`) is completely unchanged,
including its own unconditional `monitoringState: "active"` default —
Phase 5's "monitoring is a separate step" behaviour applies only to domains
saved through this new continuation-driven path.
