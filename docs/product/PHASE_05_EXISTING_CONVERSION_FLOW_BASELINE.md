# Phase 5 — Existing Conversion Flow Baseline

**Level 3 document (Evidence).** Captured before any Phase 5 implementation work, from direct
inspection of the repository at `main` commit `87a69a522dce4b24e676d3c7a26c9396fd2b382b` (Phases
0-4 and the Public Country Reference and Contact Messaging Correction all merged and deployed to
production). Not assumed or reconstructed from memory — every claim below traces to a specific
file and line. Established 2026-08-04.

## Current flow diagram

```
Anonymous visitor
  │
  ▼
AuditForm.tsx (homepage/hero, /audit, free tools)
  │  normalizeTarget() client-side, then POST /api/audit { target, source }
  ▼
POST /api/audit (apps/web/src/pages/api/audit/index.ts)
  │  - normalizeTarget() again server-side
  │  - AUDIT_ENGINE_ENABLED gate, maintenance_mode check
  │  - rate limit: hashIp(request) + isRateLimited (20/day default, D1-backed)
  │  - runAudit() synchronously (no queue), preset hardcoded "maximum_ai_visibility"
  │  - persistScan(): scanId=randomUUID(), domainId=NULL, triggeredBy="anonymous"
  │  - trackEvent "audit_started" / "audit_completed" / "audit_failed"
  ▼
Client: window.location.href = /audit/{auditId}  (full navigation, no in-memory state carried)
  ▼
GET /audit/[auditId].astro
  │  - loadReportViewData(db, auditId) — NO auth/ownership check gates viewing
  │  - getPageSession() called ONLY to decide whether to show ShareReportDialog
  │  - <AuditReportView client:load report={report} .../> — identical component/props
  │    whether viewer is anonymous, an unrelated authenticated user, or the domain's owner
  │  - noindex=true (MarketingLayout prop) + X-Robots-Tag: noindex,nofollow,noarchive
  │    (middleware.ts, matches /audit/* prefix)
  ▼
AuditReportView.tsx renders: score, crawler matrix, findings, recommendations, limitations,
  optional signals, "Print report" button, conditional "Copy proposed robots.txt" button.
  NO signup/login/save-domain CTA of any kind exists today.
  ▼
[DEAD END — nothing currently connects this report to account creation or domain saving]
```

Separately, an **authenticated** owner reaches the exact same `/audit/[scanId]` route via a link
from their own domain dashboard (`apps/web/src/pages/app/domains/[domainId].astro:39-42,76`:
`href={`/audit/${domain.lastScanId}`}` and `href={`/audit/${scan.scanId}`}`) — confirming
`AuditReportView` is genuinely the **one shared report renderer** for anonymous, unowned, and
owned scans alike. There is no separate anonymous-report vs. authenticated-report route or
component.

## 1. Anonymous audit flow

- **Entry points**: `apps/web/src/pages/audit/index.astro` (dedicated landing page) and every
  embedding of `apps/web/src/components/AuditForm.tsx` (homepage hero, final CTA, `/audit`, free
  tool pages via a `focus` prop).
- **Domain normalisation**: `normalizeTarget()` from `@crawlpact/core`
  (`packages/core/src/domain/normalize.ts`), called both client-side (form) and server-side
  (`api/audit/index.ts:53`) — the single canonical normaliser, reused for saved-domain creation
  too (see §3).
- **Anonymous identity**: **none exists.** No cookie, no anonymous session ID, no localStorage
  token, no fingerprint. The only per-caller correlation is `hashIp(request)`
  (`apps/web/src/lib/ip-hash.ts:11-24`, HMAC-SHA256 of `CF-Connecting-IP` keyed by
  `SESSION_SIGNING_SECRET`), used solely for the daily rate limit — never for identity or
  continuity.
- **Persistence**: `scanId = crypto.randomUUID()`, `domainId: null`, `triggeredBy: "anonymous"`
  (`apps/web/src/lib/persist-scan.ts:33-58`). Anonymous and owned scans share one `scans` table,
  distinguished only by `domainId IS NULL`.
- **Retention**: 24 hours to 7 days (`docs/data/DATA_RETENTION.md`), enforced by
  `purgeAnonymousScans()` (`apps/web/src/lib/data-retention.ts`), run daily from the cron
  `scheduled()` handler. **Any conversion mechanism that lets a user return after signup must
  account for the scan already being purged.**
- **Report route**: `apps/web/src/pages/audit/[auditId].astro` — one route, no auth gate on
  viewing, `noindex` via both meta and header.
- **`AuditReportResponse` fields** (`packages/core/src/api/contracts/audit.ts:198-216`): `auditId,
domain, scanDate, status, preset, score, crawlerMatrix, findings, registryVersion,
rulesetVersion, limitations, llmsTxt, llmsFullTxt, rsl, contentSignals, robotsMeta`. No
  `domainId`/owner field is ever exposed in the report payload itself — ownership must be checked
  server-side, separately, if a page needs to vary UI by viewer/owner.
- **Existing CTAs**: only "Print report" and a conditional "Copy proposed robots.txt" button
  (`AuditReportView.tsx`). **No account-conversion CTA of any kind exists today** — this is the
  primary gap Phase 5 closes.
- **URL guessability**: `auditId` is a cryptographically random UUIDv4, not sequential — not
  brute-forceable, but also not access-controlled (anyone with the link can view indefinitely
  until retention purge, a pre-existing, deliberate, already-documented design per Phase 3's
  completion report).

## 2. Authentication

- **Mechanism**: passkey/WebAuthn only — no password, no email field anywhere, ever
  (`apps/web/src/pages/api/auth/AGENTS.md`: "Never add password or email-based sign-in").
- **One page, two tabs**: `apps/web/src/pages/sign-in.astro` renders
  `<PasskeyAuth client:load />` with **zero props** — sign-up and sign-in are tabs
  (`"signin" | "signup" | "recovery"`) inside one component, not separate routes.
- **Session**: cookie `crawlpact_session` (`apps/web/src/lib/auth/session.ts:6`), 30-day TTL (12h
  for admin sessions), opaque 32-byte random token that **is itself** the `sessions.id` primary
  key (no separate JWT-style signature — validity is "does a non-expired, non-revoked D1 row with
  this id exist"). `HttpOnly`, `SameSite=Lax`, `Secure` outside local dev.
  `SESSION_SIGNING_SECRET` is **not** used for session cookies — only for IP hashing and WebAuthn
  ceremony challenge tokens (see §"Reusable precedent" below).
- **Return-URL handling: does not exist.** `PasskeyAuth.tsx:20` has a `redirectTo` prop
  defaulting to `/app`, but **no caller anywhere passes a non-default value** — `sign-in.astro`
  never reads `Astro.url.searchParams`. This is genuinely greenfield, not a partial existing
  implementation: no open-redirect allowlist exists because nothing user-controllable is ever
  passed to it yet.
- **CSRF**: `assertSameOrigin()` (`apps/web/src/lib/auth/require-session.ts:25-41`) — Origin (or
  Referer fallback) must match `PUBLIC_SITE_URL`'s origin for any non-safe method. Runs inside
  `requireSession()`, so every authenticated mutating route gets it automatically. The anonymous
  `POST /api/audit` route does **not** call `requireSession` and has no Origin check — consistent
  with being intentionally public.
- **Session fixation**: every successful auth event calls `createSession()`, which always mints a
  brand-new random token — there is no "upgrade a pre-existing anonymous session" code path
  because no anonymous session exists to upgrade. Not currently a live risk, but any new
  anonymous-continuity state Phase 5 introduces is new attack surface requiring its own
  rotation/expiry design (not inherited from an existing pattern).
- **Already-authenticated redirect away from `/sign-in`: does not exist.** `sign-in.astro`
  (27 lines, read in full) has no session check at all, unlike every `/app/*` page which does
  `if (!result) return Astro.redirect("/sign-in")`.

## 3. Saved domains

- **Endpoint**: `POST /api/domains` (`apps/web/src/pages/api/domains/index.ts`),
  `requireSession`-gated. Request: `{ target, displayName?, groupId?, preset? }`
  (`packages/core/src/api/contracts/domains.ts:20-25`). Success (201): `{ domainId, displayName,
canonicalOrigin }` — **no score, no `lastScanId`, no monitoring state in the response.**
- **Duplicate handling**: DB-enforced via a partial unique index
  `idx_domains_owner_origin_live` on `(owner_user_id, canonical_origin) WHERE deleted_at IS NULL`
  (migration `0017`), plus an app-level pre-check (`findExistingByOrigin`,
  `apps/web/src/lib/domains.ts:87-104`) that returns a clean `DOMAIN_DUPLICATE` (409) instead of a
  raw constraint error. Uniqueness is scoped **per-owner** — a second account can freely save the
  same public domain; `findExistingByOrigin` only ever queries the calling user's own rows, so
  **nothing about another account's saved/monitoring state is ever leaked.**
- **Plan limit**: `countActiveDomains(db, userId) >= plan.savedDomainLimit` →
  `DOMAIN_LIMIT_REACHED` (403), message built from the real per-plan limit.
- **Monitoring is automatic, not opt-in, at domain-creation time**: `createDomain()` always
  inserts `monitoringState: "active"` (`domains.ts:147`) — but it's functionally inert on plans
  with `monitoringFrequency: "none"` (free plan), since the sweep filter excludes those
  (`apps/web/src/lib/monitoring.ts:55`). `nextScanAt` starts `NULL`.
- **No adoption path exists for anonymous scans**: `createDomain()` has no `scanId`/`auditId`
  field at all. `domains.lastScanId` is only ever set later, by a genuinely fresh scan
  (`recordScanOnDomain()`, called from the manual re-scan route). **Saving a domain today always
  requires a brand-new scan — the anonymous report's already-computed data is never reused.**
  Phase 5's baseline-adoption design (see the dedicated policy doc) closes this gap via a
  guarded, idempotent `UPDATE scans SET domain_id = ... WHERE id = ? AND domain_id IS NULL`
  rather than duplicating report data.
- **Plan values** (from `packages/database/seed/reference-data.sql`, matching migration `0001`):

  | plan   | savedDomainLimit | monitoringFrequency | historyRetentionDays |
  | ------ | ---------------- | ------------------- | -------------------- |
  | free   | 1                | none                | 30                   |
  | solo   | 5                | monthly             | 365                  |
  | pro    | 25               | weekly              | 730                  |
  | agency | 100              | weekly              | 1095                 |

- **Success destination today**: no redirect at all — the existing `DomainsManager.tsx` UI just
  clears the input and re-fetches the same list (`/app/domains`). No "first domain saved"
  celebratory state exists anywhere.
- **`getPlan()`** resolves from `user.planId` (a denormalised column, kept in sync by the billing
  webhook processor) — a single indexed D1 read, never a live Paddle call.

## 4. Analytics

- First-party only (`apps/web/src/lib/analytics.ts`, SRS §33/Part 2 Step 18) — one row per event
  in `product_events`, no third-party vendor, no pixel.
- `PRODUCT_EVENT_NAMES` is a closed union (`analytics.ts:13-37`) — any new Phase 5 event name
  must be added to this literal array.
- `trackEvent(db, eventName, { userId?, anonymousId?, properties? })` — `anonymousId` exists in
  the signature but **no current call site populates it anywhere in the codebase.** No convention
  exists yet for correlating a pre-signup anonymous view with a post-signup event.
- `POST /api/analytics/track` (the client beacon) accepts anonymous callers (session optional),
  validates `eventName` against `isProductEventName()`, and has **no rate limiting or CSRF check
  at all** (doesn't call `requireSession`) — a pre-existing, undocumented gap, not something Phase
  4/prior phases introduced or fixed.
- **Google Analytics is not scoped to "marketing pages only"** — it's scoped to
  `MarketingLayout.astro` at `PUBLIC_APP_ENV === "production"`
  (`apps/web/src/components/GoogleAnalytics.astro`,
  `apps/web/src/layouts/MarketingLayout.astro:36-37,52`). Both `/audit/[auditId].astro` and
  `/sign-in.astro` use `MarketingLayout`, so **GA currently loads on both the anonymous report
  page and the sign-in page in production** — a known, disclosed, deliberate deviation
  (`docs/status/KNOWN_RISKS.md:37`), not something Phase 5 should silently "fix," but relevant
  context: any new first-party event on these two pages co-occurs with a GA page-view beacon.
- `account_started` fires client-side with **no properties** on switching to the signup tab
  (`PasskeyAuth.tsx:177`); `account_created` fires server-side with only `{ userId }`
  (`register/finish.ts:66`). The established convention in this codebase is minimal/no
  `properties` payloads — Phase 5's new events should follow the same restraint.

## 5. Data retention and reusable ephemeral-token precedent

- `product_events`/`security_events`/`notifications` have no purge job — a known, accepted,
  **open** risk (RISK-006, `docs/risks/ACTIVE_RISKS.md`, status `monitoring`, target Phase 11).
  Not Phase 5's job to fix; worth noting since Phase 5 adds event volume.
- **Reusable precedent for a short-lived, secure continuation mechanism**:
  `packages/core/src/crypto/signed-token.ts` — `signToken(payload, secret, ttlSeconds)` /
  `verifyToken()`, HMAC-SHA256 (Web Crypto), base64url, no DB row needed. Used today for WebAuthn
  ceremony challenges (5-minute TTL, `apps/web/src/lib/auth/webauthn.ts:25`), with an explicit
  documented discipline: "the token deliberately carries no user identity — the caller decides
  which user a completed ceremony belongs to from trusted server-side state, never from the
  echoed token" (`webauthn.ts:42-48`). A second, heavier pattern exists for **revocable/listable**
  tokens (`apps/web/src/lib/sharing.ts` share links, `apps/web/src/lib/auth/recovery-codes.ts`) —
  random bytes, **hashed** (not HMAC-keyed) before storage, DB-backed with an `expiresAt` column.
  Phase 5's continuation record (needs an explicit, testable "already consumed" state — see the
  baseline-adoption policy doc) is closer to this second pattern's shape, but low-stakes enough
  (worst case: a public domain gets saved to the wrong account) that the token itself can be
  stored raw (matching session tokens' own precedent) rather than hashed like a recovery code.

## 6. Existing test coverage (files, not full contents)

**Integration** (`apps/web/tests/integration/`): `audit-api`, `audit-abuse-prevention`,
`audit-report-signals`, `auth-flow` (full passkey lifecycle, session revocation, recovery codes),
`domains-flow` (save/duplicate/limit/cross-account-denial/soft-delete-resave), `monitoring`
(sweep, drift detection, failure backoff), `notifications-flow`, `analytics-sharing` (event
recording, allowlist rejection, share tokens), `csrf` (Origin/Referer enforcement), `data-retention`
(anonymous-scan purge, plan-tier history purge, account deletion cascade).

**E2E** (`apps/web/tests/e2e/`): `auth-and-account` (register/sign-out/sign-in, save+scan, account
deletion+cancel, recovery-code sign-in, anonymous-report print), `homepage-conversion`,
`admin-flows`, `pay`, `landing-page`, `responsive-smoke`, `seo-metadata` (confirms `/audit/*` and
`/sign-in` are noindex), `trust-pages`.

**Confirmed gaps**: no open-redirect test exists anywhere (`grep` for `open.redirect` returns
zero matches); no session-fixation-specific test exists (session revocation is tested, rotation
across a privilege-elevation event is not). `csrf.integration.test.ts` is the closest structural
template to follow for new security tests (real D1 harness, direct route-handler invocation via
`ctx(jsonRequest(...))`).

**Accessibility**: `apps/web/tests/a11y/home.spec.ts` — a flat `ROUTES` array looped through
`AxeBuilder` (`wcag2a`/`wcag2aa`/`wcag22aa`), plus a separate `describe("authenticated routes")`
block using WebAuthn virtual-authenticator helpers for session-gated pages. `/audit/[auditId]` is
not currently in either — any new authenticated Phase 5 page follows the `authenticated routes`
pattern.

## Transition points requiring explicit design (per the Phase 5 prompt's own instruction not to

begin implementation before identifying all of them)

1. Report page → CTA click (report page must gain viewer-context awareness: is this scan already
   claimed by the current viewer's own domain, by someone else's, or by no one).
2. CTA click → sign-in page (must carry intent without a query-string secret payload).
3. Sign-in page → passkey ceremony → post-auth redirect (must carry the same intent through a
   client-rendered, no-full-navigation flow).
4. Post-auth redirect → handoff route (must re-validate everything server-side; must never trust
   the continuation payload as the source of truth for plan/entitlement facts).
5. Handoff route → baseline decision (adopt vs. rerun — see the dedicated policy document).
6. Handoff route → monitoring onboarding (only when plan-entitled).
7. Handoff/monitoring → first-success state → domain dashboard.
8. Every failure mode along this chain (expired/invalid/consumed continuation, plan limit,
   duplicate domain, scan purged, auth cancelled/failed) needs its own explicit, non-leaky state.
