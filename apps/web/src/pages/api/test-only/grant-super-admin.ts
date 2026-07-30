import type { APIRoute } from "astro";
import { and, eq, isNull } from "drizzle-orm";
import { ok } from "@crawlpact/core";
import { createDb, schema } from "@crawlpact/database";
import { getEnv } from "../../../lib/env";
import { assertTestOnlyAccess } from "../../../lib/test-only";
import { requireSession } from "../../../lib/auth/require-session";
import { jsonErrorResponse, jsonResponse } from "../../../lib/json-response";

export const prerender = false;

/**
 * e2e-only: grants `super_admin` to the CALLING session's own account, not
 * an arbitrary target. Self-service avoids the bootstrap problem of
 * needing an already-admin session to create the very first admin fixture
 * — see apps/web/tests/e2e/setup/admin.setup.ts, the only caller, which
 * calls this while still signed in as the account it just registered.
 */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    assertTestOnlyAccess(request);
    const db = createDb(getEnv().DB);
    const ctx = await requireSession(request, db);

    await db.update(schema.users).set({ isAdmin: true }).where(eq(schema.users.id, ctx.user.id));

    const [existing] = await db
      .select({ id: schema.adminRoleAssignments.id })
      .from(schema.adminRoleAssignments)
      .where(
        and(
          eq(schema.adminRoleAssignments.userId, ctx.user.id),
          eq(schema.adminRoleAssignments.roleId, "super_admin"),
          isNull(schema.adminRoleAssignments.revokedAt),
        ),
      )
      .limit(1);

    if (!existing) {
      await db.insert(schema.adminRoleAssignments).values({
        id: crypto.randomUUID(),
        userId: ctx.user.id,
        roleId: "super_admin",
        assignedByUserId: ctx.user.id,
        createdAt: new Date().toISOString(),
      });
    }

    return jsonResponse(ok({ userId: ctx.user.id }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
