# AGENTS.md — apps/web/src/pages/api/auth

Passkey/session/recovery-code endpoints (SRS §24, ADR-0004). Read the parent `AGENTS.md` first
for the general API rules; this file only adds what's specific to authentication.

## Never

- Add password or email-based sign-in. The MVP is passkey-only, full stop.
- Trust a client-supplied user/account identifier for an authorization decision. Every
  authenticated route derives its user from `requireSession()` (`../../../lib/auth/require-session.ts`),
  never from a request body field.
- Store a recovery code, session token, or WebAuthn credential in anything but hashed/opaque
  form. `recovery_codes.code_hash` and `passkey_credentials.public_key` are the only persisted
  representations — plaintext codes exist only in the single `generate.ts` response.
- Skip the last-credential check in `removeCredential()` (`../../../lib/auth/credentials.ts`) —
  removing a user's only passkey with no email fallback is a permanent lockout.

## Always

- Route the WebAuthn ceremony challenge through `signToken`/`verifyToken`
  (`../../../lib/auth/webauthn.ts`) — never persist a challenge in a table, and never trust a
  challenge whose signature doesn't verify.
- Gate sensitive actions (`recovery-codes/generate`, `passkeys/*/remove`) behind
  `requireRecentAuthentication()`, not just a valid session (SRS §24: "Sensitive actions shall
  require recent authentication").
- Log both successes and failures worth auditing to `security_events`
  (`../../../lib/auth/rate-limit.ts`'s `recordSecurityEvent`) using one of the fixed
  `event_type` values in `packages/database/migrations/0007_admin_security.sql` — the column has
  a `CHECK` constraint, so an invented type fails the insert outright rather than silently.

## What's implemented vs. pending

Registration, usernameless login, passkey management (add/rename/remove), session
listing/revocation, and recovery-code generate/redeem are implemented and tested. Account
deletion lives in Step 13's account-management endpoints, not here, since it also has to cascade
saved domains/subscriptions.
