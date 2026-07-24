# Authentication Security

Full decision record: [ADR-0004](../architecture/adr/ADR-0004-AUTHENTICATION-STRATEGY.md).
**Implemented in Part 2** (`apps/web/src/lib/auth/`, `apps/web/src/pages/api/auth/`) and covered
by `apps/web/tests/integration/auth-flow.integration.test.ts` (16 tests, using a real WebAuthn
ceremony — a from-scratch ECDSA/CBOR virtual authenticator, not a mock of the crypto).

## Non-negotiables (SRS §24, §6.2)

- Passkeys (WebAuthn) only. No passwords. No email or SMS anywhere in login or recovery.
- Recovery codes: shown once, downloadable, single-use, stored only as SHA-256 hashes
  (`recovery_codes.code_hash`) — see `lib/auth/recovery-codes.ts`.
- Sessions are server-side rows (`sessions` table), not stateless JWTs, so an individual session
  can be revoked and "sign out everywhere" is one query (`revokeSession`/`sessions/revoke-all`).
- Users are encouraged to register at least two passkeys (UI copy in `PasskeysManager.tsx`); a
  passkey can never be removed if it's the account's only one (`removeCredential` in
  `lib/auth/credentials.ts` refuses outright).

## Session cookie requirements

`HttpOnly`, `SameSite=Lax`, `Secure` (except `PUBLIC_APP_ENV=local`, to keep plain-HTTP local dev
working) — see `lib/auth/session.ts`'s `buildSessionCookie`. The cookie value itself is a 32-byte
random opaque token, looked up directly against the `sessions` table on every request — it is
**not** a signed/self-describing token (no JWT, no `SESSION_SIGNING_SECRET` involvement). That
secret is used for a different, narrower purpose: signing the short-lived WebAuthn ceremony
challenge that round-trips through the browser between `begin`/`finish` calls
(`packages/core/src/crypto/signed-token.ts`), which is stateless by design and never touches the
`sessions` table.

## Step-up authentication

Sensitive actions (recovery-code regeneration, passkey removal, account deletion) require a
recent WebAuthn/recovery-code re-assertion, checked against `sessions.last_authenticated_at`
(`requireRecentAuthentication` in `lib/auth/require-session.ts`), before executing — not just a
valid session. The window is 5 minutes.

## Abuse controls

- Recovery-code redemption is rate-limited per IP (5 attempts / 15 minutes,
  `lib/auth/rate-limit.ts`), logged to `security_events` (`recovery_code_failure`) on every
  failed attempt regardless of whether the limit has been hit yet.
- Failed WebAuthn login assertions are logged to `security_events` (`auth_failure`).
- `pending_deletion` accounts can still authenticate (so a deletion request stays cancellable);
  only `status = 'suspended'` blocks login outright — see `login/finish.ts`.

## CSRF

Session cookies are `SameSite=Lax`, which already blocks cross-site POST/PATCH/DELETE in every
modern browser. `requireSession` (used by every authenticated mutating endpoint) adds an
independent Origin/Referer check as a second layer — see `docs/security/THREAT_MODEL.md`'s "Key
mitigations" section for the detail and the accepted residual risk.

## Definition of done for this area

Passkey registration/login integration tests pass against real WebAuthn cryptography and a real
D1 database; recovery-code generate/redeem/rate-limit tests pass; session listing/revocation
works and is ownership-scoped; last-passkey removal is refused server-side; no secret or
credential material appears in any API response, log, or CSV/Atom export.
