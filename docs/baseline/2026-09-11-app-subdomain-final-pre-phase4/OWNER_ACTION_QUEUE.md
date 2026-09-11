# Owner Action Queue — Final Pre-Phase-4 Pass

Status as of 2026-09-11 — **all four items below are now CLOSED**, per the owner's explicit
2026-09-11 "Complete Pre-Phase-4 Closure and Proceed Through Phase 4" authorization (item 1 by the
owner's own account action; items 2 and 4 by explicit owner decision; item 3 by this session's
empirical resolution of the previously-open privacy question, deployment to Production still
pending as a mechanical follow-through, not an open decision). Historical detail below is kept
as-is for the record — items are marked closed, not deleted or rewritten.

## 1. CLOSED — Regenerate recovery codes for the test account(s) used during manual validation

**Closed 2026-09-11**: the owner reports regenerating recovery codes for the affected account via
the normal in-app flow (`/api/auth/recovery-codes/generate`). This session did not perform,
observe, query, or reproduce the replacement codes — this is recorded as
**`OWNER-OBSERVED PASS`**, closed on the owner's own report, consistent with the evidence tier
used throughout `PHASE_4_READINESS_REPORT.md`. The original finding and evidence below remain
unchanged, for the historical record.

**Finding, not a hypothesis**: this pass independently queried production D1 (read-only,
PII-free — only `id`, `used_at`, `created_at` columns read, never `code_hash`) and confirmed:

- User `99f8c613-…` (the account used for the new-passkey/Google-sign-in test) has **exactly one**
  recovery-code batch on record, created `2026-09-11T02:14:27.257Z`, with 1 of 10 codes used
  (`02:18:31.954Z`) and **9 still valid and unused right now**.
- `generateRecoveryCodes()` (`apps/web/src/lib/auth/recovery-codes.ts`) hard-deletes the previous
  batch before inserting a new one — confirmed from source. This means a database snapshot cannot
  distinguish "never regenerated" from "regenerated once, old batch deleted." Since this account
  has only ever had one batch on record, **no regeneration has occurred since this batch's
  creation** — there is no later batch to have superseded it.
- If this is the batch shown in the screenshots referenced in this pass's own instructions, those
  codes are **currently still valid and usable by anyone who saw them**.

**Action required**: regenerate recovery codes for any account whose codes were shown in a
screenshot during this validation round, via the normal in-app recovery-codes management flow
(`/api/auth/recovery-codes/generate`), before Phase 4. This was not done by this session — it
requires the owner's own account action, and generating fresh codes on someone's behalf without
being asked crosses a line this session doesn't cross unprompted.

**Not urgent for real customers**: this only affects the specific test account(s) exercised during
this pass. The two long-lived pre-migration accounts (`0b4c8ee3-…`, created 2026-07-30;
`a282ef8c-…`, created 2026-07-28) show no batch activity in this window and are unaffected.

## 2. CLOSED (DECIDED) — Production `workers.dev` exposure

**Decided 2026-09-11 by explicit owner authorization**: **KEEP TEMPORARILY during the Phase-4
rollback window**, Classification B confirmed, explicitly not a Phase-4 blocker. No config change
is being made — `workers_dev` stays enabled as-is. Revisit only after the rollback window closes,
not before.

Classification: **B — acceptable temporary fallback with a proven fail-closed boundary**, not an
immediate must-fix. Evidence: `crawlpact-web.<account>.workers.dev` remains enabled
(`{"enabled":true,"previews_enabled":true}`, confirmed live 2026-09-11); public marketing content
is served from it (expected — no boundary exists there for public content), but every sensitive
path (`/sign-in`, `/app`, `/admin`, `/api/*`) already fails closed against an unrecognized host,
confirmed by `worker.host-boundary.test.ts` and re-verified live against the real `*.workers.dev`
fallback hostname in Phase 3. It cannot interfere with WebAuthn (RP ID is a fixed value, not
host-derived), Google OAuth (Google validates the origin independently, and this hostname was
never added to Authorized Origins), or Paddle (checkout domains are Paddle-side allowlisted, this
hostname isn't one of them). Disabling it (`"workers_dev": false` in `wrangler.jsonc`, a
repository-governed change, plus the corresponding account-level API call) is prepared but not
applied — it needs the owner's explicit go-ahead since it's a real, if low-risk, Production change.

## 3. CLOSED — Approve (or decline) enabling Workers Logs for Production

**Updated same day (observability step 1)**: Cloudflare Workers Logs is now enabled for **Preview
only** (`env.preview.observability` in `wrangler.jsonc`, PR #176), deployed, and empirically
verified receiving real data — see `OBSERVABILITY_READINESS.md` for the full evidence, including a
live query proving an intentional test request was actually logged. **Production remains
completely unchanged** — no `observability` key exists at the top level, confirmed by diffing the
generated build output before and after.

**Updated again same day (observability step 2)**: Production's real traffic was measured
(7-day peak 3,328 requests/day, 7-day average ~1,894/day, both far under the 200,000/day
allowance), the exact Production config was prepared (`observability: { enabled: true,
head_sampling_rate: 1 }` at the top level), and a Production-specific privacy review completed
(no sensitive `console.*` logging anywhere; one honest non-blocking note about two existing
path-embedded bearer tokens — `/feed/[token].xml`, `/shared/[token]` — being visible to Cloudflare
dashboard users once enabled, both already independently revocable). Full detail and the exact
calculation: `OBSERVABILITY_READINESS.md`.

**Closed 2026-09-11 (Step 3A/3B)**: the one open question — whether enabling Production Workers
Logs would persist the two real path-embedded bearer tokens (`/feed/[token].xml`,
`/shared/[token]`) — is resolved empirically, not by judgment call. A controlled Preview
experiment with synthetic tokens proved Cloudflare Workers Logs automatically redacts high-entropy
path and query-string values by platform default (positive control: a plain path segment logged
verbatim; every synthetic token-shaped value, across the real `/feed/*`, `/shared/*`, and
`?continuation=` code paths, redacted to `REDACTED`). Full experiment:
`OBSERVABILITY_READINESS.md`'s "Step 3A/3B" section. The already-approved config (`{ enabled: true,
head_sampling_rate: 1 }`, identical to Preview's) already satisfies the hard invariant — no
further design decision is needed. The owner's explicit authorization (Section 6) covers deploying
this to Production without a further approval round; deployment itself is tracked as in-progress
mechanical follow-through, not an open item on this queue.

## 4. CLOSED (NON-BLOCKING) — Confirm Google Authorized JavaScript Origins directly

This pass found strong circumstantial technical evidence (a new Google OAuth linkage created in
production D1 at the same time as the reported app-host sign-in) that `app.crawlpact.com` is
correctly authorized, but no tool in this session can read Google's own configuration directly. A
30-second look at Google Cloud Console → APIs & Services → Credentials would close this
definitively; not blocking given the strength of the existing evidence, but the more rigorous
close-out.

**Decided 2026-09-11 by explicit owner authorization**: desirable but explicitly **not a Phase-4
blocker**. Direct Console confirmation remains a nice-to-have the owner can do at any time, not a
gate on this migration.

## Not queued (already closed or explicitly out of scope for this pass)

- Paddle resubmission — already approved, do not touch.
- BIC Configuration Rule — intentionally frozen, Paddle approved with it in place.
- Google OAuth client changes, DNS/Custom Domain changes, subscription/payment mutations — none
  needed and none attempted, per this pass's own authorization boundary.
