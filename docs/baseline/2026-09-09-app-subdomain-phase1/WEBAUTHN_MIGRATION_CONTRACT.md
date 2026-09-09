# WebAuthn Migration Contract — App-Subdomain Migration Phase 1

Date: 2026-09-09. This is the design contract Phase 2/3 must implement. **No WebAuthn behavior
changes in Phase 1** — `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_ORIGIN`, and `apps/web/src/lib/auth/webauthn.ts`
are unmodified this phase.

## Current state (verified from source, `apps/web/src/lib/auth/webauthn.ts` and `packages/config/src/env.ts`)

- `rpConfig()` reads `rpID: env.WEBAUTHN_RP_ID`, `rpOrigin: env.WEBAUTHN_RP_ORIGIN` — both single,
  required, environment-pinned values (production: `crawlpact.com` / `https://crawlpact.com`).
- `@simplewebauthn/server` v13.3.2 (current-API result shape: `result.registrationInfo.credential`,
  not the older `credentialID`/`credentialPublicKey` split — confirmed at call site).
- Registration: `beginPasskeyRegistration()` → `generateRegistrationOptions()`;
  `finishPasskeyRegistration()` → `verifyRegistrationResponse({ response, expectedChallenge,
expectedOrigin: rpOrigin, expectedRPID: rpID })`.
- Authentication: `beginPasskeyAuthentication()` → `generateAuthenticationOptions()`;
  `finishPasskeyAuthentication()` → `verifyAuthenticationResponse()` with the identical
  `expectedOrigin`/`expectedRPID` pattern.
- **Signed challenge-token payload today carries no origin field at all**:
  ```ts
  type RegistrationChallengePayload = {
    purpose: "register";
    challenge: string;
    displayName: string;
    label: string;
  };
  type AuthenticationChallengePayload = { purpose: "login"; challenge: string };
  ```
  `expectedOrigin`/`expectedRPID` are read fresh from env _at verification time_, not carried
  through the token. There is currently no per-ceremony origin pinning of any kind.
- Signing mechanism: `signToken`/`verifyToken` (`packages/core/src/crypto/signed-token.ts`) —
  HMAC-SHA256 over `{payload, expiresAt}` using `SESSION_SIGNING_SECRET`. Not a JWT.
- `CHALLENGE_TTL_SECONDS = 300` (5 minutes).
- 4 real production passkey credentials exist today (live D1 count, `AUTHORITATIVE_BASELINE.md`) —
  the regression gate below is not hypothetical, it protects real registered credentials.

## Frozen decisions (from the migration directive — restated here for this contract's completeness)

- `WEBAUTHN_RP_ID` **stays `crawlpact.com`**. Never changes to `app.crawlpact.com`. W3C WebAuthn
  Level 3 explicitly permits an RP ID equal to or a registrable-domain suffix of a secure origin's
  effective domain — `crawlpact.com` is a valid RP ID for ceremonies performed at
  `https://app.crawlpact.com`. This is what preserves every existing passkey's credential scope
  through the migration.
- **Final production ceremony origin**: `https://app.crawlpact.com`.
- One-time reauthentication for _sessions_ is acceptable (directive §3.5) — this contract is about
  passkey _credential_ compatibility, which is preserved outright, not merely tolerated via
  reauthentication.

## Dual-origin migration window design (Phase 2 implementation target)

The directive is explicit that a naive `expectedOrigin: ["https://crawlpact.com",
"https://app.crawlpact.com"]` array is **not acceptable** on its own — it would let a ceremony
_begun_ against one trusted CrawlPact origin be _completed_ against the other, which is a
WebAuthn dual-origin replay risk (Workstream P). The design:

1. **Add an `origin` field to both challenge payload types**, populated at `/begin` time from the
   request's own validated Host/Origin (the same value `assertSameOrigin`/the CSRF check already
   trusts for that request — never taken from arbitrary client-supplied JSON):
   ```ts
   type RegistrationChallengePayload = {
     purpose: "register";
     challenge: string;
     displayName: string;
     label: string;
     origin: TrustedOrigin;
   };
   type AuthenticationChallengePayload = {
     purpose: "login";
     challenge: string;
     origin: TrustedOrigin;
   };
   ```
   where `TrustedOrigin` is a narrow union of the currently-accepted origins during the migration
   window (e.g. `"https://crawlpact.com" | "https://app.crawlpact.com"` in production;
   equivalents for preview), never an open string.
2. **At `/finish`, decode the signed token, read `payload.origin`, and pass that exact value as
   `expectedOrigin`** to `verifyRegistrationResponse`/`verifyAuthenticationResponse` — never pass
   an array of all currently-accepted origins. This means a ceremony started at
   `crawlpact.com/sign-in` (legacy, pre-cutover) can only be finished against
   `crawlpact.com`, and one started at `app.crawlpact.com/sign-in` (post-cutover-adjacent testing,
   or the Phase 3 compatibility deployment) can only be finished against `app.crawlpact.com`. This
   is what "bind the signed challenge token to the validated initiating origin" means concretely.
3. Since the token is HMAC-signed server-side (`signToken`/`verifyToken`, unchanged mechanism), the
   `origin` field is tamper-evident exactly like `challenge`/`purpose` already are — no new trust
   mechanism is introduced, just a new signed field.
4. `expectedRPID` remains `env.WEBAUTHN_RP_ID` (`crawlpact.com`) unconditionally throughout — it
   never varies per-origin.
5. The migration window (both origins simultaneously accepted, each ceremony pinned to whichever
   one it started on) exists only between the Phase 3 compatibility deployment and the Phase 4
   permanent apex-auth-redirect. Once Phase 4 redirects `crawlpact.com/sign-in` to
   `app.crawlpact.com/sign-in` permanently, new ceremonies can only ever begin at the app origin,
   and the apex branch of `TrustedOrigin` can be removed from the type (not just left unused) —
   this is the directive's "after rollback confidence is established, remove apex from permitted
   WebAuthn ceremony origins" step, expressed as a type-level change, not just a runtime one.

## Existing-passkey regression gate (mandatory before Phase 4 cutover, not Phase 1)

Before any permanent apex→app redirect is enabled, Phase 3/4 must prove — against real production
credentials, not a synthetic test account — that:

1. An existing passkey (one of the 4 real production credentials) can complete an authentication
   ceremony with `expectedOrigin = https://app.crawlpact.com` and `expectedRPID = crawlpact.com`.
2. A brand-new passkey can be registered against `https://app.crawlpact.com` and immediately used
   to log in again.
3. Step-up/recent-auth (`isRecentlyAuthenticated`, `RECENT_AUTH_WINDOW_MS = 5 * 60 * 1000`) and
   passkey management (list/rename/remove) work correctly when the session was established via an
   app-origin ceremony.
4. A ceremony begun at one trusted origin genuinely **cannot** be completed at the other — this is
   a required _negative_ test, not just a positive one (see `PHASE_2_TEST_CONTRACT.md`).

This cannot be executed in Phase 1: it requires a real deployed `app.crawlpact.com` origin, which
must not exist yet per the Cloudflare host-boundary hard gate (`CLOUDFLARE_HOST_BOUNDARY_DESIGN.md`).
It is recorded here so Phase 3 has an unambiguous, evidence-based gate rather than a vague
"test WebAuthn" instruction.

## Rollback

- `WEBAUTHN_RP_ID` never changes at any point, including during rollback — restated because it's
  the one value that must never be touched regardless of what else breaks.
- Rollback restores `WEBAUTHN_RP_ORIGIN`/the `TrustedOrigin` union to accept the apex origin only,
  by re-widening the union and re-enabling the apex branch of the origin-pinning logic above — not
  by reverting to today's originless challenge payload (that would silently reintroduce the
  dual-origin replay gap for any period the wider union is later needed again).
- Users may need to re-authenticate after a rollback; cookie/session isolation is never weakened to
  make rollback session-transparent (directive §12, restated for completeness).
