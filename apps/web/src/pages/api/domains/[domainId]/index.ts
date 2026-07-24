import type { APIRoute } from "astro";
import { ApiError, ok, updateDomainRequestSchema } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireSession } from "../../../../lib/auth/require-session";
import {
  getOwnedDomainAsSavedDomain,
  softDeleteDomain,
  updateDomain,
} from "../../../../lib/domains";
import { getOwnedGroup } from "../../../../lib/groups";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

function requireDomainId(domainId: string | undefined): string {
  if (!domainId) throw new ApiError("VALIDATION_FAILED", "Missing domain id.");
  return domainId;
}

/** GET /api/domains/:domainId — a single saved domain owned by the caller. */
export const GET: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);
    const domainId = requireDomainId(params.domainId);

    const domain = await getOwnedDomainAsSavedDomain(db, user.id, domainId);
    if (!domain) throw new ApiError("NOT_FOUND", "This domain does not exist.");

    return jsonResponse(ok(domain, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};

/** PATCH /api/domains/:domainId — update display name, group, preset, monitoring state, or notes. */
export const PATCH: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);
    const domainId = requireDomainId(params.domainId);

    const body = await request.json().catch(() => {
      throw new ApiError("VALIDATION_FAILED", "Request body must be valid JSON.");
    });
    const parsed = updateDomainRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("VALIDATION_FAILED", "Invalid update.", { issues: parsed.error.issues });
    }

    if (parsed.data.groupId) {
      const group = await getOwnedGroup(db, user.id, parsed.data.groupId);
      if (!group) throw new ApiError("VALIDATION_FAILED", "This group does not exist.");
    }

    const result = await updateDomain(db, user.id, domainId, parsed.data);
    if (!result.ok) {
      throw new ApiError(
        result.reason === "not_found" ? "NOT_FOUND" : "VALIDATION_FAILED",
        result.reason === "not_found" ? "This domain does not exist." : "Unknown policy preset.",
      );
    }

    return jsonResponse(ok({ updated: true }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};

/** DELETE /api/domains/:domainId — stop tracking a domain (soft delete; historical scans are kept). */
export const DELETE: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);
    const domainId = requireDomainId(params.domainId);

    const deleted = await softDeleteDomain(db, user.id, domainId);
    if (!deleted) throw new ApiError("NOT_FOUND", "This domain does not exist.");

    return jsonResponse(ok({ deleted: true }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
