import type { APIRoute } from "astro";
import { ApiError, createGroupRequestSchema, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../lib/env";
import { requireSession } from "../../../lib/auth/require-session";
import { createGroup, listGroups } from "../../../lib/groups";
import { getPlan } from "../../../lib/plan";
import { jsonErrorResponse, jsonResponse } from "../../../lib/json-response";

export const prerender = false;

/** GET /api/groups — the caller's own domain groups (SRS §10.16, §29). */
export const GET: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);
    const groups = await listGroups(db, user.id);
    return jsonResponse(ok(groups, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};

/** POST /api/groups — create a domain group; requires the plan's `domainGroupsEnabled` entitlement. */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    const plan = await getPlan(db, user.planId);
    if (!plan.domainGroupsEnabled) {
      throw new ApiError("FORBIDDEN", "Domain groups are not available on your current plan.");
    }

    const body = await request.json().catch(() => {
      throw new ApiError("VALIDATION_FAILED", "Request body must be valid JSON.");
    });
    const parsed = createGroupRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("VALIDATION_FAILED", "Enter a group name.", {
        issues: parsed.error.issues,
      });
    }

    const group = await createGroup(db, user.id, parsed.data.name);
    return jsonResponse(ok({ groupId: group.id, name: group.name }, requestId), 201);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
