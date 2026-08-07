import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { createDb, schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import type { AuditResult } from "../../src/lib/run-audit";
import { createD1TestHarness } from "./d1-harness";
import {
  FAILURE_PAUSE_THRESHOLD,
  runMonitoringSweep,
  type RunAuditFn,
} from "../../src/lib/monitoring";

/**
 * Exercises the real scheduled-monitoring orchestration (claiming/locking,
 * drift detection, failure backoff/pause, notification creation) against a
 * real D1 database, injecting a fake `runAudit` so the test is deterministic
 * and needs no live network access — see monitoring.ts's `RunAuditFn` for
 * why that seam exists.
 */

function fakeAuditResult(options: {
  status: AuditResult["status"];
  score: number | null;
  crawlerResult: "allowed" | "blocked";
}): AuditResult {
  // Phase 10: the Phase 8 attribution model (computeChangeOrigin) determines
  // "did the website change" from comparable *resource content hashes*, not
  // from the evaluated crawler result alone — a blocked/allowed flag with no
  // corresponding robots.txt change would (correctly) attribute as
  // "no_change"/uncertain, matching real deterministic evaluation (identical
  // input always produces identical output). So a "blocked" fixture here
  // must carry different robots.txt body text, not just a different result
  // flag, to look like a real website-side change to domain_change_events.
  const robotsTxtBody =
    options.crawlerResult === "blocked" ? "User-agent: *\nDisallow: /" : "User-agent: *\nAllow: /";
  const crawlerEvaluations: AuditResult["crawlerEvaluations"] = [
    {
      crawlerId: "crawler_test",
      crawlerName: "TestBot",
      operatorName: "Test Operator",
      userAgentToken: "TestBot",
      purpose: "search",
      lifecycleStatus: "active",
      replacementCrawlerId: null,
      result: options.crawlerResult,
      matchedRule: null,
      matchedLineNumber: null,
    },
  ];

  return {
    status: options.status,
    canonicalOrigin: "https://monitoring-test.example",
    crawlerEvaluations,
    conflicts: [],
    findings:
      options.crawlerResult === "blocked"
        ? [
            {
              code: "TEST_FINDING",
              severity: "high",
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
    originalRobotsText: robotsTxtBody,
    proposedRobotsText: robotsTxtBody,
    externalRequestCount: 1,
    scanSignals: {
      canonicalOrigin: "https://monitoring-test.example",
      robotsTxt: {
        attempted: true,
        fetch:
          options.status === "target_unavailable"
            ? null
            : {
                ok: true,
                requestedUrl: "https://monitoring-test.example/robots.txt",
                finalUrl: "https://monitoring-test.example/robots.txt",
                statusCode: 200,
                contentType: "text/plain",
                contentSizeBytes: 20,
                redirectCount: 0,
                durationMs: 5,
                truncated: false,
                body: robotsTxtBody,
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

function queueRunAudit(results: AuditResult[]): RunAuditFn {
  let index = 0;
  return async () => {
    const result = results[Math.min(index, results.length - 1)]!;
    index++;
    return result;
  };
}

async function insertTestUserAndDomain(
  db: Database,
  options: { monitoringFrequency: "weekly" | "monthly"; nextScanAt: string | null },
): Promise<{ userId: string; domainId: string }> {
  const userId = crypto.randomUUID();
  const domainId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(schema.users).values({
    id: userId,
    displayName: "Monitoring Test User",
    status: "active",
    planId: "pro",
    isAdmin: false,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.domains).values({
    id: domainId,
    ownerUserId: userId,
    displayName: "monitoring-test.example",
    canonicalOrigin: "https://monitoring-test.example",
    originalInput: "monitoring-test.example",
    preset: "maximum_ai_visibility",
    monitoringState: "active",
    monitoringFrequency: options.monitoringFrequency,
    nextScanAt: options.nextScanAt,
    consecutiveFailureCount: 0,
    createdAt: now,
    updatedAt: now,
  });

  return { userId, domainId };
}

describe("scheduled monitoring sweep (real D1)", () => {
  let db: Database;
  let dispose: () => Promise<void>;

  beforeAll(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    db = createDb(harness.db);
  });

  afterAll(async () => {
    await dispose();
  });

  it("scans a due domain, records the result, and does not re-select it before its next scan is due", async () => {
    const { domainId } = await insertTestUserAndDomain(db, {
      monitoringFrequency: "weekly",
      nextScanAt: null,
    });

    const result = await runMonitoringSweep(
      db,
      queueRunAudit([
        fakeAuditResult({ status: "completed", score: 88, crawlerResult: "allowed" }),
      ]),
    );
    expect(result).toEqual({ domainsSelected: 1, scansCompleted: 1, scansFailed: 0 });

    const [domain] = await db
      .select()
      .from(schema.domains)
      .where(eq(schema.domains.id, domainId))
      .limit(1);
    expect(domain!.lastScanId).not.toBeNull();
    expect(domain!.currentScore).toBe(88);
    expect(domain!.consecutiveFailureCount).toBe(0);
    expect(new Date(domain!.nextScanAt!).getTime()).toBeGreaterThan(Date.now());

    const [scanRow] = await db
      .select()
      .from(schema.scans)
      .where(eq(schema.scans.id, domain!.lastScanId!))
      .limit(1);
    expect(scanRow!.triggeredBy).toBe("scheduled");

    // Immediately due again? No — nextScanAt was pushed a week out.
    const secondSweep = await runMonitoringSweep(
      db,
      queueRunAudit([
        fakeAuditResult({ status: "completed", score: 90, crawlerResult: "allowed" }),
      ]),
    );
    expect(secondSweep.domainsSelected).toBe(0);
  });

  it("detects semantic drift between scans and creates a notification", async () => {
    const { userId, domainId } = await insertTestUserAndDomain(db, {
      monitoringFrequency: "weekly",
      nextScanAt: null,
    });

    await runMonitoringSweep(
      db,
      queueRunAudit([
        fakeAuditResult({ status: "completed", score: 95, crawlerResult: "allowed" }),
      ]),
    );

    // Force it due again to simulate the next scheduled run.
    await db
      .update(schema.domains)
      .set({ nextScanAt: null })
      .where(eq(schema.domains.id, domainId));

    await runMonitoringSweep(
      db,
      queueRunAudit([
        fakeAuditResult({ status: "completed", score: 40, crawlerResult: "blocked" }),
      ]),
    );

    const diffs = await db
      .select()
      .from(schema.scanDiffs)
      .where(eq(schema.scanDiffs.domainId, domainId));
    expect(diffs).toHaveLength(1);
    expect(diffs[0]!.diffType).toBe("website_drift");

    const notifications = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, userId));
    expect(notifications.some((n) => n.type === "high_severity_policy_change")).toBe(true);
  });

  it("backs off on repeated failures and pauses monitoring after the threshold, notifying at each stage", async () => {
    const { userId, domainId } = await insertTestUserAndDomain(db, {
      monitoringFrequency: "weekly",
      nextScanAt: null,
    });

    for (let attempt = 1; attempt <= FAILURE_PAUSE_THRESHOLD; attempt++) {
      await db
        .update(schema.domains)
        .set({ nextScanAt: null })
        .where(eq(schema.domains.id, domainId));
      await runMonitoringSweep(
        db,
        queueRunAudit([
          fakeAuditResult({ status: "target_unavailable", score: null, crawlerResult: "allowed" }),
        ]),
      );
    }

    const [domain] = await db
      .select()
      .from(schema.domains)
      .where(eq(schema.domains.id, domainId))
      .limit(1);
    expect(domain!.consecutiveFailureCount).toBe(FAILURE_PAUSE_THRESHOLD);
    expect(domain!.monitoringState).toBe("paused");
    expect(domain!.nextScanAt).toBeNull();

    const notifications = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, userId));
    expect(notifications.some((n) => n.type === "monitoring_paused")).toBe(true);
    // Phase 10 (§21, incident-level grouping): repeated resource_failure
    // notifications for the same failure episode collapse onto ONE row —
    // not one row per failure — with occurrenceCount tracking the count.
    // No notification for the very first (transient) failure, so the final
    // occurrenceCount equals the failure count at the moment it stopped
    // being grouped (one failure short of the pause threshold, since the
    // threshold-crossing failure gets `monitoring_paused` instead).
    const resourceFailureRows = notifications.filter((n) => n.type === "resource_failure");
    expect(resourceFailureRows).toHaveLength(1);
    expect(resourceFailureRows[0]!.occurrenceCount).toBe(FAILURE_PAUSE_THRESHOLD - 1);

    // Paused domains are never selected again.
    const nextSweep = await runMonitoringSweep(
      db,
      queueRunAudit([
        fakeAuditResult({ status: "completed", score: 100, crawlerResult: "allowed" }),
      ]),
    );
    expect(nextSweep.domainsSelected).toBe(0);
  });

  it("prioritises the most-overdue domains first when the due backlog exceeds the batch size (Phase 11, RISK-008 fair scheduling)", async () => {
    // A never-scanned domain (nextScanAt: null) is the most overdue of all,
    // then oldest-timestamp-first, then the least-overdue due domain.
    const { domainId: neverScanned } = await insertTestUserAndDomain(db, {
      monitoringFrequency: "weekly",
      nextScanAt: null,
    });
    const { domainId: oldestDue } = await insertTestUserAndDomain(db, {
      monitoringFrequency: "weekly",
      nextScanAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const { domainId: leastOverdue } = await insertTestUserAndDomain(db, {
      monitoringFrequency: "weekly",
      nextScanAt: new Date(Date.now() - 60 * 1000).toISOString(),
    });

    await db
      .update(schema.runtimeConfiguration)
      .set({ value: "2" })
      .where(eq(schema.runtimeConfiguration.key, "monitoring_scan_batch_size"));

    const result = await runMonitoringSweep(
      db,
      queueRunAudit([
        fakeAuditResult({ status: "completed", score: 90, crawlerResult: "allowed" }),
        fakeAuditResult({ status: "completed", score: 90, crawlerResult: "allowed" }),
      ]),
    );
    expect(result.domainsSelected).toBe(2);

    const domains = await db
      .select({ id: schema.domains.id, lastScanId: schema.domains.lastScanId })
      .from(schema.domains)
      .where(inArray(schema.domains.id, [neverScanned, oldestDue, leastOverdue]));
    const wasScanned = (id: string) => domains.find((d) => d.id === id)!.lastScanId !== null;

    expect(wasScanned(neverScanned)).toBe(true);
    expect(wasScanned(oldestDue)).toBe(true);
    // The least-overdue domain lost the batch-size cap to the two more
    // overdue ones — this is exactly the fairness property under test.
    expect(wasScanned(leastOverdue)).toBe(false);

    // Restore the default so this test doesn't affect any test that runs after it.
    await db
      .update(schema.runtimeConfiguration)
      .set({ value: "20" })
      .where(eq(schema.runtimeConfiguration.key, "monitoring_scan_batch_size"));
  });
});
