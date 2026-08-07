# Phase 10 — Notification and Monitoring Reliability Threat Review

## Notification insert failure corrupting scan state

**Fixed.** Pre-Phase-10, this was a real, exploitable-by-accident bug (see
`docs/architecture/NOTIFICATION_RELIABILITY_ARCHITECTURE.md`). Now structurally prevented — the
notification write happens strictly after monitoring-truth commit, in its own try/catch. Proven:
`monitoring-outcome-isolation.integration.test.ts`.

## Notification duplicate under retry / concurrent processing

**Mitigated** by `idx_notifications_user_dedupe` (D1-level unique constraint), not just an
application check. Proven under real `Promise.all` concurrency:
`notification-dedupe-reconciliation.integration.test.ts`'s "enforces uniqueness at the D1 level even
bypassing the application check" test (5 concurrent identical inserts → exactly 1 row).

## Reconciliation duplicate

**Mitigated.** Checked against `notifications` by `(source_type, source_id)` before any insert, and
`createNotificationOnce` itself is idempotent at the D1 level as a second safety net. Proven:
reconciliation's "idempotent: running it again creates nothing new" assertion in
`monitoring-outcome-isolation.integration.test.ts`.

## Cross-account notification access / mark-read IDOR / notification-ID enumeration

**Not newly introduced; preserved.** `listNotifications`/`markNotificationsRead`/
`markAllNotificationsRead` all scope every query by the session's own `userId` — never a
client-supplied one. Proven: `notifications-flow.integration.test.ts`'s "never leaks another user's
notifications" test (pre-existing, unaffected by Phase 10) plus the new group-filter path
(`pages/api/notifications/index.ts`), which resolves `groupId` → domain ids scoped by
`ownerUserId = user.id` before ever touching `listNotifications` — a group filter can never widen
scope to another account's domains.

## Feed-token brute force / leakage / logging / referrer leakage

**Preserved, unchanged token security** (256-bit CSPRNG, hash-at-rest, never logged, never in
analytics — confirmed by reading every Phase 10 `trackEvent` call site, none pass a token).
`Referrer-Policy: no-referrer` newly added this phase closes the one gap that existed before (no
referrer policy at all on the feed response) — a link followed _from_ the feed reader UI could
otherwise leak the URL (and thus the token) via the `Referer` header to whatever site that link
points to.

## Feed entitlement bypass / downgrade stale token

**Fixed** — this was a real pre-Phase-10 gap (entitlement checked only at issuance). Now re-checked
on every read. Proven: `atom-feed-hardening.integration.test.ts`'s downgrade test.

## Feed XML injection / stored XSS through domain names or notification body

**Preserved and extended.** `escapeXml` (feed route) unchanged and still applied to every
interpolated field. React's default text-node rendering (never `dangerouslySetInnerHTML`, confirmed
by reading `NotificationsManager.tsx`) escapes the in-app centre equivalently. No new
interpolation point was added without going through one of these two paths.

## Unsafe deep link / open redirect

**Not possible by construction.** `action_path` is always server-generated
(`/app/domains/${domain.id}`), never client-supplied or stored as an arbitrary external URL — there
is no code path that accepts a URL from anywhere but the fixed template.

## CSRF

**Preserved.** All mutating notification/feed-token routes go through `requireSession`, which
already performs same-origin CSRF checking for mutating methods (pre-existing,
`lib/auth/require-session.ts`) — unchanged by Phase 10.

## Atom cache leak / shared proxy caching

**Fixed.** `Cache-Control: private, no-store` newly added this phase — previously absent entirely,
meaning a shared proxy or browser cache could have retained a private feed response. Proven:
`atom-feed-hardening.integration.test.ts`'s headers test.

## Reconciliation resource exhaustion

**Bounded.** `lookbackMinutes` (time) and `batchSize` (row count) both cap the work per run; proven
bounded via the lookback test in `notification-dedupe-reconciliation.integration.test.ts`.

## Notification storm / registry-release notification storm / monitoring retry storm

**Prevented by design**, not by a rate limiter: policy-change notifications are keyed to individual,
already-deduped `domain_change_events`; registry-driven notifications only fire per-domain when that
domain's own evaluation crosses `high_attention` (never account-wide on a bare registry release —
see `PHASE_10_NEW_CRAWLER_NOTIFICATION_DECISION.md`); failure notifications collapse to one row per
episode regardless of how many failures occur.

## Claim-lock race

**Preserved, unaffected.** `claimDueDomains`'s existing conditional-UPDATE claim mechanism
(Phase 11) is untouched by Phase 10 — notification generation happens entirely after a domain is
already claimed and scanned, outside the claim race window.

## Platform failure incorrectly treated as target failure / monitoring auto-pause caused by CrawlPact error

**Fixed** — the core Phase 10 classification fix. Proven:
`monitoring-outcome-isolation.integration.test.ts`'s two platform-failure tests (never increments
`consecutiveFailureCount`, never reaches the pause threshold no matter how many times it recurs).

## Queue replay

**Not applicable** — this codebase has no queue infrastructure (Phase 11 confirmed and Phase 10 did
not add one); the daily-cron `ctx.waitUntil()` model has no replay semantics to exploit.

## Operational metrics leaking customer data

**Verified clean.** `GET /api/admin/capacity`'s new `monitoring`/`notifications` fields are all
aggregate counts (`Number`) or a single job-status object with no customer-identifying fields — no
raw feed tokens, no private report tokens, no per-user breakdowns. Confirmed by reading every new
field added to `OperationalCapacitySnapshot`.

## Target-controlled content security (domain display names in notification/feed text)

**Preserved.** Domain display names are user-supplied at save time (existing validation, unchanged)
and always escaped at render (React) and at feed-XML-generation (`escapeXml`) — treated as untrusted
throughout, matching the existing pattern for every other place a domain name is rendered in this
app.
