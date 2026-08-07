import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import type { AuditResult } from "../../src/lib/run-audit";
import { createD1TestHarness } from "./d1-harness";

/**
 * Phase 10's non-negotiable acceptance criterion (§7, §78): "A notification
 * failure must never convert a successful scan into a failed scan, corrupt
 * the domain's monitoring state, delay the next scheduled scan incorrectly,
 * or cause a successful audit to be persisted as a failure." This file
 * proves it against the real orchestration in monitoring.ts, by forcing the
 * notification-write functions to throw and observing that scan/monitoring
 * truth is entirely unaffected — plus the companion platform-vs-target
 * failure-classification requirement (§22-23).
 */

let shouldFailNotificationWrites = false;

vi.mock("../../src/lib/notifications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/notifications")>();
  return {
    ...actual,
    createNotificationOnce: async (...args: Parameters<typeof actual.createNotificationOnce>) => {
      if (shouldFailNotificationWrites) throw new Error("simulated notification write failure");
      return actual.createNotificationOnce(...args);
    },
    upsertGroupedNotification: async (
      ...args: Parameters<typeof actual.upsertGroupedNotification>
    ) => {
      if (shouldFailNotificationWrites) throw new Error("simulated notification write failure");
      return actual.upsertGroupedNotification(...args);
    },
  };
});

const { runMonitoringSweep, FAILURE_PAUSE_THRESHOLD } = await import("../../src/lib/monitoring");
const { reconcileMissingPolicyChangeNotifications } =
  await import("../../src/lib/notification-reconciliation");

function fakeAuditResult(options: {
  status: AuditResult["status"];
  score: number | null;
  robotsTxtBody: string;
}): AuditResult {
  const blocked = options.robotsTxtBody.includes("Disallow");
  return {
    status: options.status,
    canonicalOrigin: "https://outcome-isolation-test.example",
    crawlerEvaluations: [
      {
        crawlerId: "crawler_test",
        crawlerName: "TestBot",
        operatorName: "Test Operator",
        userAgentToken: "TestBot",
        purpose: "search",
        lifecycleStatus: "active",
        replacementCrawlerId: null,
        result: blocked ? "blocked" : "allowed",
        matchedRule: null,
        matchedLineNumber: null,
      },
    ],
    conflicts: [],
    findings: blocked
      ? [
          {
            code: "TEST_FINDING",
            severity: "critical",
            category: "visibility",
            title: "Test finding",
            summary: "Test",
            whatHappened: "Test",
            whyItMatters: "Test",
            evidenceSummary: "Test",
            recommendedAction: "Test",
            limitation: null,
            confidence: "high",
            sourceUrl: null,
            rulesetVersion: "rules_test",
            affectedCrawlerId: "crawler_test",
            fingerprint: "test-fingerprint",
          },
        ]
      : [],
    score:
      options.score === null
        ? { state: "incomplete" }
        : {
            state: "scored",
            value: options.score,
            label: "test",
            categoryBreakdown: {
              resource_availability: 100,
              syntax_evaluation: 100,
              objective_alignment: 100,
              cross_signal_consistency: 100,
              registry_freshness: 100,
              monitoring_change_risk: 100,
            },
          },
    recommendation: { proposedAdditions: [], warnings: [] },
    diff: [],
    originalRobotsText: options.robotsTxtBody,
    proposedRobotsText: options.robotsTxtBody,
    externalRequestCount: 1,
    scanSignals: {
      canonicalOrigin: "https://outcome-isolation-test.example",
      robotsTxt: {
        attempted: true,
        fetch:
          options.status === "target_unavailable"
            ? null
            : {
                ok: true,
                requestedUrl: "https://outcome-isolation-test.example/robots.txt",
                finalUrl: "https://outcome-isolation-test.example/robots.txt",
                statusCode: 200,
                contentType: "text/plain",
                contentSizeBytes: options.robotsTxtBody.length,
                redirectCount: 0,
                durationMs: 5,
                truncated: false,
                body: options.robotsTxtBody,
              },
        parsed: null,
      },
      llmsTxt: { attempted: false, fetch: null, parsed: null },
      llmsFullTxt: { attempted: false, fetch: null, parsed: null },
      sitemap: { attempted: false, fetch: null, parsed: null },
      homepage: { attempted: false, fetch: null, parsed: null },
      rsl: { attempted: false, fetch: null, parsed: null },
      contentSignals: null,
      xRobotsTag: [],
      externalRequestCount: 1,
    },
  } as AuditResult;
}

async function insertTestUserAndDomain(
  db: Database,
  label: string,
): Promise<{ userId: string; domainId: string; canonicalOrigin: string }> {
  const userId = crypto.randomUUID();
  const domainId = crypto.randomUUID();
  const canonicalOrigin = `https://${label}.outcome-isolation-test.example`;
  const now = new Date().toISOString();

  await db.insert(schema.users).values({
    id: userId,
    displayName: "Outcome Isolation Test User",
    status: "active",
    planId: "pro",
    isAdmin: false,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.domains).values({
    id: domainId,
    ownerUserId: userId,
    displayName: `${label}.outcome-isolation-test.example`,
    canonicalOrigin,
    originalInput: `${label}.outcome-isolation-test.example`,
    preset: "maximum_ai_visibility",
    monitoringState: "active",
    monitoringFrequency: "weekly",
    nextScanAt: null,
    consecutiveFailureCount: 0,
    createdAt: now,
    updatedAt: now,
  });

  return { userId, domainId, canonicalOrigin };
}

describe("monitoring outcome isolation (real D1)", () => {
  let db: Database;
  let dispose: () => Promise<void>;

  beforeAll(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    db = createDb(harness.db);
  });

  afterEach(() => {
    shouldFailNotificationWrites = false;
  });

  afterAll(async () => {
    await dispose();
  });

  it("a successful scan whose notification write fails remains a successful scan with correct monitoring state", async () => {
    const { userId, domainId } = await insertTestUserAndDomain(db, "success");

    // Baseline scan first (no drift possible on the very first scan).
    await runMonitoringSweep(db, async () =>
      fakeAuditResult({ status: "completed", score: 90, robotsTxtBody: "User-agent: *\nAllow: /" }),
    );
    await db
      .update(schema.domains)
      .set({ nextScanAt: null })
      .where(eq(schema.domains.id, domainId));

    shouldFailNotificationWrites = true;
    const result = await runMonitoringSweep(db, async () =>
      fakeAuditResult({
        status: "completed",
        score: 40,
        robotsTxtBody: "User-agent: *\nDisallow: /",
      }),
    );

    // The scan itself is unaffected by the notification failure.
    expect(result).toEqual({ domainsSelected: 1, scansCompleted: 1, scansFailed: 0 });

    const [domain] = await db
      .select()
      .from(schema.domains)
      .where(eq(schema.domains.id, domainId))
      .limit(1);
    expect(domain!.currentScore).toBe(40);
    expect(domain!.consecutiveFailureCount).toBe(0);
    expect(domain!.monitoringState).toBe("active");
    expect(new Date(domain!.nextScanAt!).getTime()).toBeGreaterThan(Date.now());

    const [scanRow] = await db
      .select()
      .from(schema.scans)
      .where(eq(schema.scans.id, domain!.lastScanId!))
      .limit(1);
    expect(scanRow!.status).toBe("completed");

    // The domain_change_event committed even though the notification did not.
    const events = await db
      .select()
      .from(schema.domainChangeEvents)
      .where(eq(schema.domainChangeEvents.domainId, domainId));
    expect(events.some((e) => e.eventType === "website_policy_change")).toBe(true);

    // The notification is indeed missing — this is the recoverable gap
    // reconciliation exists to close.
    const notificationsBeforeReconcile = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, userId));
    expect(notificationsBeforeReconcile).toHaveLength(0);

    // Reconciliation recovers exactly one notification.
    shouldFailNotificationWrites = false;
    const reconcileResult = await reconcileMissingPolicyChangeNotifications(db, new Date());
    expect(reconcileResult.created).toBe(1);

    const notificationsAfterReconcile = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, userId));
    expect(notificationsAfterReconcile).toHaveLength(1);
    expect(notificationsAfterReconcile[0]!.type).toBe("critical_policy_change");

    // Reconciliation is idempotent: running it again creates nothing new.
    const secondReconcile = await reconcileMissingPolicyChangeNotifications(db, new Date());
    expect(secondReconcile.created).toBe(0);
    const notificationsAfterSecondReconcile = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, userId));
    expect(notificationsAfterSecondReconcile).toHaveLength(1);
  });

  it("a target-side failure increments the failure count and can pause monitoring; a platform-side failure never does either", async () => {
    const { domainId: targetDomainId, canonicalOrigin: targetOrigin } =
      await insertTestUserAndDomain(db, "target-classification");
    const { domainId: platformDomainId } = await insertTestUserAndDomain(
      db,
      "platform-classification",
    );

    // Both domains are due in the same sweep; the injected runAuditFn
    // decides per-domain from the canonical origin it's called with — a
    // completed-but-unreachable result for the target-side domain, a thrown
    // exception (never a legitimate per-domain outcome) for the other.
    await runMonitoringSweep(db, async (origin) => {
      if (origin === targetOrigin) {
        return fakeAuditResult({ status: "target_unavailable", score: null, robotsTxtBody: "" });
      }
      throw new Error("simulated platform-side failure (D1/worker exception)");
    });

    const [targetDomain] = await db
      .select()
      .from(schema.domains)
      .where(eq(schema.domains.id, targetDomainId))
      .limit(1);
    const [platformDomain] = await db
      .select()
      .from(schema.domains)
      .where(eq(schema.domains.id, platformDomainId))
      .limit(1);

    expect(targetDomain!.consecutiveFailureCount).toBe(1);
    expect(targetDomain!.failureEpisodeId).not.toBeNull();

    // The platform failure must never be counted as a target failure, must
    // never pause monitoring, and must never touch the failure episode.
    expect(platformDomain!.consecutiveFailureCount).toBe(0);
    expect(platformDomain!.failureEpisodeId).toBeNull();
    expect(platformDomain!.monitoringState).toBe("active");

    const platformScan = await db
      .select()
      .from(schema.scans)
      .where(eq(schema.scans.domainId, platformDomainId))
      .limit(1);
    expect(platformScan[0]!.status).toBe("internal_failure");

    // No user-facing notification for a platform-side failure — it isn't
    // something the user can act on.
    const platformNotifications = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.domainId, platformDomainId));
    expect(platformNotifications).toHaveLength(0);
  });

  it("repeated platform-side failures never reach the pause threshold", async () => {
    const { domainId } = await insertTestUserAndDomain(db, "repeated-platform-failure");

    for (let i = 0; i < FAILURE_PAUSE_THRESHOLD + 2; i++) {
      await db
        .update(schema.domains)
        .set({ nextScanAt: null })
        .where(eq(schema.domains.id, domainId));
      await runMonitoringSweep(db, async () => {
        throw new Error("simulated platform-side failure");
      });
    }

    const [domain] = await db
      .select()
      .from(schema.domains)
      .where(eq(schema.domains.id, domainId))
      .limit(1);
    expect(domain!.consecutiveFailureCount).toBe(0);
    expect(domain!.monitoringState).toBe("active");
  });
});
