import { and, eq, gt, isNull } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";

/**
 * Server-authoritative Google OAuth intent store (ADR-0009). The Google
 * redirect is cross-site, so a plain browser-controlled `state=signup`
 * value is not a trust boundary on its own — every `state`/`nonce` this
 * module issues is a cryptographically random, one-time, short-lived,
 * DB-backed value. Only SHA-256 hashes are ever persisted; the raw values
 * exist solely in the response returned to the browser and, for the nonce,
 * inside Google's own signed ID token — see `google.ts`'s doc comment on
 * `GoogleIdTokenPayload.nonce` for how the nonce check completes without
 * the server ever storing the raw value.
 */

const INTENT_TTL_SECONDS = 600; // 10 minutes — generous for a redirect round trip, short enough to bound replay risk.

export type OAuthIntentAction = "signin" | "signup" | "link";

function randomOpaqueValue(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Creates the paired sign-in/sign-up intents for `/api/auth/google/begin` —
 * both share one nonce (so GIS is initialized once per page load with a
 * single nonce, per section 31's client architecture) but each gets its own
 * one-time `state`, since only one of the two buttons is ever actually
 * clicked. Neither intent is tied to a user — the account is resolved
 * (sign-in) or created (sign-up) only after the callback verifies the token.
 */
export async function createGoogleAuthIntents(
  db: Database,
  params: { redirectTo: string; failureRedirect: string },
): Promise<{ nonce: string; signInState: string; signUpState: string }> {
  const nonce = randomOpaqueValue();
  const nonceHash = await sha256Hex(nonce);
  const signInState = randomOpaqueValue();
  const signUpState = randomOpaqueValue();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + INTENT_TTL_SECONDS * 1000).toISOString();

  await db.insert(schema.oauthAuthIntents).values([
    {
      id: crypto.randomUUID(),
      stateHash: await sha256Hex(signInState),
      provider: "google",
      action: "signin",
      redirectTo: params.redirectTo,
      failureRedirect: params.failureRedirect,
      userId: null,
      nonceHash,
      createdAt: now.toISOString(),
      expiresAt,
    },
    {
      id: crypto.randomUUID(),
      stateHash: await sha256Hex(signUpState),
      provider: "google",
      action: "signup",
      redirectTo: params.redirectTo,
      failureRedirect: params.failureRedirect,
      userId: null,
      nonceHash,
      createdAt: now.toISOString(),
      expiresAt,
    },
  ]);

  return { nonce, signInState, signUpState };
}

/**
 * Creates the single intent for an authenticated "connect Google" request
 * (`/api/account/google/link/begin`). `userId` is derived from the caller's
 * own session by the route handler — never accepted from the request body
 * (section 13/22's non-negotiable rule).
 */
export async function createGoogleLinkIntent(
  db: Database,
  params: { userId: string; redirectTo: string; failureRedirect: string },
): Promise<{ nonce: string; state: string }> {
  const nonce = randomOpaqueValue();
  const state = randomOpaqueValue();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + INTENT_TTL_SECONDS * 1000).toISOString();

  await db.insert(schema.oauthAuthIntents).values({
    id: crypto.randomUUID(),
    stateHash: await sha256Hex(state),
    provider: "google",
    action: "link",
    redirectTo: params.redirectTo,
    failureRedirect: params.failureRedirect,
    userId: params.userId,
    nonceHash: await sha256Hex(nonce),
    createdAt: now.toISOString(),
    expiresAt,
  });

  return { nonce, state };
}

export type ConsumedOAuthIntent = {
  action: OAuthIntentAction;
  redirectTo: string;
  failureRedirect: string;
  userId: string | null;
  nonceHash: string;
};

/**
 * Atomically consumes a `state` value: looks it up, checks it hasn't
 * expired or already been consumed, and marks it consumed — all in one
 * conditional `UPDATE ... WHERE consumed_at IS NULL AND expires_at > now`,
 * so a concurrent or replayed callback with the same `state` can never
 * succeed twice (the second caller's `UPDATE` matches zero rows). Returns
 * `null` for any failure reason (unknown, expired, already consumed) —
 * deliberately undifferentiated to the caller, matching this module's
 * "never disclose which specific check failed" posture.
 */
export async function consumeOAuthIntent(
  db: Database,
  state: string,
): Promise<ConsumedOAuthIntent | null> {
  const stateHash = await sha256Hex(state);
  const now = new Date().toISOString();

  const [row] = await db
    .update(schema.oauthAuthIntents)
    .set({ consumedAt: now })
    .where(
      and(
        eq(schema.oauthAuthIntents.stateHash, stateHash),
        isNull(schema.oauthAuthIntents.consumedAt),
        gt(schema.oauthAuthIntents.expiresAt, now),
      ),
    )
    .returning();

  if (!row) return null;
  return {
    action: row.action,
    redirectTo: row.redirectTo,
    failureRedirect: row.failureRedirect,
    userId: row.userId,
    nonceHash: row.nonceHash,
  };
}

/** Hashes a token-derived nonce claim the same way the stored `nonceHash` was produced, for the caller's comparison. */
export async function hashNonce(nonce: string): Promise<string> {
  return sha256Hex(nonce);
}
