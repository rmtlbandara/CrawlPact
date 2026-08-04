# Phase 5 threat review: anonymous audit result and account-conversion flow

Scope: the new surface added in Phase 5 — `audit_continuations` (migration
`0020_audit_continuations.sql`), `POST /api/audit/:auditId/continuation`,
`POST /api/audit/continuation/:continuationId`, `/app/continue`, the
continuation-aware branch of `/sign-in`, and `isSafeRelativeRedirect()`. It does
not re-review authentication, billing, or the existing manual "add a domain"
flow, all of which are unchanged.

## What this flow lets an anonymous visitor do

Before Phase 5, an anonymous visitor could run a public audit and view the
report — full stop, no state carried anywhere. Phase 5 adds exactly one new
capability: a visitor can click a CTA on that report to create a
short-lived, opaque, single-use record (`audit_continuations`) that lets an
account they create or sign into _afterwards_ claim the domain and its
already-computed scan as their own. The record carries no report content —
only `scan_id`, `canonical_origin`, and `intended_action`
(`save_and_monitor` | `save_only`).

## Design decisions and why

**DB-backed record, not a stateless signed token.** The codebase's existing
ephemeral-token precedent (`packages/core/src/crypto/signed-token.ts`, used
for WebAuthn ceremony challenges) is a stateless HMAC token — it can prove
"this was issued by us and hasn't expired," but it cannot prove "this has
never been redeemed before," because there's no server-side record to check
against. This flow's required test scenarios explicitly distinguish
"expired" from "already consumed" from "replayed" — three distinct states a
stateless token cannot represent on its own. A DB row with a nullable
`consumed_at` can.

**Consumption is a single atomic conditional UPDATE, not read-then-write.**
`consumeContinuation()` (`apps/web/src/lib/audit-continuation.ts`) does:

```sql
UPDATE audit_continuations
SET consumed_at = ?
WHERE id = ? AND consumed_at IS NULL AND expires_at > ?
RETURNING *
```

Two concurrent completion attempts (a double-click, or the same link opened
in two tabs) can both reach the handler, but only one `UPDATE` can match the
`consumed_at IS NULL` guard — the loser gets zero rows back and a `false`
result, never a redundant domain save. This is the same compare-and-swap
discipline used to fix a real production race in the billing webhook
processor this same release cycle (`docs/status/BILLING_WEBHOOK_RACE_TEST_FLAKE.md`)
— TOCTOU windows in this codebase get closed with a single conditional
statement, not a lock or a re-check.

**The continuation id is stored raw, not hashed.** `sharing.ts` and
`recovery-codes.ts` hash their tokens at rest because a leaked row (a DB
dump, a logging accident) would otherwise hand out a live, unlimited-use
credential. A leaked `audit_continuations` row is much lower stakes: the
worst case is that `canonicalOrigin` — a domain, already public in the
report URL itself — gets saved into the wrong account, which the schema
already treats as an acceptable, silent, low-harm outcome (see "claim not
copy" below). Hashing would only protect against reading the id back out of
a compromised DB, which doesn't change the report's public content and
doesn't grant broader account access. Given that, raw storage was judged
not worth the extra lookup complexity.

**Adoption is a claim, not a copy.** `establishBaseline()`'s adopt path is
`UPDATE scans SET domain_id = ? WHERE id = ? AND domain_id IS NULL`. This
solves two things in one statement: it's the same CAS pattern that makes a
concurrent double-adoption impossible, and it means the report itself is
never duplicated or re-scored for a different owner. If someone else's
account already claimed the scan before this request runs, the loser
silently falls through to a fresh rerun scoped to their own account —
nothing about the winner is revealed, and the loser's account only ever
sees data it caused to exist.

**Monitoring is never auto-enabled by this flow, regardless of
`intendedAction`.** `POST /api/audit/continuation/:continuationId` always
calls `updateDomain(..., { monitoringState: "paused" })` immediately after
creating a domain, before returning. `intendedAction` is stored only to
drive the confirmation screen's copy — the actual activation is a distinct,
later, explicit "Enable monitoring" click that PATCHes
`monitoringState: "active"` through the pre-existing
`PATCH /api/domains/:domainId` route. This is a deliberate, narrower reading
of "monitoring activation requires explicit user intent" than "whatever the
CTA said" — a stated intent from before the visitor even had an account is
treated as a hint for the UI, not as consent for a state change with
ongoing effects (repeated scans, notifications). This does not touch
`createDomain()`'s own unconditional `monitoringState: "active"` default for
the pre-existing manual "Add a domain" flow in `DomainsManager` — that is a
distinct, already-shipped surface, out of this phase's scope.

## The completion step requires one explicit click — never fires on page load

`/app/continue` performs a **read-only** peek at the continuation (mirroring
`sign-in.astro`'s own read-only peek) purely to render display copy. The
actual mutating call — `POST /api/audit/continuation/:continuationId`,
which consumes the continuation and saves/reruns the domain — only ever
fires from the client-side "Confirm and save" button click
(`AuditConversionHandoff.tsx`), never automatically on mount.

This matters because of a scenario worth naming explicitly: an attacker can
run their own anonymous audit of a domain they control, click "Save," and
obtain a continuation id for it — a continuation is not bound to any
particular account, by design (anonymous creation has no account to bind
to). If completion fired automatically on page load, a lured top-level
navigation (e.g. a link sent to a signed-in CrawlPact user) to
`/app/continue?continuation=<attacker's own id>` would silently spend one of
the victim's saved-domain slots and start a scan of a domain they never
chose to save — using only their existing session, no interaction beyond
following a link. `requireSession()`'s `assertSameOrigin` CSRF check does
not defend against this: the mutating request would genuinely originate
from CrawlPact's own page, with a correct `Origin` header, because the
victim's browser really did navigate there.

Requiring one visible "Save `<domain>`?" confirmation screen before the
mutation runs closes this: the victim sees exactly what they're about to
agree to (which domain, which account) and can decline. This costs one
click beyond what a fully automatic handoff would need; it does not conflict
with "low-friction," which the rest of the flow (no required tab clicks, no
second continuation-domain field, no extra survey step) already delivers.

## Open-redirect protection

`isSafeRelativeRedirect()` (`apps/web/src/lib/auth/safe-redirect.ts`) is the
first place this codebase ever accepts a client-influenced redirect target
(`PHASE_05_EXISTING_CONVERSION_FLOW_BASELINE.md` confirmed no prior
mechanism existed). It is applied in exactly one place: `sign-in.astro`
computing its own `redirectTo`, which is always one of two fixed shapes
(`/app` or `/app/continue?continuation=<id>`) — never a value read directly
from a query parameter. The function itself is defensive regardless
(rejects absolute URLs, protocol-relative `//`, backslash-normalisation
tricks, anything that doesn't round-trip through `new URL()` to the same
origin) so it stays correct even if a future caller does start passing in
untrusted input. 9 unit tests in `safe-redirect.test.ts` cover this,
including the encoded-slash edge case.

## Rate limiting

`POST /api/audit/:auditId/continuation` is reachable anonymously and
performs a real DB write (an `INSERT`), so it is rate-limited by IP the same
way `POST /api/audit` itself is (`isRateLimited(db, "rate_limit", ipHash,
{ scope: "audit_continuation" })`, default 40/day, tunable via
`runtime_configuration` without a redeploy) — a distinct scope so it never
shares a budget with the anonymous-audit-creation counter. This closes a gap
that exists elsewhere in the codebase today: `POST /api/analytics/track` has
no rate limiting at all (confirmed during Phase 5's investigation and
recorded in `PHASE_05_EXISTING_CONVERSION_FLOW_BASELINE.md`); that is a
pre-existing, out-of-scope condition this phase does not fix, but this new
endpoint does not repeat it.

`POST /api/audit/continuation/:continuationId` requires a session
(`requireSession()`), so it inherits that route's existing session-level
protections; it has no separate rate limit of its own beyond the natural
one-shot nature of continuation consumption (a given continuation id can
only ever succeed once).

## Cross-account behaviour is intentional, not a leak

Any signed-in user who completes a given continuation id saves that domain
to _their own_ account — continuations are not bound to whoever created
them, since the creator had no account yet. This is by design: the report
content (already fully public) is unaffected, and the "claim not copy"
adoption logic guarantees the second account to complete a given scan never
sees anything about the first. `audit-conversion.integration.test.ts`'s
"falls back to a rerun... once the scan is already claimed by a different
account" test exercises exactly this and asserts the two accounts end up
with distinct domain rows.

## What this phase deliberately does not change

No pricing, Paddle, plan-limit, crawler-evaluation, or notification-channel
logic was touched. `PATCH /api/domains/:domainId` (used to actually enable
monitoring) is unchanged — its own plan-entitlement behaviour, whatever it
is today, is out of scope here; the new UI only chooses whether to _offer_
the "Enable monitoring" control based on `plan.monitoringFrequency !==
"none"`, it does not add or remove server-side enforcement.
