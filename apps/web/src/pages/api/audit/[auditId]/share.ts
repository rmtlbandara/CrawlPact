import type { APIRoute } from "astro";
import { ApiError, createShareRequestSchema, ok, shareSummarySchema } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireSession } from "../../../../lib/auth/require-session";
import { createShare } from "../../../../lib/sharing";
import { getPlan } from "../../../../lib/plan";
import { logoPathBelongsToUser } from "../../../../lib/agency-logo";
import { trackEvent } from "../../../../lib/analytics";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

/**
 * POST /api/audit/:auditId/share — a private, revocable, high-entropy
 * report link (SRS §23). Only the domain's owner can create one — an
 * anonymous (unowned) scan can never be shared this way, since there's no
 * owner to authorise it.
 */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    const auditId = params.auditId;
    if (!auditId) throw new ApiError("VALIDATION_FAILED", "Missing audit id.");

    const body = await request.json().catch(() => ({}));
    const parsed = createShareRequestSchema.safeParse({ ...(body as object), auditId });
    if (!parsed.success) {
      throw new ApiError("VALIDATION_FAILED", "Invalid share request.", {
        issues: parsed.error.issues,
      });
    }

    if (parsed.data.agencyBranding) {
      const plan = await getPlan(db, user.planId);
      if (!plan.agencyBrandingEnabled) {
        throw new ApiError(
          "FORBIDDEN",
          "Your plan does not include agency branding on shared reports.",
        );
      }
      // The schema already restricts logoUrl to our own upload route's path
      // shape — this additionally confirms the embedded user id is the
      // caller's own, so one user can never reference another's uploaded
      // logo even by guessing/enumerating its object key.
      const { logoUrl } = parsed.data.agencyBranding;
      if (logoUrl && !logoPathBelongsToUser(logoUrl, user.id)) {
        throw new ApiError("FORBIDDEN", "This logo was not uploaded by you.");
      }
    }

    const result = await createShare(
      db,
      user.id,
      auditId,
      parsed.data.expiresInDays,
      parsed.data.agencyBranding ?? null,
    );
    if (!result.ok) {
      throw new ApiError("NOT_FOUND", "This report does not exist or isn't yours to share.");
    }

    await trackEvent(db, "report_shared", { userId: user.id });

    const url = new URL(`/shared/${result.token}`, getEnv().PUBLIC_SITE_URL).toString();
    return jsonResponse(
      ok(
        shareSummarySchema.parse({
          shareId: result.shareId,
          url,
          createdAt: result.createdAt,
          expiresAt: result.expiresAt,
          revoked: false,
        }),
        requestId,
      ),
      201,
    );
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
