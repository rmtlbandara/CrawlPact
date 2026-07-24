import type { APIRoute } from "astro";
import { ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireAdminSession } from "../../../../lib/auth/require-admin";
import { searchUsers } from "../../../../lib/admin/users";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

/** GET /api/admin/users — SRS §28.3 search by ID/name/Paddle IDs/domain/plan/status. */
export const GET: APIRoute = async ({ request, url }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    await requireAdminSession(request, db);

    const query = url.searchParams.get("q") ?? undefined;
    const planId = url.searchParams.get("plan") ?? undefined;
    const status = url.searchParams.get("status") as
      "active" | "suspended" | "pending_deletion" | null;

    const users = await searchUsers(db, {
      query,
      planId,
      status: status ?? undefined,
    });
    return jsonResponse(
      ok(
        users.map((u) => ({
          id: u.id,
          displayName: u.displayName,
          status: u.status,
          planId: u.planId,
          isAdmin: u.isAdmin,
          createdAt: u.createdAt,
        })),
        requestId,
      ),
      200,
    );
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
