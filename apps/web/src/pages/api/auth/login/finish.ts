import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { ApiError, finishAssertionRequestSchema, ok } from "@crawlpact/core";
import { createDb, schema } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import {
  findActiveCredentialById,
  toWebAuthnCredential,
  updateCredentialCounter,
} from "../../../../lib/auth/credentials";
import { hashIp } from "../../../../lib/ip-hash";
import { recordSecurityEvent } from "../../../../lib/auth/rate-limit";
import { buildSessionCookie, createSession } from "../../../../lib/auth/session";
import { getActiveAdminRoles } from "../../../../lib/admin/roles";
import { finishPasskeyAuthentication } from "../../../../lib/auth/webauthn";
import { jsonErrorResponse, jsonResponseWithCookie } from "../../../../lib/json-response";

export const prerender = false;

/** POST /api/auth/login/finish — verifies the assertion and identifies the account by credential ID. */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const body = await request.json().catch(() => {
      throw new ApiError("VALIDATION_FAILED", "Request body must be valid JSON.");
    });
    const parsed = finishAssertionRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("VALIDATION_FAILED", "Malformed authentication response.", {
        issues: parsed.error.issues,
      });
    }

    const credentialResponse = parsed.data.credential as unknown as AuthenticationResponseJSON;
    const ipHash = await hashIp(request);
    const row = await findActiveCredentialById(db, credentialResponse.id);
    if (!row) {
      await recordSecurityEvent(db, "auth_failure", {
        ipHash,
        details: { reason: "unknown_credential" },
      });
      throw new ApiError("AUTH_CREDENTIAL_INVALID", "This passkey is not recognised.");
    }

    const outcome = await finishPasskeyAuthentication(
      parsed.data.challengeId,
      credentialResponse,
      toWebAuthnCredential(row),
    );
    if (!outcome.ok) {
      await recordSecurityEvent(db, "auth_failure", {
        userId: row.userId,
        ipHash,
        details: { reason: outcome.reason },
      });
      throw new ApiError(
        "AUTH_CREDENTIAL_INVALID",
        outcome.reason === "challenge_invalid"
          ? "This sign-in attempt has expired. Please try again."
          : "The passkey could not be verified.",
      );
    }

    await updateCredentialCounter(db, row.id, outcome.newCounter);

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, row.userId))
      .limit(1);
    // `pending_deletion` accounts can still sign in — see lib/account.ts on
    // why the deletion grace period stays cancellable. Only `suspended`
    // blocks login outright.
    if (!user || user.status === "suspended") {
      throw new ApiError("AUTH_CREDENTIAL_INVALID", "This account is not available.");
    }

    // SRS §28.20: administrator sessions get a shorter lifetime, set here at
    // the same passkey login every account uses — there is no separate admin
    // login path. `require-admin.ts` additionally requires an active role
    // assignment before treating the session as an admin session in practice.
    const isAdminAccount = user.isAdmin && (await getActiveAdminRoles(db, user.id)).length > 0;
    const { token, expiresAt } = await createSession(db, user.id, {
      isAdminSession: isAdminAccount,
      userAgent: request.headers.get("user-agent"),
      ipHash,
    });

    return jsonResponseWithCookie(
      ok({ user: { id: user.id, displayName: user.displayName } }, requestId),
      200,
      buildSessionCookie(token, expiresAt),
    );
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
