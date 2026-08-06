import type { APIRoute } from "astro";
import { ApiError, ok, updateAgencyBrandProfileRequestSchema } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../lib/env";
import { requireSession } from "../../../lib/auth/require-session";
import { getPlan } from "../../../lib/plan";
import { getAgencyBrandProfile, upsertAgencyBrandProfile } from "../../../lib/agency-brand-profile";
import { logoPathBelongsToUser, objectKeyFromLogoUrl } from "../../../lib/agency-logo";
import { trackEvent } from "../../../lib/analytics";
import { jsonErrorResponse, jsonResponse } from "../../../lib/json-response";

export const prerender = false;

/** GET /api/agency-branding/profile — the caller's own persistent branding defaults, or null. */
export const GET: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);
    const profile = await getAgencyBrandProfile(db, user.id);
    return jsonResponse(ok(profile ?? { agencyName: null, logoUrl: null }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};

/** PUT /api/agency-branding/profile — upsert the agency display name; requires Agency entitlement. */
export const PUT: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    const plan = await getPlan(db, user.planId);
    if (!plan.agencyBrandingEnabled) {
      throw new ApiError("FORBIDDEN", "Agency branding is not available on your current plan.");
    }

    const body = await request.json().catch(() => {
      throw new ApiError("VALIDATION_FAILED", "Request body must be valid JSON.");
    });
    const parsed = updateAgencyBrandProfileRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("VALIDATION_FAILED", "Invalid branding profile.", {
        issues: parsed.error.issues,
      });
    }

    if (parsed.data.logoUrl && !logoPathBelongsToUser(parsed.data.logoUrl, user.id)) {
      throw new ApiError("FORBIDDEN", "This logo was not uploaded by your account.");
    }

    // R2 lifecycle: remove the D1 reference to the old logo before deleting it from R2 (never
    // the other way around) — docs/data/D1_R2_DATA_PLACEMENT_POLICY.md.
    let previousLogoKey: string | null = null;
    if (parsed.data.logoUrl !== undefined) {
      const existing = await getAgencyBrandProfile(db, user.id);
      if (existing?.logoUrl && existing.logoUrl !== parsed.data.logoUrl) {
        previousLogoKey = objectKeyFromLogoUrl(existing.logoUrl);
      }
    }

    await upsertAgencyBrandProfile(db, user.id, {
      agencyName: parsed.data.agencyName,
      logoUrl: parsed.data.logoUrl,
    });

    if (previousLogoKey) {
      await getEnv().AGENCY_LOGOS.delete(previousLogoKey);
    }

    await trackEvent(db, "agency_branding_updated", {
      userId: user.id,
      properties: { plan: plan.id },
    });
    if (parsed.data.logoUrl) {
      await trackEvent(db, "agency_logo_uploaded", {
        userId: user.id,
        properties: { plan: plan.id },
      });
    } else if (parsed.data.logoUrl === null) {
      await trackEvent(db, "agency_logo_removed", {
        userId: user.id,
        properties: { plan: plan.id },
      });
    }

    return jsonResponse(ok({ updated: true }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
