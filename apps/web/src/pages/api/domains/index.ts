import type { APIRoute } from "astro";
import { ApiError, createDomainRequestSchema, normalizeTarget, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../lib/env";
import { requireSession } from "../../../lib/auth/require-session";
import { createDomain, listDomains } from "../../../lib/domains";
import { getOwnedGroup } from "../../../lib/groups";
import { getPlan } from "../../../lib/plan";
import { trackEvent } from "../../../lib/analytics";
import { jsonErrorResponse, jsonResponse } from "../../../lib/json-response";

export const prerender = false;

/** GET /api/domains — the caller's own saved domains (SRS §25). */
export const GET: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);
    const domains = await listDomains(db, user.id);
    return jsonResponse(ok(domains, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};

/** POST /api/domains — save a domain, enforcing the plan's saved-domain limit and de-duplication by canonical origin. */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    const body = await request.json().catch(() => {
      throw new ApiError("VALIDATION_FAILED", "Request body must be valid JSON.");
    });
    const parsed = createDomainRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("VALIDATION_FAILED", "Enter a domain, such as example.com", {
        issues: parsed.error.issues,
      });
    }

    const normalized = normalizeTarget(parsed.data.target);
    if (!normalized.ok) {
      throw new ApiError("AUDIT_TARGET_INVALID", "This does not look like a valid domain or URL.");
    }

    if (parsed.data.groupId) {
      const group = await getOwnedGroup(db, user.id, parsed.data.groupId);
      if (!group) throw new ApiError("VALIDATION_FAILED", "This group does not exist.");
    }

    const plan = await getPlan(db, user.planId);
    const result = await createDomain(db, user.id, {
      canonicalOrigin: normalized.normalizedOrigin,
      originalInput: parsed.data.target,
      displayName: parsed.data.displayName ?? normalized.hostname,
      groupId: parsed.data.groupId ?? null,
      preset: parsed.data.preset,
      savedDomainLimit: plan.savedDomainLimit,
      monitoringFrequency: plan.monitoringFrequency,
    });

    if (!result.ok) {
      if (result.reason === "duplicate") {
        throw new ApiError("DOMAIN_DUPLICATE", "This domain is already saved to your account.");
      }
      if (result.reason === "limit_reached") {
        throw new ApiError(
          "DOMAIN_LIMIT_REACHED",
          `Your plan allows up to ${plan.savedDomainLimit} saved domain${plan.savedDomainLimit === 1 ? "" : "s"}.`,
        );
      }
      throw new ApiError("VALIDATION_FAILED", "Unknown policy preset.");
    }

    await trackEvent(db, "domain_saved", { userId: user.id });

    return jsonResponse(
      ok(
        {
          domainId: result.domain.id,
          displayName: result.domain.displayName,
          canonicalOrigin: result.domain.canonicalOrigin,
        },
        requestId,
      ),
      201,
    );
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
