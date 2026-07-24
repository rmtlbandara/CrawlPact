# AGENTS.md — apps/web/src/pages/api/admin

Super Admin Control Center (SRS §28, built in Part 3). Read the parent `AGENTS.md` first for the
general API rules; this file only adds what's specific to admin routes.

## The chokepoint (`../../../lib/auth/require-admin.ts`)

Every route in this tree calls one of two functions — never hand-roll an admin check:

- **`requireAdminSession(request, db, { role? })`** — for reads. Requires an `isAdminSession`
  session, an active (non-revoked) admin role assignment, and an active account. Pass `role` to
  require a specific role rather than any admin; `super_admin` implicitly satisfies every role
  check (`hasAdminRole` in `../../../lib/admin/roles.ts`) — a narrower role must be explicitly
  assigned, never inferred.
- **`requireAdminAction(request, db, { action, target, reason, requestId, role?, previousState?,
newState? })`** — for writes. Does everything `requireAdminSession` does, plus: requires
  step-up (`requireRecentAuthentication`), requires a non-empty `reason` (≥3 chars, SRS §28.3 —
  every administrative action must be justified), applies a strict per-IP rate limit distinct
  from any other surface (60/hour), and **writes the audit-log entry itself** so no call site can
  forget to. Do the actual mutation only after this resolves, and pass the real `previousState`/
  `newState` you're about to change — the audit log is the only durable record of what an admin
  did and why (SRS §28's operational-log requirement), so a call site that skips these fields
  makes that entry useless later.

## Never

- Skip `requireAdminAction` for a route that mutates state, even if it "just" flips a boolean —
  every admin write must be reasoned and audited, no exceptions.
- Let an admin act on their own account for a destructive/self-privilege action — see
  `users/[userId]/suspend.ts`'s explicit self-suspend guard. Apply the same guard to any new
  self-targeting action (role revocation, deletion) rather than assuming the chokepoint catches
  it; it doesn't — that check is the route's responsibility.
- Add a new `*_user_id` "who did this" column referencing `users(id)` without `ON DELETE SET
NULL`. Part 3 Step 21 found this exact bug across 12 columns (`crawlers.approved_by_user_id`,
  `admin_audit_logs.administrator_user_id`, `security_events.resolved_by_user_id`, etc.) — the
  default `NO ACTION` throws and aborts the entire daily retention cron the first time an admin
  whose account is later deleted has a historical row anywhere. See
  `docs/data/DATA_RETENTION.md`'s Step 21 section and `docs/data/MIGRATION_POLICY.md` before
  adding any new actor-reference column.
- Assume a narrower role (e.g. `billing_viewer`) can do everything `super_admin` can — check
  `ALL_ADMIN_ROLES` in `../../../lib/admin/roles.ts`; only `super_admin` is actually assignable
  today (SRS §28.18), the other five exist in the data model for later use without a schema
  change, not because they're wired into every route's permission checks yet.

## Billing sub-routes (`subscriptions/`, `transactions/`, `webhooks/`)

Same "Paddle is the source of truth" rule as `../billing/AGENTS.md` applies here too —
`subscriptions/[subscriptionId]/resync.ts` re-fetches from Paddle and overwrites the local cache,
it never lets an admin hand-edit a subscription's state directly. Note the known gap: both
`subscriptions/index.ts` and `transactions/index.ts` (`../../../lib/admin/subscriptions.ts`) use
an `INNER JOIN` to `users` for the owner's name, so a billing customer whose account was later
deleted (`user_id` now `NULL`, per the Step 21 fix) won't appear in either list even though the
row is intact — see `docs/status/KNOWN_RISKS.md`. Fix with a `LEFT JOIN` if you touch these files.

## Registry/ruleset sub-routes (`registry/`)

Publishing a release (`releases/[versionId]/publish.ts`, `rulesets/[versionId]/publish.ts`) must
go through `../../../lib/admin/registry.ts`'s publish flow, which schedules affected domains for
re-evaluation as a side effect (SRS §28.7) — never just flip `is_active` directly with a raw
update. Rollback (`rollback.ts`) is a new forward action (publish the previous version again), not
an edit of the applied version — consistent with migrations being forward-only (ADR-0002); the
same principle applies to registry/ruleset history.
