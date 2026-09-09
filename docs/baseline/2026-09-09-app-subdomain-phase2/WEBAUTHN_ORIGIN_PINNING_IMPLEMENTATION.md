# WebAuthn Origin-Pinning Implementation — Phase 2

Date: 2026-09-09. Implements `WEBAUTHN_MIGRATION_CONTRACT.md`'s design in
`apps/web/src/lib/auth/webauthn.ts`.

## RP ID

Unchanged. `rpConfig()` still reads `env.WEBAUTHN_RP_ID` exclusively. Never touched, per the
frozen decision.

## What changed

- Both challenge payload types gained an `origin: string` field:
  ```ts
  type RegistrationChallengePayload = {
    purpose: "register";
    challenge: string;
    displayName: string;
    label: string;
    origin: string;
  };
  type AuthenticationChallengePayload = { purpose: "login"; challenge: string; origin: string };
  ```
- `beginPasskeyRegistration`/`beginPasskeyAuthentication` now take the ceremony's `Request` as
  their first parameter. `requireCeremonyOrigin(request)` derives the origin via
  `getValidatedRequestOrigin` (the same trusted-origin check CSRF uses) and throws
  `ApiError("FORBIDDEN", ...)` if the request didn't arrive on a currently trusted CrawlPact
  origin — a ceremony is never signed for an origin we don't recognize.
- `finishPasskeyRegistration`/`finishPasskeyAuthentication` now also take the finish `Request` as
  their first parameter, checked the same way (defense-in-depth: the finish request must itself
  arrive on _some_ trusted origin, though not necessarily the _same_ one the ceremony began on —
  see the design note below).
- At finish, `expectedOrigin` passed to `verifyRegistrationResponse`/`verifyAuthenticationResponse`
  is **`verified.payload.origin`** — the origin signed into the token at begin time — never an
  array of all currently-trusted origins, and never re-derived from the finish request.
- An `isTrustedOrigin(verified.payload.origin)` re-check runs before that verification call, so a
  challenge token pinned to an origin that's since been removed from the trusted set (e.g., after
  a future Phase 4 narrowing) also fails safely, not just a token with no origin at all.
- A legacy challenge token signed before this change (no `origin` field) fails the same
  `isTrustedOrigin(undefined)` check — `challenge_invalid`, not a crash or a silent bypass. Given
  the 5-minute TTL, any in-flight ceremony at deploy time simply needs to restart, exactly as
  `WEBAUTHN_MIGRATION_CONTRACT.md` anticipated.

## Why this actually prevents cross-origin ceremony completion

The binding property is **not** "the finish request arrived on the right host" — it's that
`expectedOrigin` passed to SimpleWebAuthn is the _begin-time pinned_ value, and SimpleWebAuthn's
own verification compares that against the real authenticator's signed `clientDataJSON.origin`
(cryptographically bound to the credential's private key — not something a client can forge). If
an attacker begins a ceremony at `crawlpact.com` (pinning the token to that origin) and somehow
gets a real WebAuthn ceremony completed at `app.crawlpact.com` instead (`clientDataJSON.origin =
"https://app.crawlpact.com"`), passing the _pinned_ `"https://crawlpact.com"` as `expectedOrigin`
makes SimpleWebAuthn's internal comparison fail — verification returns `verified: false`
regardless of which HTTP host physically received the finish POST. This is why finish's own
arrival-origin check is correctly scoped as defense-in-depth rather than the primary control: the
primary control is cryptographic, not request-routing-based.

## Call sites updated (all 6 ceremony entry points)

`register/begin.ts`, `register/finish.ts`, `login/begin.ts`, `login/finish.ts`,
`passkeys/begin.ts` (add-passkey), `passkeys/finish.ts`. No separate step-up or admin passkey
ceremony exists — step-up (`isRecentlyAuthenticated`/`requireRecentAuthentication`) reuses session
recency, not a distinct WebAuthn call, so no additional call sites were missed.

## Test evidence

`apps/web/src/lib/auth/webauthn.test.ts` (new, 9 tests, all passing) — pure unit tests against a
**real** software WebAuthn authenticator (`tests/integration/virtual-authenticator.ts`, genuine
P-256 keypairs and CBOR/DER-encoded responses SimpleWebAuthn's real verification code accepts, not
a mock of the verification itself):

- Registration succeeds when begun and finished at the same trusted origin.
- Registration succeeds when begun at one trusted origin and the finish _HTTP request_ arrives on
  the other trusted origin, **as long as the real ceremony's signed origin matches the pinned one**
  — proving the defense-in-depth finish-arrival check and the cryptographic pinning are correctly
  independent of each other.
- **Registration is rejected** when begun at one origin but the real ceremony's
  `clientDataJSON.origin` claims the other — the dual-origin replay case, the specific property
  this whole workstream exists to guarantee. Verified end-to-end with real cryptography, not
  asserted from documentation.
- Registration begin/finish both reject requests arriving on an untrusted origin
  (`https://attacker.example`) — begin throws `ApiError("FORBIDDEN")`, finish returns
  `challenge_invalid`.
- A legacy (no-origin-field) challenge token is rejected safely.
- **Authentication** mirrors the same two critical cases: succeeds same-origin end-to-end, and is
  **rejected** when begun on one trusted origin but completed (per `clientDataJSON`) on the other —
  proven using a real credential obtained from an actual registration ceremony in the same test
  (not a hand-built `WebAuthnCredential`, so the COSE public-key format is genuine and a
  same-origin control case can be shown to succeed, making the cross-origin rejection meaningful
  rather than confounded by an unrelated key-format failure).
- Authentication begin rejects a request arriving on an untrusted origin.

## Deferred to Phase 3/4 (not implemented, and must not be until then)

- Switching production `expectedOrigin` exclusively to `app.crawlpact.com` — requires the app host
  to actually exist and be tested with real credentials first.
- Removing the apex from the trusted-origin set — Phase 4, after rollback confidence is
  established.
- The mandatory real-production-passkey regression gate (`WEBAUTHN_MIGRATION_CONTRACT.md`'s
  "Existing-passkey regression gate") — requires a real deployed `app.crawlpact.com`, which does
  not exist yet per the Cloudflare host-boundary hard gate.
