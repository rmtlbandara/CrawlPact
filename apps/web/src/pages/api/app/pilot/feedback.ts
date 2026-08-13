import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, ok } from "@crawlpact/core";
import { createDb, schema } from "@crawlpact/database";
import { eq } from "drizzle-orm";
import { getEnv } from "../../../../lib/env";
import { requireSession } from "../../../../lib/auth/require-session";
import {
  getActivePilotParticipationsForUser,
  submitPilotFeedback,
} from "../../../../lib/admin/pilots";
import { trackEvent } from "../../../../lib/analytics";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

/** GET /api/app/pilot/feedback — whether the signed-in user is a pilot
 * participant at all (used to decide whether to show the "Pilot feedback"
 * link — §43, non-intrusive, no repeated popups). Returns only the caller's
 * own participation, never another user's. */
export const GET: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const { user } = await requireSession(request, db);
    const participations = await getActivePilotParticipationsForUser(db, user.id);
    return jsonResponse(
      ok(
        {
          isPilotParticipant: participations.length > 0,
          participantIds: participations.map((p) => p.id),
        },
        requestId,
      ),
      200,
    );
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};

const feedbackSchema = z.object({
  participantId: z.string().trim().min(1),
  category: z.enum([
    "onboarding",
    "audit_clarity",
    "evidence",
    "recommendation",
    "saved_domain",
    "timeline",
    "monitoring",
    "notification",
    "report_sharing",
    "agency_workspace",
    "pricing",
    "billing",
    "reliability",
    "support",
    "feature_request",
    "other",
  ]),
  usefulness: z.enum(["low", "medium", "high"]).optional(),
  clarity: z.enum(["clear", "unclear"]).optional(),
  difficulty: z.enum(["easy", "moderate", "hard"]).optional(),
  primaryValue: z
    .enum([
      "crawler_matrix",
      "evidence_findings",
      "recommended_configuration",
      "saved_history",
      "monitoring",
      "timeline_attribution",
      "reports_sharing",
      "agency_workflows",
    ])
    .optional(),
  blockingIssue: z.enum(["none", "partial", "blocked"]).optional(),
  purchaseReason: z
    .enum([
      "monitoring",
      "portfolio",
      "evidence",
      "time_saving",
      "client_reporting",
      "change_detection",
      "governance",
      "other",
    ])
    .optional(),
  nonPurchaseReason: z
    .enum([
      "no_current_need",
      "free_is_sufficient",
      "price",
      "missing_capability",
      "trust",
      "unclear_value",
      "too_few_domains",
      "existing_solution",
      "billing_friction",
      "not_decision_maker",
      "other",
    ])
    .optional(),
  // §42: optional, ~1000 chars, rendered only via ordinary JSX/Astro text
  // interpolation — see docs/security/PHASE_17_PILOT_SECURITY_AND_PRIVACY_THREAT_REVIEW.md.
  comment: z.string().trim().max(1000).optional(),
});

/** POST /api/app/pilot/feedback — structured pilot feedback (§41). The
 * feedback text is never included in `product_events` (§144) — only a
 * bare `pilot_feedback_submitted` beacon with the category. */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  const db = createDb(getEnv().DB);
  try {
    const { user } = await requireSession(request, db);

    const body = feedbackSchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) throw new ApiError("VALIDATION_FAILED", "Invalid feedback payload.");

    // Authorization: the participant row must belong to the caller — never
    // trust a client-supplied participantId without ownership verification
    // (§147, §184 cross-account leakage tests).
    const [participant] = await db
      .select({ id: schema.pilotParticipants.id, userId: schema.pilotParticipants.userId })
      .from(schema.pilotParticipants)
      .where(eq(schema.pilotParticipants.id, body.data.participantId))
      .limit(1);
    if (!participant || participant.userId !== user.id) {
      throw new ApiError("FORBIDDEN", "Not a participant in this pilot.");
    }

    const id = await submitPilotFeedback(db, {
      pilotParticipantId: body.data.participantId,
      category: body.data.category,
      usefulness: body.data.usefulness,
      clarity: body.data.clarity,
      difficulty: body.data.difficulty,
      primaryValue: body.data.primaryValue,
      blockingIssue: body.data.blockingIssue,
      purchaseReason: body.data.purchaseReason,
      nonPurchaseReason: body.data.nonPurchaseReason,
      comment: body.data.comment ?? null,
    });

    await trackEvent(db, "pilot_feedback_submitted", {
      userId: user.id,
      properties: { category: body.data.category },
    });

    return jsonResponse(ok({ id }, requestId), 201);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
