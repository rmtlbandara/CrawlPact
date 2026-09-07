# Authentication Security

Full decision record: [ADR-0004](../architecture/adr/ADR-0004-AUTHENTICATION-STRATEGY.md)
(passkeys) and [ADR-0009](../architecture/adr/ADR-0009-GOOGLE-FEDERATED-AUTHENTICATION.md)
(Google federated authentication). **Passkeys implemented in Part 2** (`apps/web/src/lib/auth/`,
`apps/web/src/pages/api/auth/`) and covered by
`apps/web/tests/integration/auth-flow.integration.test.ts` (16 tests, using a real WebAuthn
ceremony — a from-scratch ECDSA/CBOR virtual authenticator, not a mock of the crypto). **Google
implemented alongside ADR-0009** (`lib/auth/google.ts`, `lib/auth/google-account.ts`,
`lib/auth/oauth-intent.ts`, `pages/api/auth/google/**`, `pages/api/account/google/**`) — status
is `implemented-local`, see
`docs/deployment/GOOGLE_AUTHENTICATION_DEPLOYMENT_CHECKLIST.md` for what remains before
production/preview verification.

## Current customer authentication model

```
Customer authentication:
- passkey/WebAuthn
- Google federated authentication (ADR-0009)
- recovery-code fallback

No:
- password
- direct email login
- magic link

Super Admin authentication:
- passkey/WebAuthn only, no exceptions
- existing admin role/session requirements (unchanged)
- existing minimum-passkey controls (unchanged)
```

A Google-authenticated person is exactly one row in `users` — the same account model, plans,
sessions, and entitlements as a passkey-created account, never a second identity system. A
Google-only account is not "missing" a passkey in any deficient sense; it simply hasn't added one
yet, and the UI treats that as a normal, valid state.

## Non-negotiables (SRS §24, §6.2 as amended by ADR-0009)

- Passkeys (WebAuthn) and Google are the only two customer authentication methods. No passwords.
  No email or SMS anywhere in login or recovery. §6.2's "external authentication providers"
  prohibition is superseded only for this one, explicitly authorized Google integration — see
  ADR-0009's Context section; every other §6.2 category is unaffected.
- Google authentication never touches Super Admin sign-in — an account with any active
  administrator role is refused Google sign-in/sign-up/linking outright, not merely prevented
  from an admin _session_ (`lib/auth/google-account.ts`'s `isAdminAccount` check, exercised by
  every resolution path).
- Recovery codes: shown once, downloadable, single-use, stored only as SHA-256 hashes
  (`recovery_codes.code_hash`) — see `lib/auth/recovery-codes.ts`.
- Sessions are server-side rows (`sessions` table), not stateless JWTs, so an individual session
  can be revoked and "sign out everywhere" is one query (`revokeSession`/`sessions/revoke-all`).
  Google authentication issues sessions through this exact same infrastructure — Google's own ID
  token is never treated as, or stored inside, a CrawlPact session.
- Users are encouraged to register at least two passkeys (UI copy in `PasskeysManager.tsx`); a
  passkey can never be removed if it's the account's only one (`removeCredential` in
  `lib/auth/credentials.ts` refuses outright). The same principle applies to disconnecting Google
  (`disconnectGoogleAccount` in `lib/auth/google-account.ts`): refused unless the account has at
  least one active passkey.
- Google's `sub` (subject) claim is the only identity key ever used to resolve/link an account —
  never email. See `docs/security/GOOGLE_AUTHENTICATION_THREAT_REVIEW.md`'s "email-based account
  takeover" row for why an email match can never prove two accounts belong to the same person.

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

`POST /api/auth/google` (`pages/api/auth/google/index.ts`) is the one deliberate, narrowly-scoped
exception: Google itself performs the cross-site POST to this endpoint by design, so the
Origin/Referer check would reject every legitimate call. It is protected instead by three
independent layers — Google's own `g_csrf_token` double-submit cookie, a server-issued one-time
`state`/`nonce` (`lib/auth/oauth-intent.ts`, only SHA-256 hashes ever persisted), and full
cryptographic ID-token verification (`lib/auth/google.ts`) — see
`docs/security/GOOGLE_AUTHENTICATION_THREAT_REVIEW.md` for the complete threat table. No other
endpoint's Origin/Referer check is weakened because of this exception.

## Google federated authentication

See [ADR-0009](../architecture/adr/ADR-0009-GOOGLE-FEDERATED-AUTHENTICATION.md) for the full
decision record and `docs/security/GOOGLE_AUTHENTICATION_THREAT_REVIEW.md` for the threat table.
Summary of what's structurally different from passkeys: Google's `sub` claim (never email) is the
identity key, mapped 1:1 to a `users.id` via `oauth_accounts` (migration 0038); no Google
token of any kind is ever stored; an account with any active administrator role cannot
authenticate, sign up, or link via Google under any circumstance; disconnecting Google is refused
unless the account retains at least one active passkey.

## Definition of done for this area

Passkey registration/login integration tests pass against real WebAuthn cryptography and a real
D1 database; recovery-code generate/redeem/rate-limit tests pass; session listing/revocation
works and is ownership-scoped; last-passkey removal is refused server-side; no secret or
credential material appears in any API response, log, or CSV/Atom export. Google: ID-token
verification tests pass against a local test JWKS (no live Google network dependency);
CSRF/state/nonce/replay integration tests pass against a real D1 database; sign-in never creates
an account for an unlinked identity; sign-up is idempotent; linking/disconnect/admin-isolation
tests pass; no Google token, state, or nonce appears in any log, API response, or analytics
event.
