import type { APIRoute } from "astro";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireSession } from "../../../../lib/auth/require-session";
import { consumeContinuation, establishBaseline } from "../../../../lib/audit-continuation";
import { createDomain, findOwnedDomainByOrigin, updateDomain } from "../../../../lib/domains";
import { getPlan } from "../../../../lib/plan";
import { trackEvent } from "../../../../lib/analytics";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

/**
 * POST /api/audit/continuation/:continuationId — the authenticated handoff step (Phase 5). Only
 * ever called from a signed-in user's own explicit "Confirm" click on /app/continue (never
 * auto-fired on page load) — see docs/security/PHASE_05_AUDIT_CONVERSION_THREAT_REVIEW.md for why
 * that distinction matters: this performs a real domain save + scan, and an auto-firing GET/mount
 * would let a lured top-level navigation to someone else's continuation link spend the victim's
 * saved-domain slot without them ever seeing what they were agreeing to.
 *
 * Consumes the continuation exactly once (`consumeContinuation`'s atomic CAS), then either adopts
 * the anonymous scan or reruns it under the new owner (`establishBaseline`). Monitoring is always
 * left paused here — enabling it is a separate, explicit PATCH /api/domains/:domainId step,
 * matching the SRS-adjacent requirement that monitoring activation requires explicit user intent.
 * This does not change POST /api/domains' own auto-active default for the pre-existing "add a
 * domain" flow.
 */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    const continuationId = params.continuationId;
    if (!continuationId) throw new ApiError("VALIDATION_FAILED", "Missing continuation id.");

    const consumed = await consumeContinuation(db, continuationId);
    if (!consumed.ok) {
      const message =
        consumed.reason === "already_consumed"
          ? "This save link has already been used."
          : consumed.reason === "expired"
            ? "This save link has expired. Go back to the report and try again."
            : "This save link is not valid.";
      throw new ApiError("AUDIT_CONTINUATION_INVALID", message);
    }

    const { scanId, canonicalOrigin, intendedAction } = consumed.continuation;
    const plan = await getPlan(db, user.planId);

    await trackEvent(db, "audit_domain_save_started", {
      userId: user.id,
      properties: { intendedAction },
    });

    const created = await createDomain(db, user.id, {
      canonicalOrigin,
      originalInput: canonicalOrigin,
      displayName: new URL(canonicalOrigin).hostname,
      groupId: null,
      preset: undefined,
      savedDomainLimit: plan.savedDomainLimit,
      monitoringFrequency: plan.monitoringFrequency,
    });

    let domainId: string;
    let domainPreset: string;
    if (created.ok) {
      domainId = created.domain.id;
      domainPreset = created.domain.preset;
      // See the handler doc comment above: this flow never leaves monitoring auto-active.
      await updateDomain(db, user.id, domainId, { monitoringState: "paused" });
    } else if (created.reason === "duplicate") {
      const existing = await findOwnedDomainByOrigin(db, user.id, canonicalOrigin);
      if (!existing) throw new ApiError("INTERNAL_ERROR", "Could not save this domain.");
      domainId = existing.id;
      domainPreset = existing.preset;
    } else if (created.reason === "limit_reached") {
      await trackEvent(db, "audit_conversion_plan_limit_reached", { userId: user.id });
      throw new ApiError(
        "DOMAIN_LIMIT_REACHED",
        `Your plan allows up to ${plan.savedDomainLimit} saved domain${plan.savedDomainLimit === 1 ? "" : "s"}. Manage your existing domains to free up a slot, or upgrade your plan.`,
      );
    } else {
      throw new ApiError("INTERNAL_ERROR", "Could not save this domain.");
    }

    const auditEngineEnabled = getEnv().AUDIT_ENGINE_ENABLED === "true";
    const baseline = await establishBaseline(db, {
      scanId,
      domainId,
      domainCanonicalOrigin: canonicalOrigin,
      domainPreset,
      userId: user.id,
      monitoringFrequency: plan.monitoringFrequency,
      auditEngineEnabled,
      onRerunStarting: () => {
        void trackEvent(db, "audit_baseline_rerun_started", { userId: user.id });
      },
    });

    const monitoringEligible = plan.monitoringFrequency !== "none";

    if (baseline.strategy === "failed") {
      await trackEvent(db, "audit_conversion_failed", {
        userId: user.id,
        properties: { reason: baseline.reason },
      });
      const warning =
        baseline.reason === "engine_disabled"
          ? "The audit engine is not enabled in this environment yet. Your domain has been saved — a starting result will appear once scanning is enabled."
          : baseline.reason === "scan_missing"
            ? "The original scan is no longer available. Your domain has been saved — run a scan to get a starting result."
            : "A starting result could not be generated. Your domain has been saved — try scanning it again shortly.";
      return jsonResponse(
        ok(
          {
            domainId,
            canonicalOrigin,
            baselineEstablished: false,
            baselineStrategy: null,
            scoreValue: null,
            monitoringEligible,
            warning,
          },
          requestId,
        ),
        200,
      );
    }

    await trackEvent(
      db,
      baseline.strategy === "adopted" ? "audit_baseline_adopted" : "audit_baseline_rerun_completed",
      {
        userId: user.id,
      },
    );
    await trackEvent(db, "audit_conversion_completed", {
      userId: user.id,
      properties: { intendedAction, baselineStrategy: baseline.strategy },
    });

    return jsonResponse(
      ok(
        {
          domainId,
          canonicalOrigin,
          baselineEstablished: true,
          baselineStrategy: baseline.strategy,
          scoreValue: baseline.scoreValue,
          monitoringEligible,
          warning: null,
        },
        requestId,
      ),
      200,
    );
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
