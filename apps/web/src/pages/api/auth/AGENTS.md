# AGENTS.md — apps/web/src/pages/api/auth

CrawlPact supports passkeys/WebAuthn and approved federated Google authentication
(ADR-0009). Password authentication, direct email authentication, and magic-link
authentication remain prohibited. Read the parent `AGENTS.md` first for the general API rules;
this file only adds what's specific to authentication.

The Google exception is deliberately narrow and explicitly product-owner-authorized (see
ADR-0009's Context section) — it supersedes only SRS §6.2's "external authentication providers"
prohibition for this one, specific integration. It does not authorize any other external
service, and does not weaken any rule below.

## Never

- Add a password, email-based sign-in, magic link, or any other authentication method beyond
  passkeys and Google. The customer auth surface is exactly these two, full stop.
- Trust a client-supplied user/account identifier for an authorization decision. Every
  authenticated route derives its user from `requireSession()` (`../../../lib/auth/require-session.ts`),
  never from a request body field — this applies to Google account-linking/disconnect too
  (`../../../lib/auth/google-account.ts`'s callers always derive `userId` from the session).
- Store a recovery code, session token, WebAuthn credential, or Google ID/access/refresh token
  in anything but hashed/opaque form (or, for Google tokens, not at all). `recovery_codes.code_hash`,
  `passkey_credentials.public_key`, and `oauth_accounts.provider_subject` are the only persisted
  identity representations — plaintext codes exist only in the single `generate.ts` response, and
  no Google token of any kind is ever written to a table, a log, or an analytics event.
- Skip the last-credential check in `removeCredential()` (`../../../lib/auth/credentials.ts`) —
  removing a user's only passkey with no email fallback is a permanent lockout. The equivalent
  check for Google (`disconnectGoogleAccount` in `google-account.ts`) applies the same principle:
  disconnecting Google is refused unless the account has at least one active passkey.
- Use email to resolve, link, or merge a Google identity onto a CrawlPact account. Google's `sub`
  (subject) claim is the only identity key ever used — see `google-account.ts`'s doc comment and
  ADR-0009 for why an email match can never prove two accounts belong to the same person here.
- Let a Google authentication event set `isAdminSession = true`, or authenticate an account that
  currently has any active administrator role at all — `resolveGoogleSignIn`/
  `resolveOrCreateGoogleSignUp`/`linkGoogleAccount` in `google-account.ts` refuse outright
  (`admin_requires_passkey`) rather than authenticating such an account by any route. Super Admin
  sign-in remains passkey-only, no exceptions.
- Weaken the same-origin Origin/Referer check in `requireSession` for any route other than the
  Google callback (`pages/api/auth/google/index.ts`), which is a deliberate, narrowly-scoped
  exception (Google itself performs the cross-site POST) protected instead by the CSRF/state/
  nonce/token-verification stack described in that file's own doc comment.
- Add a `GOOGLE_CLIENT_SECRET`/`GOOGLE_SECRET` anywhere. This integration uses the GIS ID-token
  flow, which needs only the public `GOOGLE_CLIENT_ID`.

## Always

- Route the WebAuthn ceremony challenge through `signToken`/`verifyToken`
  (`../../../lib/auth/webauthn.ts`) — never persist a challenge in a table, and never trust a
  challenge whose signature doesn't verify. Google ID tokens are verified independently through
  `../../../lib/auth/google.ts`'s `verifyGoogleIdToken` (real JWKS signature verification via
  `jose`, never a decode-and-trust of the JWT payload).
- Gate sensitive actions (`recovery-codes/generate`, `passkeys/*/remove`,
  `account/google/link/begin`, `account/google/disconnect`) behind
  `requireRecentAuthentication()`, not just a valid session (SRS §24: "Sensitive actions shall
  require recent authentication").
- Log both successes and failures worth auditing to `security_events`
  (`../../../lib/auth/rate-limit.ts`'s `recordSecurityEvent`) using one of the fixed
  `event_type` values in `packages/database/migrations/0007_admin_security.sql` — the column has
  a `CHECK` constraint, so an invented type fails the insert outright rather than silently. Google
  auth failures use `auth_failure` with a structured `details.reason` (see `google/index.ts`).
- Map every Google failure (CSRF mismatch, bad/expired/consumed state, invalid token, nonce
  mismatch) to the same generic user-facing outcome — never disclose which specific check failed
  (see `docs/security/GOOGLE_AUTHENTICATION_THREAT_REVIEW.md`).

## What's implemented vs. pending

Registration, usernameless login, passkey management (add/rename/remove), session
listing/revocation, recovery-code generate/redeem, and Google sign-in/sign-up/account-linking/
disconnect (ADR-0009) are implemented and tested. Account deletion lives in Step 13's
account-management endpoints, not here, since it also has to cascade saved domains/subscriptions
(and, for Google, `oauth_accounts`/`oauth_auth_intents` via `ON DELETE CASCADE`, migration 0038).
