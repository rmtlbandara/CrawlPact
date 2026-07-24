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
import { signToken, verifyToken } from "@crawlpact/core";
import { getEnv } from "../env";

/**
 * Thin wrapper around @simplewebauthn/server, scoped to this app's RP
 * config (SRS §24, ADR-0004). The WebAuthn ceremony challenge travels to
 * the browser and back inside a signed, expiring token (`signed-token.ts`
 * in @crawlpact/core) rather than a server-side session — there is no
 * authenticated session yet at the point registration/login begins, and we
 * deliberately avoid a third storage table just to hold a five-minute
 * value.
 */

const CHALLENGE_TTL_SECONDS = 300;

function rpConfig() {
  const env = getEnv();
  return { rpID: env.WEBAUTHN_RP_ID, rpOrigin: env.WEBAUTHN_RP_ORIGIN, rpName: "CrawlPact" };
}

type RegistrationChallengePayload = {
  purpose: "register";
  challenge: string;
  displayName: string;
  label: string;
};
type AuthenticationChallengePayload = { purpose: "login"; challenge: string };

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
  accountDisplayName: string,
  existingCredentials: ExistingCredentialRef[],
  label = "Passkey",
): Promise<{
  challengeToken: string;
  options: Awaited<ReturnType<typeof generateRegistrationOptions>>;
}> {
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
    } satisfies RegistrationChallengePayload,
    getEnv().SESSION_SIGNING_SECRET,
    CHALLENGE_TTL_SECONDS,
  );

  return { challengeToken, options };
}

export type FinishRegistrationOutcome =
  | { ok: true; credential: WebAuthnCredential; aaguid: string; displayName: string; label: string }
  | { ok: false; reason: "challenge_invalid" | "verification_failed" };

export async function finishPasskeyRegistration(
  challengeToken: string,
  response: RegistrationResponseJSON,
): Promise<FinishRegistrationOutcome> {
  const verified = await verifyToken<RegistrationChallengePayload>(
    challengeToken,
    getEnv().SESSION_SIGNING_SECRET,
  );
  if (!verified.valid || verified.payload.purpose !== "register") {
    return { ok: false, reason: "challenge_invalid" };
  }

  const { rpID, rpOrigin } = rpConfig();
  try {
    const result = await verifyRegistrationResponse({
      response,
      expectedChallenge: verified.payload.challenge,
      expectedOrigin: rpOrigin,
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

export async function beginPasskeyAuthentication(): Promise<{
  challengeToken: string;
  options: Awaited<ReturnType<typeof generateAuthenticationOptions>>;
}> {
  const { rpID } = rpConfig();
  const options = await generateAuthenticationOptions({ rpID, userVerification: "preferred" });

  const challengeToken = await signToken(
    { purpose: "login", challenge: options.challenge } satisfies AuthenticationChallengePayload,
    getEnv().SESSION_SIGNING_SECRET,
    CHALLENGE_TTL_SECONDS,
  );

  return { challengeToken, options };
}

export type FinishAuthenticationOutcome =
  | { ok: true; newCounter: number }
  | { ok: false; reason: "challenge_invalid" | "verification_failed" };

export async function finishPasskeyAuthentication(
  challengeToken: string,
  response: AuthenticationResponseJSON,
  storedCredential: WebAuthnCredential,
): Promise<FinishAuthenticationOutcome> {
  const verified = await verifyToken<AuthenticationChallengePayload>(
    challengeToken,
    getEnv().SESSION_SIGNING_SECRET,
  );
  if (!verified.valid || verified.payload.purpose !== "login") {
    return { ok: false, reason: "challenge_invalid" };
  }

  const { rpID, rpOrigin } = rpConfig();
  try {
    const result = await verifyAuthenticationResponse({
      response,
      expectedChallenge: verified.payload.challenge,
      expectedOrigin: rpOrigin,
      expectedRPID: rpID,
      credential: storedCredential,
    });
    if (!result.verified) return { ok: false, reason: "verification_failed" };
    return { ok: true, newCounter: result.authenticationInfo.newCounter };
  } catch {
    return { ok: false, reason: "verification_failed" };
  }
}
