import { ApiError } from "@crawlpact/core";
import type { Database } from "@crawlpact/database";
import { getEnv } from "../env";
import { getBoolConfig } from "../runtime-config";
import {
  getSessionAndUser,
  isRecentlyAuthenticated,
  readSessionToken,
  touchSession,
} from "./session";

type SessionAndUser = NonNullable<Awaited<ReturnType<typeof getSessionAndUser>>>;
export type AuthenticatedContext = { token: string } & SessionAndUser;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence-in-depth (SRS §33). Our session cookie is `SameSite=Lax`
 * (session.ts), which already blocks cross-site POST/PATCH/DELETE in every
 * modern browser — this Origin/Referer check is a second, independent
 * layer for the state-changing methods, in case of a `SameSite` bypass or
 * a non-browser client that ignores it. Read-only requests are exempt:
 * there's nothing for a forged request to achieve by only reading data.
 */
function assertSameOrigin(request: Request): void {
  if (SAFE_METHODS.has(request.method)) return;

  const expectedOrigin = new URL(getEnv().PUBLIC_SITE_URL).origin;
  const origin = request.headers.get("Origin");
  if (origin) {
    if (origin !== expectedOrigin) {
      throw new ApiError("FORBIDDEN", "Cross-site request blocked.");
    }
    return;
  }

  const referer = request.headers.get("Referer");
  if (referer && new URL(referer).origin === expectedOrigin) return;

  throw new ApiError("FORBIDDEN", "Cross-site request blocked.");
}

/**
 * Every authenticated route calls this first — never re-implement cookie
 * parsing or session lookup inline (see AGENTS.md in this directory's
 * parent for why: consistent revocation/expiry handling in one place).
 */
export async function requireSession(
  request: Request,
  db: Database,
): Promise<AuthenticatedContext> {
  assertSameOrigin(request);

  const token = readSessionToken(request);
  if (!token) throw new ApiError("UNAUTHENTICATED", "Sign in required.");

  const result = await getSessionAndUser(db, token);
  if (!result) throw new ApiError("UNAUTHENTICATED", "Session is invalid or has expired.");

  // SRS §28.17: maintenance mode makes the customer dashboard read-only —
  // every mutating authenticated request goes through this one chokepoint,
  // so this is the single place that enforces it. Administrators are
  // exempt ("Super Admin access remaining operational") — `require-admin.ts`
  // calls this same function, so an admin's own actions must not be
  // blocked by the flag they themselves are managing.
  if (!SAFE_METHODS.has(request.method) && !result.user.isAdmin) {
    const maintenanceMode = await getBoolConfig(db, "maintenance_mode", false);
    if (maintenanceMode) {
      throw new ApiError(
        "MAINTENANCE_MODE_ACTIVE",
        "CrawlPact is in maintenance mode. The dashboard is temporarily read-only.",
      );
    }
  }

  await touchSession(db, token);
  return { token, ...result };
}

/** Sensitive actions (SRS §24: "Sensitive actions shall require recent authentication"). */
export function requireRecentAuthentication(session: { lastAuthenticatedAt: string }): void {
  if (!isRecentlyAuthenticated(session)) {
    throw new ApiError(
      "AUTH_STEP_UP_REQUIRED",
      "This action requires you to re-verify your passkey — please sign in again.",
    );
  }
}
