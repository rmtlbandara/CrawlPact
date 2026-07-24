# ADR-0004: Authentication Strategy

**Status:** Accepted
**Date:** 2026-07-22

## Context

SRS §24 mandates passkey/WebAuthn-only authentication: no passwords, no email-based login or
recovery. Users register at least one (encouraged: two+) passkeys, can view/end sessions, and
recover access via one-time hashed recovery codes. §6.2 prohibits external authentication
providers. Super Admin (§28.20) requires stricter session rules: two+ passkeys mandatory,
shorter session lifetime, recent-auth step-up for sensitive actions.

`@simplewebauthn/server` and `@simplewebauthn/browser` are confirmed compatible with the
Cloudflare Workers runtime (with `nodejs_compat` enabled) and are the most widely used
TypeScript-first WebAuthn libraries, used in several published Cloudflare Workers + D1 passkey
examples.

Full authentication implementation is scoped to Phase 3 of the SRS's own development
phases (§37); Part 1's job is to decide and document the strategy and reserve the schema, not
to build the working flow.

## Decision

- **Library**: `@simplewebauthn/server` (registration/assertion verification) paired with the
  browser's native `navigator.credentials` API via `@simplewebauthn/browser` on the client.
  No other WebAuthn library is introduced.
- **Sessions**: server-side session records in D1 (`sessions` table: id, user_id, created_at,
  last_seen_at, expires_at, user_agent, ip_hash, revoked_at). The session cookie is an opaque,
  high-entropy token, `HttpOnly`, `Secure`, `SameSite=Lax`, signed against tampering, storing
  only the session lookup key — no JWT with embedded claims, so revocation is always a single
  row update and "sign out all sessions" is a single query.
- **Recovery codes**: generated at registration, shown once, downloadable, stored only as
  salted hashes (`recovery_codes` table), single-use, invalidated on use.
- **Super Admin**: a distinct `admin_role_assignments` check gates admin routes server-side
  (never client-side only); admin sessions use a shorter `expires_at` and sensitive admin
  actions require a "recent authentication" check (re-assert WebAuthn within a short window)
  before executing, per §28.20.
- **No passwords, no email/SMS** anywhere in the authentication or recovery path, satisfying
  §6.2 and §24.
- Part 1 delivers: the `users`, `passkey_credentials`, `recovery_codes`, `sessions`,
  `admin_roles`, `admin_role_assignments` tables (ADR-0002 migrations), a typed
  `/api/auth/*` contract shape (request/response schemas only), and a `/sign-in` page that
  clearly states passkey sign-in is not yet enabled in this environment (Part 3 delivers the
  working flow) — consistent with the project rule against undocumented placeholder
  implementations.

## Alternatives Considered

1. **Third-party auth provider (Clerk, Auth0, WorkOS, etc.)** — explicitly prohibited by SRS
   §6.2 ("external authentication providers"). Rejected.
2. **Password + email magic link** — prohibited by §6.2 (no external email provider) and
   contradicts §24's passkey-only mandate. Rejected.
3. **JWT-based stateless sessions** — rejected in favour of DB-backed sessions specifically
   because §24 requires users to view and end individual sessions and sign out everywhere;
   stateless JWTs make instant revocation and per-session visibility awkward without an
   additional denylist table, which is just a session table by another name.

## Consequences

- Every authenticated request costs one D1 lookup for session validation. Given D1's low
  latency at CrawlPact's expected scale (SRS §3.3 targets), this is an acceptable tradeoff for
  the revocation guarantees it buys.
- Passkey UX (device/platform support, recovery flow polish) becomes a Phase 3 concern to
  design and test explicitly against SRS §10.38 (onboarding) and §35.3 (E2E passkey tests).
