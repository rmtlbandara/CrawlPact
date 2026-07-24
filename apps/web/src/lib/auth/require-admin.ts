import { ApiError } from "@crawlpact/core";
import type { Database } from "@crawlpact/database";
import { requireRecentAuthentication, requireSession } from "./require-session";
import type { AuthenticatedContext } from "./require-session";
import { getPageSession } from "./page-session";
import { getActiveAdminRoles, hasAdminRole } from "../admin/roles";
import type { AdminRoleId } from "../admin/roles";
import { writeAdminAuditLog } from "../admin/audit-log";
import { hashIp } from "../ip-hash";
import { isRateLimited, recordSecurityEvent } from "./rate-limit";

export type AdminContext = AuthenticatedContext & { roles: AdminRoleId[] };

/** Strict per-IP bound on administrative writes (SRS §28.20) — generous enough
 * for genuine operational work, tight enough to bound abuse of a hijacked
 * admin session. Reads are not rate-limited here; the session/role check
 * itself is the gate for read access. */
const ADMIN_ACTION_RATE_LIMIT = { max: 60, windowMs: 60 * 60 * 1000 };
const ADMIN_ACTION_SCOPE = "admin_action";

/**
 * Every Super Admin API route (read or write) calls this first. Requires an
 * `isAdminSession` session (set at login time for accounts with an active
 * admin role assignment — see `pages/api/auth/login/finish.ts`) belonging to
 * a user who still has at least one active role. A revoked role or
 * suspended account is rejected even with a still-valid session cookie.
 */
export async function requireAdminSession(
  request: Request,
  db: Database,
  options: { role?: AdminRoleId } = {},
): Promise<AdminContext> {
  const ctx = await requireSession(request, db);

  if (!ctx.user.isAdmin || ctx.user.status !== "active") {
    throw new ApiError(
      "ADMIN_ACTION_FORBIDDEN",
      "This account does not have administrator access.",
    );
  }
  if (!ctx.session.isAdminSession) {
    throw new ApiError(
      "ADMIN_ACTION_FORBIDDEN",
      "Sign in again to start an administrator session.",
    );
  }

  const roles = await getActiveAdminRoles(db, ctx.user.id);
  if (roles.length === 0) {
    throw new ApiError("ADMIN_ACTION_FORBIDDEN", "This account has no active administrator role.");
  }
  if (options.role && !hasAdminRole(roles, options.role)) {
    throw new ApiError(
      "ADMIN_ACTION_FORBIDDEN",
      `This action requires the ${options.role.replace(/_/g, " ")} role.`,
    );
  }

  return { ...ctx, roles };
}

/** Astro-page counterpart — returns `null` instead of throwing so the page can redirect. */
export async function getAdminPageSession(
  request: Request,
  db: Database,
  options: { role?: AdminRoleId } = {},
): Promise<AdminContext | null> {
  const result = await getPageSession(db, request);
  if (!result) return null;
  if (!result.user.isAdmin || result.user.status !== "active") return null;
  if (!result.session.isAdminSession) return null;
  const roles = await getActiveAdminRoles(db, result.user.id);
  if (roles.length === 0) return null;
  if (options.role && !hasAdminRole(roles, options.role)) return null;
  return { token: "", ...result, roles };
}

/**
 * The chokepoint for every sensitive administrative action (SRS §28.3,
 * §28.5, §28.7–§28.11, §28.14, §28.16, §28.19): requires an admin session,
 * a recent (step-up) passkey authentication, a non-empty reason, applies a
 * strict per-IP rate limit distinct from any other rate-limited surface,
 * and writes the audit-log entry itself so no call site can forget to.
 * Callers do the actual mutation after this resolves.
 */
export async function requireAdminAction(
  request: Request,
  db: Database,
  params: {
    action: string;
    target: string;
    reason: unknown;
    requestId: string;
    role?: AdminRoleId;
    previousState?: unknown;
    newState?: unknown;
  },
): Promise<AdminContext> {
  const ctx = await requireAdminSession(request, db, { role: params.role });
  requireRecentAuthentication(ctx.session);

  const reason = typeof params.reason === "string" ? params.reason.trim() : "";
  if (reason.length < 3) {
    throw new ApiError("ADMIN_REASON_REQUIRED", "A reason of at least 3 characters is required.");
  }

  const ipHash = await hashIp(request);
  if (ipHash) {
    const limited = await isRateLimited(db, "rate_limit", ipHash, {
      ...ADMIN_ACTION_RATE_LIMIT,
      scope: ADMIN_ACTION_SCOPE,
    });
    if (limited) {
      throw new ApiError(
        "RATE_LIMITED",
        "Too many administrative actions from this network. Try again shortly.",
      );
    }
    await recordSecurityEvent(db, "rate_limit", {
      userId: ctx.user.id,
      ipHash,
      target: ADMIN_ACTION_SCOPE,
    });
  }

  await writeAdminAuditLog(db, {
    administratorUserId: ctx.user.id,
    action: params.action,
    target: params.target,
    reason,
    requestId: params.requestId,
    previousState: params.previousState,
    newState: params.newState,
  });

  return ctx;
}
