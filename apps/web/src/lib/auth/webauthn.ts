import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
  WebAuthnCredential,
} from "@simplewebauthn/server";
import { ApiError, signToken, verifyToken } from "@crawlpact/core";
import { getEnv } from "../env";
import { getValidatedRequestOrigin, isTrustedOrigin } from "../origin";

/**
 * Thin wrapper around @simplewebauthn/server, scoped to this app's RP
 * config (SRS §24, ADR-0004). The WebAuthn ceremony challenge travels to
 * the browser and back inside a signed, expiring token (`signed-token.ts`
 * in @crawlpact/core) rather than a server-side session — there is no
 * authenticated session yet at the point registration/login begins, and we
 * deliberately avoid a third storage table just to hold a five-minute
 * value.
 *
 * Phase 2 of the app-subdomain migration (ADR-0010,
 * `docs/baseline/2026-09-09-app-subdomain-phase1/WEBAUTHN_MIGRATION_CONTRACT.md`)
 * added **origin pinning**: each challenge token now carries the trusted
 * origin the ceremony actually began on, derived server-side
 * (`getValidatedRequestOrigin`, never a client-supplied value), and `finish`
 * passes that exact signed origin to SimpleWebAuthn as `expectedOrigin` —
 * never an array of every currently-trusted origin. A ceremony begun on one
 * trusted CrawlPact origin therefore cannot be completed on another: if the
 * real ceremony's `clientDataJSON.origin` (cryptographically bound to the
 * authenticator's signed response, not something a client can lie about)
 * doesn't match the origin pinned into the token, SimpleWebAuthn's own
 * verification fails. `WEBAUTHN_RP_ID` remains a single, unchanged value
 * throughout — only the *origin* varies per ceremony, never the RP ID.
 */

const CHALLENGE_TTL_SECONDS = 300;

function rpConfig() {
  const env = getEnv();
  return { rpID: env.WEBAUTHN_RP_ID, rpName: "CrawlPact" };
}

/**
 * The origin a ceremony is permitted to begin on, right now. Deliberately
 * derived from the same request the caller already has, never trusted from
 * client-supplied JSON. Throws if the request didn't arrive on a currently
 * trusted CrawlPact origin — a ceremony must never be signed for an origin
 * we don't recognize.
 */
function requireCeremonyOrigin(request: Request): string {
  const origin = getValidatedRequestOrigin(request);
  if (!origin) {
    throw new ApiError("FORBIDDEN", "This request did not arrive on a trusted CrawlPact origin.");
  }
  return origin;
}

type RegistrationChallengePayload = {
  purpose: "register";
  challenge: string;
  displayName: string;
  label: string;
  origin: string;
};
type AuthenticationChallengePayload = { purpose: "login"; challenge: string; origin: string };

export type ExistingCredentialRef = { credentialId: string };

/**
 * Deliberately takes no user identity — the challenge token only proves
 * "this specific ceremony, started moments ago, completed." Which user
 * (brand new, in register/finish.ts, or an existing session's user, in
 * passkeys/finish.ts) the resulting credential belongs to is decided by the
 * caller from trusted server-side state (the session cookie or "no session
 * exists yet"), never from anything echoed back through the challenge.
 */
export async function beginPasskeyRegistration(
  request: Request,
  accountDisplayName: string,
  existingCredentials: ExistingCredentialRef[],
  label = "Passkey",
): Promise<{
  challengeToken: string;
  options: Awaited<ReturnType<typeof generateRegistrationOptions>>;
}> {
  const ceremonyOrigin = requireCeremonyOrigin(request);
  const { rpID, rpName } = rpConfig();
  const randomUserId = crypto.getRandomValues(new Uint8Array(32));
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: accountDisplayName,
    userDisplayName: accountDisplayName,
    userID: randomUserId,
    attestationType: "none",
    excludeCredentials: existingCredentials.map((credential) => ({ id: credential.credentialId })),
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
  });

  const challengeToken = await signToken(
    {
      purpose: "register",
      challenge: options.challenge,
      displayName: accountDisplayName,
      label,
      origin: ceremonyOrigin,
    } satisfies RegistrationChallengePayload,
    getEnv().SESSION_SIGNING_SECRET,
    CHALLENGE_TTL_SECONDS,
  );

  return { challengeToken, options };
}

export type FinishRegistrationOutcome =
  | { ok: true; credential: WebAuthnCredential; aaguid: string; displayName: string; label: string }
  | { ok: false; reason: "challenge_invalid" | "verification_failed" };

/**
 * `request` here is the *finish* request — used only to confirm it's
 * arriving on a currently trusted origin (defence-in-depth; the binding
 * property that actually prevents cross-origin completion is passing the
 * *signed, begin-time* origin as `expectedOrigin` below, which SimpleWebAuthn
 * verifies against the authenticator's own signed `clientDataJSON.origin` —
 * not anything derived from this request).
 */
export async function finishPasskeyRegistration(
  request: Request,
  challengeToken: string,
  response: RegistrationResponseJSON,
): Promise<FinishRegistrationOutcome> {
  if (!getValidatedRequestOrigin(request)) {
    return { ok: false, reason: "challenge_invalid" };
  }

  const verified = await verifyToken<RegistrationChallengePayload>(
    challengeToken,
    getEnv().SESSION_SIGNING_SECRET,
  );
  // A legacy challenge token signed before this origin-pinning change has no
  // `origin` field at all; `isTrustedOrigin(undefined)` is `false`, so it is
  // rejected the same as any other invalid challenge — expected and
  // acceptable given the 5-minute TTL (WEBAUTHN_MIGRATION_CONTRACT.md).
  if (
    !verified.valid ||
    verified.payload.purpose !== "register" ||
    !isTrustedOrigin(verified.payload.origin)
  ) {
    return { ok: false, reason: "challenge_invalid" };
  }

  const { rpID } = rpConfig();
  try {
    const result = await verifyRegistrationResponse({
      response,
      expectedChallenge: verified.payload.challenge,
      expectedOrigin: verified.payload.origin,
      expectedRPID: rpID,
    });
    if (!result.verified) return { ok: false, reason: "verification_failed" };
    return {
      ok: true,
      credential: result.registrationInfo.credential,
      aaguid: result.registrationInfo.aaguid,
      displayName: verified.payload.displayName,
      label: verified.payload.label,
    };
  } catch {
    return { ok: false, reason: "verification_failed" };
  }
}

export async function beginPasskeyAuthentication(request: Request): Promise<{
  challengeToken: string;
  options: Awaited<ReturnType<typeof generateAuthenticationOptions>>;
}> {
  const ceremonyOrigin = requireCeremonyOrigin(request);
  const { rpID } = rpConfig();
  const options = await generateAuthenticationOptions({ rpID, userVerification: "preferred" });

  const challengeToken = await signToken(
    {
      purpose: "login",
      challenge: options.challenge,
      origin: ceremonyOrigin,
    } satisfies AuthenticationChallengePayload,
    getEnv().SESSION_SIGNING_SECRET,
    CHALLENGE_TTL_SECONDS,
  );

  return { challengeToken, options };
}

export type FinishAuthenticationOutcome =
  | { ok: true; newCounter: number }
  | { ok: false; reason: "challenge_invalid" | "verification_failed" };

export async function finishPasskeyAuthentication(
  request: Request,
  challengeToken: string,
  response: AuthenticationResponseJSON,
  storedCredential: WebAuthnCredential,
): Promise<FinishAuthenticationOutcome> {
  if (!getValidatedRequestOrigin(request)) {
    return { ok: false, reason: "challenge_invalid" };
  }

  const verified = await verifyToken<AuthenticationChallengePayload>(
    challengeToken,
    getEnv().SESSION_SIGNING_SECRET,
  );
  if (
    !verified.valid ||
    verified.payload.purpose !== "login" ||
    !isTrustedOrigin(verified.payload.origin)
  ) {
    return { ok: false, reason: "challenge_invalid" };
  }

  const { rpID } = rpConfig();
  try {
    const result = await verifyAuthenticationResponse({
      response,
      expectedChallenge: verified.payload.challenge,
      expectedOrigin: verified.payload.origin,
      expectedRPID: rpID,
      credential: storedCredential,
    });
    if (!result.verified) return { ok: false, reason: "verification_failed" };
    return { ok: true, newCounter: result.authenticationInfo.newCounter };
  } catch {
    return { ok: false, reason: "verification_failed" };
  }
}
