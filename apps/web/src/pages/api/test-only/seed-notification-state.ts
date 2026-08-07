import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { ApiError, ok } from "@crawlpact/core";
import { createDb, schema } from "@crawlpact/database";
import { getEnv } from "../../../lib/env";
import { assertTestOnlyAccess } from "../../../lib/test-only";
import { requireSession } from "../../../lib/auth/require-session";
import { createNotificationOnce, upsertGroupedNotification } from "../../../lib/notifications";
import { buildPolicyChangeNotificationIntent } from "../../../lib/notification-intents";
import { jsonErrorResponse, jsonResponse } from "../../../lib/json-response";

export const prerender = false;

type PolicyChangeOrigin = "website_policy" | "registry_driven" | "mixed";

/**
 * e2e-only (Phase 10): materialises a realistic monitoring/notification
 * outcome for a domain the calling session already owns, without waiting for
 * a real scheduled scan — mirrors set-plan.ts's self-service,
 * calling-session-only pattern. Every code path here calls the exact same
 * production functions monitoring.ts uses
 * (`buildPolicyChangeNotificationIntent`, `createNotificationOnce`,
 * `upsertGroupedNotification`), so an e2e assertion against the result is an
 * assertion against real notification-content logic, not a fixture double.
 */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    assertTestOnlyAccess(request);
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    const body = (await request.json().catch(() => null)) as {
      action?: "policy_change" | "resource_failure_episode" | "monitoring_paused";
      domainId?: string;
      origin?: PolicyChangeOrigin;
      hasCritical?: boolean;
      occurrenceCount?: number;
    } | null;
    if (!body?.action || !body.domainId) {
      throw new ApiError("VALIDATION_FAILED", "action and domainId are required.");
    }

    const [domain] = await db
      .select()
      .from(schema.domains)
      .where(eq(schema.domains.id, body.domainId))
      .limit(1);
    if (!domain || domain.ownerUserId !== user.id) {
      throw new ApiError("NOT_FOUND", "Domain not found.");
    }

    if (body.action === "policy_change") {
      const origin = body.origin ?? "website_policy";
      const eventType =
        origin === "registry_driven"
          ? "registry_driven_change"
          : origin === "mixed"
            ? "mixed_change"
            : "website_policy_change";
      const summary =
        origin === "registry_driven"
          ? "The website's published signals remained unchanged, but CrawlPact's verified crawler registry changed."
          : origin === "mixed"
            ? "Both the website's published policy and the verified crawler registry changed."
            : "The website's published crawler-policy signals changed since the previous comparable scan.";
      const now = new Date().toISOString();
      const eventId = crypto.randomUUID();
      await db.insert(schema.domainChangeEvents).values({
        id: eventId,
        domainId: domain.id,
        eventType,
        changeOrigin: origin === "website_policy" ? "website_policy" : origin,
        attentionLevel: "high_attention",
        observedAt: now,
        previousScanId: null,
        currentScanId: null,
        previousRegistryVersionId: null,
        currentRegistryVersionId: null,
        affectedPurposesJson: "[]",
        findingCountsJson: "{}",
        summary,
        detailsJson: JSON.stringify({
          findingLifecycle: body.hasCritical
            ? [{ state: "appeared", severity: "critical" }]
            : [{ state: "appeared", severity: "high" }],
        }),
        completeness: "complete",
        fingerprint: crypto.randomUUID(),
        modelVersion: "1",
        createdAt: now,
      });
      const [event] = await db
        .select()
        .from(schema.domainChangeEvents)
        .where(eq(schema.domainChangeEvents.id, eventId))
        .limit(1);
      const intent = buildPolicyChangeNotificationIntent(domain, event!);
      if (!intent)
        throw new ApiError("VALIDATION_FAILED", "Seeded event did not merit a notification.");
      await createNotificationOnce(db, { userId: user.id, domainId: domain.id, ...intent });
      return jsonResponse(ok({ eventId, notificationType: intent.type }, requestId), 200);
    }

    const failureEpisodeId = domain.failureEpisodeId ?? crypto.randomUUID();
    await db
      .update(schema.domains)
      .set({
        failureEpisodeId,
        consecutiveFailureCount: body.occurrenceCount ?? 2,
        monitoringState: body.action === "monitoring_paused" ? "paused" : "active",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.domains.id, domain.id));

    if (body.action === "monitoring_paused") {
      await createNotificationOnce(db, {
        userId: user.id,
        domainId: domain.id,
        type: "monitoring_paused",
        category: "monitoring_health",
        priority: "high",
        title: `Monitoring paused for ${domain.displayName}`,
        body: `CrawlPact could not complete 5 scheduled audits in a row for ${domain.displayName}, so automatic monitoring has been paused. Review the domain before resuming monitoring.`,
        sourceType: "scan_failure_episode",
        sourceId: failureEpisodeId,
        dedupeKey: `monitoring_paused:${failureEpisodeId}`,
        actionPath: `/app/domains/${domain.id}`,
      });
    } else {
      const occurrenceCount = body.occurrenceCount ?? 2;
      await upsertGroupedNotification(db, {
        userId: user.id,
        domainId: domain.id,
        type: "resource_failure",
        category: "monitoring_health",
        priority: "normal",
        title: `${domain.displayName} could not be scanned`,
        body: `CrawlPact could not complete the scheduled audit for ${domain.displayName}. This is attempt ${occurrenceCount} of 5 before monitoring pauses automatically; it will retry on the usual schedule.`,
        sourceType: "scan_failure_episode",
        sourceId: failureEpisodeId,
        dedupeKey: `resource_failure:${failureEpisodeId}`,
        actionPath: `/app/domains/${domain.id}`,
        occurrenceCount,
      });
    }

    return jsonResponse(ok({ failureEpisodeId }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
