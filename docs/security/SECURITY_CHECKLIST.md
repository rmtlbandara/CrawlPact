# Security Checklist

Launch-blocking items from SRS §33, tracked against current status. Re-verified end of Part 3
(Step 24) against actual code, not carried forward from the Part 2 draft — two claims below were
found stale and corrected (administrative audit logs, production/preview separation). Both of
Step 24's own new findings (two-passkey admin minimum, preview D1 separation) were fixed in Step
26 — see the "Fixed" note below the table rather than the old "still open" framing.

| Control                                                    | Status                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SSRF protection (safe-fetch chokepoint, IP classification) | ✅ `packages/scanner` — classification + fetch orchestration + redirect revalidation, unit-tested                                                                                                                                                                         |
| DNS and redirect validation                                | ✅ DoH resolution, per-address IP classification, per-hop redirect revalidation                                                                                                                                                                                           |
| Body-size / timeout / request-count limits                 | ✅ Enforced in `safe-fetch.ts`/`orchestrator.ts`, config seeded in `runtime_configuration`                                                                                                                                                                                |
| Escaped target-controlled content                          | ✅ By construction — React/Astro escape by default; no `dangerouslySetInnerHTML`/`set:html` with untrusted content anywhere in the codebase (grep-verified)                                                                                                               |
| Content Security Policy                                    | ✅ `apps/web/src/middleware.ts`, every response — see residual `'unsafe-inline'` note in `docs/security/THREAT_MODEL.md`                                                                                                                                                  |
| Strict Transport Security                                  | ✅ Set in middleware for non-local environments                                                                                                                                                                                                                           |
| Secure cookies                                             | ✅ `HttpOnly; SameSite=Lax; Secure` (except local dev) — `lib/auth/session.ts`                                                                                                                                                                                            |
| Server-side authorisation                                  | ✅ Every domain/group/session/passkey/notification/share query scoped by owner ID in the query itself; covered by ownership-isolation integration tests                                                                                                                   |
| CSRF protection                                            | ✅ `SameSite=Lax` + independent Origin/Referer check on every authenticated mutating request (`assertSameOrigin`), tested in `csrf.integration.test.ts`                                                                                                                   |
| Paddle signature verification                              | ✅ Raw-body HMAC, timing-safe compare, replay-window check — `lib/billing/paddle-webhook.ts`                                                                                                                                                                              |
| Webhook idempotency                                        | ✅ Unique `paddle_event_id`, retry-vs-duplicate distinction, out-of-order protection by `occurred_at`                                                                                                                                                                     |
| Hashed recovery codes                                      | ✅ SHA-256, one-time use, per-IP rate-limited redemption                                                                                                                                                                                                                  |
| Session revocation                                         | ✅ Individual + "sign out everywhere", DB-backed                                                                                                                                                                                                                          |
| CSV formula-injection prevention                           | ✅ `lib/csv.ts`, unit-tested                                                                                                                                                                                                                                              |
| Data retention / purge jobs                                | ✅ Daily cron: anonymous scans (7d), owned scan history (plan-dependent), overdue account deletions — `lib/data-retention.ts`                                                                                                                                             |
| Administrative audit logs                                  | ✅ `requireAdminAction` chokepoint writes an `admin_audit_logs` row for every sensitive action automatically — no call site can skip it; not editable through the interface                                                                                               |
| Dependency scanning                                        | ✅ `pnpm audit` wired into CI (`.github/workflows/ci.yml`)                                                                                                                                                                                                                |
| Secret scanning                                            | ✅ Gitleaks wired into CI (`.github/workflows/ci.yml`)                                                                                                                                                                                                                    |
| Production/preview separation                              | ✅ Fixed in Step 26 — `env.preview` now has its own `d1_databases` block, distinct `PUBLIC_SITE_URL`/`WEBAUTHN_RP_ID`/`WEBAUTHN_RP_ORIGIN` from production (placeholders pending a real preview domain, but structurally separate and never falling back to production's) |
| Super Admin minimum-two-passkeys (SRS §28.20)              | ✅ Fixed in Step 26 — `removeCredential` now refuses to drop an active admin account below 2 registered passkeys (ordinary accounts still only need to keep 1); `auth-flow.integration.test.ts` proves the boundary in both directions                                    |

## Cross-account access controls (SRS §33)

Implemented and tested in Part 2: every authenticated resource (domains, groups, sessions,
passkeys, notifications, shared-report tokens, private feed tokens, CSV export) is fetched with
the owner ID as part of the query's `WHERE` clause, never checked in application code after an
unscoped fetch. Each resource type has a dedicated "cannot see/modify another user's X"
integration test — see `apps/web/tests/integration/*.integration.test.ts`.

## What's still genuinely open (not launch-blocking for the customer product, but real gaps)

- Paddle webhook/portal payload shapes are unverified against a live Paddle account (see
  `docs/security/BILLING_SECURITY.md`) — the single most consequential open item; see
  `docs/status/FINAL_PRODUCTION_READINESS_REPORT.md`.
- CSP still allows `'unsafe-inline'` for scripts/styles (no per-request nonce plumbing yet).
- No cross-request _target_-frequency abuse monitoring (only per-caller rate limits).
- `apps/web/wrangler.jsonc`'s preview `PUBLIC_SITE_URL`/`WEBAUTHN_RP_ID`/`WEBAUTHN_RP_ORIGIN`
  values are structurally correct but still placeholders (`preview.crawlpact.com`) — must be
  updated to the real preview domain the moment one exists, or WebAuthn ceremonies will fail on
  preview (not production, which already has its real domain).
