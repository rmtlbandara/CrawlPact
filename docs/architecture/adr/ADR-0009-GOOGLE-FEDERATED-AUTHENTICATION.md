# ADR-0009: Google Federated Authentication

**Status:** Accepted
**Date:** 2026-09-07

## Context

SRS §6.2 prohibits "external authentication providers," and §24/ADR-0004 established CrawlPact
as passkey-only. This ADR records an **explicit, narrow, product-owner-authorized deviation**
from §6.2 for exactly one addition: Google Sign-In as an _additional_ credential provider
alongside passkeys — not a replacement, and not a general opening for other external auth
providers. The authorization for this specific deviation was given directly by the product
owner in the implementation request that produced this change (a detailed, security-focused
specification explicitly instructing that this supersede §6.2 for Google only, and that the
passkey-only restriction remain intact for every other authentication method — see
`apps/web/src/pages/api/auth/AGENTS.md`'s updated header). Per `CLAUDE.md`'s governance rule,
the SRS still outranks everything except an approved ADR that explicitly records an authorized
deviation — this is that ADR.

Two real product pressures motivated the request: (1) some prospective customers' teams
standardize on Google Workspace SSO and treat passkey-only sign-in as friction; (2) passkey
support, while excellent on modern devices, still has rough edges on some browser/OS
combinations, and Google Sign-In is a well-understood fallback with near-universal reach.

Nothing else about CrawlPact's account/session/entitlement model changes. A Google-authenticated
person is still exactly one row in `users`, using the same plans, sessions, domains, billing, and
monitoring infrastructure as a passkey-created account — Google proves control of a Google
identity, WebAuthn proves control of a passkey, and either may be linked to the same ordinary
account after explicit, authenticated linking.

## Decision

- **Flow**: Google Identity Services (GIS), redirect UX, using the official "Sign In With
  Google" button. No Google One Tap, no automatic sign-in, no authorization-code exchange, no
  access/refresh tokens, no Google API scopes beyond `openid`/`userinfo.email`/`userinfo.profile`.
  No `GOOGLE_CLIENT_SECRET` anywhere — the ID-token flow only needs the public
  `GOOGLE_CLIENT_ID`, already present in `packages/config/src/env.ts`'s schema.
- **Identity key**: Google's immutable `sub` claim, never email. `oauth_accounts` (migration 0038) maps `(provider, provider_subject)` uniquely to one `users.id`; email is stored only as
  provider-account display metadata, never as an authorization key, and is never used to
  auto-link or merge accounts. CrawlPact's existing passkey-created accounts have no verified
  email identity to compare against in the first place, so an email match could never prove two
  accounts belong to the same person.
- **Token verification**: `apps/web/src/lib/auth/google.ts`, using `jose` (Web Crypto based,
  Cloudflare Workers-compatible) against Google's real JWKS
  (`https://www.googleapis.com/oauth2/v3/certs`) — signature, issuer, audience, expiry, and
  (when present) `azp` are all verified; the nonce claim is extracted here but compared against
  the issued intent's hash by the caller (see below).
- **CSRF/replay protection**: three independent layers, described in full in
  `docs/security/GOOGLE_AUTHENTICATION_THREAT_REVIEW.md` — Google's own `g_csrf_token`
  double-submit cookie, a server-authoritative one-time `oauth_auth_intents` row (migration 0038,
  `apps/web/src/lib/auth/oauth-intent.ts`) whose `state`/`nonce` are cryptographically random and
  only ever persisted as SHA-256 hashes, and full ID-token cryptographic verification. The Google
  callback (`POST /api/auth/google`) is a deliberate, narrowly-scoped exception to
  `requireSession`'s same-origin Origin/Referer check — Google itself performs the cross-site
  POST — protected instead by this three-layer stack, not weakened Origin policy.
- **Admin isolation**: an account with any active administrator role can never be authenticated,
  linked, or signed up via Google, under any circumstance — enforced in
  `apps/web/src/lib/auth/google-account.ts`, not merely by omission. Google authentication never
  sets `isAdminSession = true`. Super Admin sign-in remains passkey-only, full stop (SRS §28.20
  unchanged).
- **Sign-in vs. sign-up semantics**: sign-in never creates an account for an unlinked Google
  identity; sign-up is idempotent (a second "Sign up with Google" click for an already-linked
  identity signs into the existing account rather than erroring or duplicating it — DB uniqueness
  on `(provider, provider_subject)` is the final concurrency guarantee, not application-level
  check-then-insert alone).
- **Linking/unlinking**: explicit only, from an authenticated session with recent-authentication
  step-up (same bar as recovery-code regeneration/passkey removal). Disconnecting Google is
  refused whenever it would leave the account with no active passkey — recovery codes are a
  one-time backstop, not counted as a permanent authenticator for this check.
- **Session issuance**: Google authentication calls the exact same `createSession`/session-cookie
  infrastructure passkeys use (ADR-0004) — opaque DB-backed token, `HttpOnly`/`Secure`/
  `SameSite=Lax`, same TTL policy. Google's ID token itself is never stored, logged, or returned
  to another page.
- **CSP**: `script-src`/`style-src`/`frame-src`/`connect-src` gain only Google's own documented
  GIS origins (`accounts.google.com/gsi/*`) — no broad `*.google.com`/`https:` shortcut. See
  `apps/web/src/lib/security-headers.ts`.

## Alternatives Considered

1. **Do nothing — remain passkey-only.** Rejected per the explicit product-owner request driving
   this ADR; the friction/reach tradeoff above was judged to outweigh the cost of this one, tightly
   scoped exception to §6.2.
2. **Full OAuth 2.0 authorization-code exchange (with a client secret).** Rejected — authentication
   only requires an identity assertion, which the GIS ID-token flow already provides without ever
   needing a client secret or access/refresh tokens. A client secret would be a durable Workers
   secret this integration has no use for and would only expand the credential-compromise surface.
3. **Third-party auth framework (Auth0, Clerk, Firebase Auth, Supabase Auth, NextAuth/Auth.js).**
   Rejected — every one of these would replace, not extend, CrawlPact's existing DB-backed session
   architecture (ADR-0004), reintroducing exactly the "external authentication provider" problem
   §6.2 exists to prevent, and at a much larger blast radius than adding one identity provider.
4. **Auto-link by email.** Rejected outright, independent of this ADR's own authorization scope —
   see "Identity key" above and `docs/security/GOOGLE_AUTHENTICATION_THREAT_REVIEW.md`'s
   "account linking attack" / "email-based account takeover" sections.
5. **Google as a route to Super Admin sign-in.** Rejected — a compromised Google credential must
   never be a path into the privileged admin account shell. Admin sign-in remains passkey-only.

## Consequences

- SRS §6.2's "no external authentication providers" line no longer describes the deployed system
  exactly as originally written; this ADR is the recorded, authorized exception `CLAUDE.md`'s
  governance rule requires for that gap to be legitimate rather than a silent deviation. §6.2's
  _other_ fourteen prohibited categories (email/SMS/push providers, external AI APIs, analytics
  vendors beyond the already-recorded GA exception, etc.) are entirely unaffected.
- Two customer-facing identity providers (WebAuthn, Google) now exist side by side, each
  independently sufficient to authenticate an account once linked — this is intentional
  redundancy (a lost/incompatible device no longer means "recovery codes or nothing"), not
  redundant complexity to prune later.
- A new dependency, `jose`, is introduced (apps/web only) — a widely used, actively maintained,
  Web Crypto-based JOSE/JWT library with confirmed Cloudflare Workers compatibility; no other
  package in this integration is new.
- Two new tables (`oauth_accounts`, `oauth_auth_intents`, migration 0038) and six new API error
  codes (`AUTH_GOOGLE_*`, `packages/core/src/api/errors.ts`) join the existing identity schema
  and error catalogue, both already-documented extension points (ADR-0002, `docs/api/ERROR_CATALOGUE.md`).
- Every Google-related code path this ADR governs must keep satisfying the "Never"/"Always" list
  in `apps/web/src/pages/api/auth/AGENTS.md` — a future change that violates any of those
  constraints conflicts with this ADR and needs either to conform or supersede it explicitly, the
  same rule that applies to every other accepted ADR.
