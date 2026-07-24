import type { APIRoute } from "astro";
import { ApiError, createAuditRequestSchema, fail, normalizeTarget, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../lib/env";
import { getActiveRegistry } from "../../../lib/registry-data";
import { runAudit } from "../../../lib/run-audit";
import { persistScan } from "../../../lib/persist-scan";
import { trackEvent } from "../../../lib/analytics";
import { getBlockedTargetPatterns } from "../../../lib/blocked-targets";
import { getBoolConfig, getIntConfig } from "../../../lib/runtime-config";
import { hashIp } from "../../../lib/ip-hash";
import { isRateLimited, recordSecurityEvent } from "../../../lib/auth/rate-limit";

export const prerender = false;

/**
 * POST /api/audit — SRS §14, FR-AUD-001. Validates and normalises the
 * target, then either runs a real, bounded scan (Part 2) or, while the
 * scanner is disabled in this environment, returns AUDIT_ENGINE_DISABLED.
 * This handler must never fabricate a completed/mocked audit result — see
 * docs/status/KNOWN_RISKS.md.
 *
 * The scan runs synchronously within this request (no background job
 * queue exists — see docs/status/KNOWN_RISKS.md for why, and the request
 * budget/timeouts in ADR-0005 for why this stays bounded).
 */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      fail(new ApiError("VALIDATION_FAILED", "Request body must be valid JSON."), requestId),
      400,
    );
  }

  const parsed = createAuditRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      fail(
        new ApiError("VALIDATION_FAILED", "Enter a domain, such as example.com", {
          issues: parsed.error.issues,
        }),
        requestId,
      ),
      400,
    );
  }

  const normalized = normalizeTarget(parsed.data.target);
  if (!normalized.ok) {
    const message =
      normalized.reason === "literal_ip"
        ? "CrawlPact does not audit literal IP addresses in this release."
        : normalized.reason === "unsupported_scheme"
          ? "This URL scheme is not supported."
          : "This does not look like a valid domain or URL.";
    return jsonResponse(fail(new ApiError("AUDIT_TARGET_INVALID", message), requestId), 400);
  }

  const auditEngineEnabled = getEnv().AUDIT_ENGINE_ENABLED === "true";
  if (!auditEngineEnabled) {
    return jsonResponse(
      fail(
        new ApiError(
          "AUDIT_ENGINE_DISABLED",
          "The audit engine is not enabled in this environment yet. This will run a real scan of your declared AI crawler policy once the scanner ships.",
        ),
        requestId,
      ),
      503,
    );
  }

  const preset = "maximum_ai_visibility" as const;

  // Everything from here on depends on the D1 binding and the network —
  // both can fail in ways unrelated to the caller's input, so this is one
  // try/catch, not several, ensuring every failure path still returns the
  // standard JSON envelope rather than an unhandled exception (which Astro
  // would otherwise render as an HTML error page instead of JSON).
  try {
    const db = createDb(getEnv().DB);

    // SRS §28.17: maintenance mode pauses new audits. This route has no
    // session (anonymous), so it can't reuse require-session.ts's admin
    // bypass — that's correct here, since an anonymous caller is never an
    // administrator anyway.
    if (await getBoolConfig(db, "maintenance_mode", false)) {
      return jsonResponse(
        fail(
          new ApiError(
            "MAINTENANCE_MODE_ACTIVE",
            "CrawlPact is in maintenance mode. New audits are temporarily paused.",
          ),
          requestId,
        ),
        503,
      );
    }

    const registry = await getActiveRegistry(db);
    if (!registry) {
      return jsonResponse(
        fail(
          new ApiError("SERVICE_UNAVAILABLE", "No active crawler registry release is configured."),
          requestId,
        ),
        503,
      );
    }

    // SRS §28.8 / docs/security/SSRF_SECURITY_MODEL.md: anonymous audits are
    // capped per IP per day, tunable via runtime_configuration without a
    // redeploy.
    const ipHash = await hashIp(request);
    if (ipHash) {
      const dailyLimit = await getIntConfig(db, "anonymous_audit_daily_limit", 20);
      const limited = await isRateLimited(db, "rate_limit", ipHash, {
        max: dailyLimit,
        windowMs: 24 * 60 * 60 * 1000,
      });
      if (limited) {
        return jsonResponse(
          fail(
            new ApiError(
              "RATE_LIMITED",
              `You've reached the daily limit of ${dailyLimit} free audits from this network. Try again tomorrow, or create an account.`,
            ),
            requestId,
          ),
          429,
        );
      }
      await recordSecurityEvent(db, "rate_limit", { ipHash, target: normalized.normalizedOrigin });
    }

    await trackEvent(db, "audit_started", { properties: { trigger: "anonymous" } });

    const blocklist = await getBlockedTargetPatterns(db);
    const totalTimeoutMs = (await getIntConfig(db, "scan_total_timeout_seconds", 30)) * 1000;
    const auditResult = await runAudit(
      normalized.normalizedOrigin,
      preset,
      registry.crawlers,
      registry.rulesetVersionId,
      { blocklist, totalTimeoutMs },
    );

    if (
      auditResult.scanSignals.robotsTxt.fetch?.ok === false &&
      auditResult.scanSignals.robotsTxt.fetch.errorCategory === "unsafe_target"
    ) {
      await recordSecurityEvent(db, "unsafe_scan_attempt", {
        ipHash,
        target: normalized.normalizedOrigin,
      });
    }

    const scanId = crypto.randomUUID();
    await persistScan(
      db,
      {
        scanId,
        targetInput: parsed.data.target,
        preset,
        registryVersionId: registry.registryVersionId,
        rulesetVersionId: registry.rulesetVersionId,
      },
      auditResult,
    );

    const succeeded =
      auditResult.status === "completed" || auditResult.status === "completed_with_warnings";
    await trackEvent(db, succeeded ? "audit_completed" : "audit_failed", {
      properties: { status: auditResult.status },
    });

    return jsonResponse(
      ok(
        {
          auditId: scanId,
          status: auditResult.status,
          originalInput: parsed.data.target,
          normalizedOrigin: normalized.normalizedOrigin,
        },
        requestId,
      ),
      200,
    );
  } catch (error) {
    return jsonResponse(
      fail(
        new ApiError("INTERNAL_ERROR", "The audit could not be completed.", {
          message: error instanceof Error ? error.message : String(error),
        }),
        requestId,
      ),
      500,
    );
  }
};

function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
