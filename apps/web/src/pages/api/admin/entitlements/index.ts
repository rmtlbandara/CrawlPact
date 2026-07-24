import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireAdminAction, requireAdminSession } from "../../../../lib/auth/require-admin";
import {
  grantTemporaryEntitlement,
  listTemporaryEntitlements,
} from "../../../../lib/admin/subscriptions";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

const grantSchema = z.object({
  userId: z.string().min(1),
  grantedPlanId: z.enum(["free", "solo", "pro", "agency"]),
  expiresAt: z.string().datetime(),
  reason: z.string().trim().min(3).max(500),
});

/** GET /api/admin/entitlements — SRS §28.5. */
export const GET: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    await requireAdminSession(request, db);
    const rows = await listTemporaryEntitlements(db);
    return jsonResponse(ok(rows, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};

/** POST /api/admin/entitlements — SRS §28.5: a temporary entitlement always
 * requires an expiry date, a reason, and is audited. */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const parsed = grantSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ApiError(
        "VALIDATION_FAILED",
        "A user, plan, expiry date, and reason are all required.",
        {
          issues: parsed.error.issues,
        },
      );
    }
    if (new Date(parsed.data.expiresAt).getTime() <= Date.now()) {
      throw new ApiError("VALIDATION_FAILED", "The expiry date must be in the future.");
    }

    const admin = await requireAdminAction(request, db, {
      action: "entitlement.grant",
      target: parsed.data.userId,
      reason: parsed.data.reason,
      requestId,
      newState: { grantedPlanId: parsed.data.grantedPlanId, expiresAt: parsed.data.expiresAt },
    });

    const entitlementId = await grantTemporaryEntitlement(db, {
      userId: parsed.data.userId,
      grantedPlanId: parsed.data.grantedPlanId,
      reason: parsed.data.reason,
      grantedByUserId: admin.user.id,
      expiresAt: parsed.data.expiresAt,
    });

    return jsonResponse(ok({ entitlementId }, requestId), 201);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
