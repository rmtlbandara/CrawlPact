import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { createD1TestHarness } from "./d1-harness";
import { computeChangeOrigin } from "../../src/lib/change-attribution";
import {
  generatePresetChangeEvent,
  generateTimelineEvent,
  listDomainChangeEvents,
} from "../../src/lib/domain-timeline";
import { classifyFindingLifecycle } from "../../src/lib/finding-lifecycle";
import { compareScans } from "../../src/lib/domain-comparison";
import { retentionBoundaryFor, listScanHistory } from "../../src/lib/scan-history";
import { releaseScanLock, tryClaimScanLock } from "../../src/lib/scan-lock";
import { updateDomain } from "../../src/lib/domains";
import { establishBaseline } from "../../src/lib/audit-continuation";

/**
 * Exercises Phase 8's change-attribution, timeline-event generation,
 * finding-lifecycle, comparison, scan-lock, and pagination logic against a
 * real D1 database — mirroring the existing monitoring.integration.test.ts
 * convention (real schema, fake-free business logic).
 */

let db: Database;
let dispose: () => Promise<void>;

beforeAll(async () => {
  const harness = await createD1TestHarness();
  dispose = harness.dispose;
  db = createDb(harness.db);

  await db.insert(schema.registryVersions).values({
    id: "reg_test_2",
    versionLabel: "test-2",
    changelog: "Second test registry release.",
    isActive: false,
    createdAt: new Date().toISOString(),
  });
});

afterAll(async () => {
  await dispose();
});

async function createUserAndDomain(planId = "pro"): Promise<{ userId: string; domainId: string }> {
  const userId = crypto.randomUUID();
  const domainId = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.users).values({
    id: userId,
    displayName: "Timeline Test User",
    status: "active",
    planId,
    isAdmin: false,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.domains).values({
    id: domainId,
    ownerUserId: userId,
    displayName: "timeline-test.example",
    canonicalOrigin: "https://timeline-test.example",
    originalInput: "timeline-test.example",
    preset: "maximum_ai_visibility",
    monitoringState: "active",
    monitoringFrequency: "weekly",
    consecutiveFailureCount: 0,
    createdAt: now,
    updatedAt: now,
  });
  return { userId, domainId };
}

let scanCounter = 0;
async function createScan(
  domainId: string,
  options: {
    status?: string;
    registryVersionId?: string;
    robotsTxtHash?: string | null;
    findings?: {
      code: string;
      severity: string;
      affectedCrawlerId?: string | null;
      evidenceSummary: string;
      fingerprint: string;
    }[];
  } = {},
): Promise<string> {
  scanCounter++;
  const scanId = `scan_${scanCounter}_${crypto.randomUUID()}`;
  const now = new Date(Date.now() + scanCounter).toISOString(); // strictly increasing
  await db.insert(schema.scans).values({
    id: scanId,
    domainId,
    triggeredBy: "manual",
    targetInput: "https://timeline-test.example",
    canonicalOrigin: "https://timeline-test.example",
    status: (options.status ?? "completed") as never,
    preset: "maximum_ai_visibility",
    registryVersionId: options.registryVersionId ?? "reg_test",
    rulesetVersionId: "rules_test",
    score: 80,
    scoreState: "scored",
    startedAt: now,
    completedAt: now,
  });
  if (options.robotsTxtHash !== null) {
    await db.insert(schema.scanResources).values({
      id: `${scanId}_robots`,
      scanId,
      resourceType: "robots_txt",
      requestedUrl: "https://timeline-test.example/robots.txt",
      resourceHash: options.robotsTxtHash ?? "hash_a",
      truncated: false,
      snapshotText: "User-agent: *\nAllow: /",
      fetchedAt: now,
    });
  }
  for (const [i, finding] of (options.findings ?? []).entries()) {
    await db.insert(schema.findings).values({
      id: `${scanId}_finding_${i}`,
      scanId,
      findingCode: finding.code,
      severity: finding.severity as never,
      category: "objective-alignment",
      title: finding.code,
      summary: "Test finding",
      evidence: JSON.stringify({
        evidenceSummary: finding.evidenceSummary,
        fingerprint: finding.fingerprint,
      }),
      affectedCrawlerId: finding.affectedCrawlerId ?? null,
      businessImpact: "Test impact",
      recommendedAction: "Test action",
      confidence: "high",
      rulesetVersionId: "rules_test",
      createdAt: now,
      fingerprint: finding.fingerprint,
    });
  }
  return scanId;
}

describe("change-attribution (real D1)", () => {
  it("classifies a website-only change (registry unchanged, robots.txt hash differs)", async () => {
    const { domainId } = await createUserAndDomain();
    const previous = await createScan(domainId, { robotsTxtHash: "hash_a" });
    const current = await createScan(domainId, { robotsTxtHash: "hash_b" });
    const result = await computeChangeOrigin(db, previous, current);
    expect(result.origin).toBe("website_policy");
  });

  it("classifies a registry-only change (robots.txt hash unchanged, registry version differs)", async () => {
    const { domainId } = await createUserAndDomain();
    const previous = await createScan(domainId, {
      robotsTxtHash: "hash_a",
      registryVersionId: "reg_test",
    });
    const current = await createScan(domainId, {
      robotsTxtHash: "hash_a",
      registryVersionId: "reg_test_2",
    });
    const result = await computeChangeOrigin(db, previous, current);
    expect(result.origin).toBe("registry_driven");
  });

  it("classifies a mixed change (both website and registry differ)", async () => {
    const { domainId } = await createUserAndDomain();
    const previous = await createScan(domainId, {
      robotsTxtHash: "hash_a",
      registryVersionId: "reg_test",
    });
    const current = await createScan(domainId, {
      robotsTxtHash: "hash_b",
      registryVersionId: "reg_test_2",
    });
    const result = await computeChangeOrigin(db, previous, current);
    expect(result.origin).toBe("mixed");
  });

  it("classifies no change as no_change (never fabricates a cause)", async () => {
    const { domainId } = await createUserAndDomain();
    const previous = await createScan(domainId, { robotsTxtHash: "hash_a" });
    const current = await createScan(domainId, { robotsTxtHash: "hash_a" });
    const result = await computeChangeOrigin(db, previous, current);
    expect(result.origin).toBe("no_change");
  });

  it("classifies a partial current scan as operational, never a false website/registry attribution", async () => {
    const { domainId } = await createUserAndDomain();
    const previous = await createScan(domainId, { robotsTxtHash: "hash_a" });
    const current = await createScan(domainId, {
      status: "target_unavailable",
      robotsTxtHash: null,
    });
    const result = await computeChangeOrigin(db, previous, current);
    expect(result.origin).toBe("operational");
    expect((result as { reason: string }).reason).toBe("current_scan_incomplete");
  });

  it("classifies unavailable comparable evidence as uncertain, not a guess", async () => {
    const { domainId } = await createUserAndDomain();
    const previous = await createScan(domainId, { robotsTxtHash: null });
    const current = await createScan(domainId, { robotsTxtHash: null });
    const result = await computeChangeOrigin(db, previous, current);
    expect(result.origin).toBe("uncertain");
  });
});

describe("timeline-event generation and idempotency (real D1)", () => {
  it("generates a baseline event on the first successful scan", async () => {
    const { domainId } = await createUserAndDomain();
    const scanId = await createScan(domainId, { robotsTxtHash: "hash_a" });
    const event = await generateTimelineEvent(db, {
      domainId,
      previousScanId: null,
      currentScanId: scanId,
    });
    expect(event).not.toBeNull();
    const [row] = await db
      .select()
      .from(schema.domainChangeEvents)
      .where(eq(schema.domainChangeEvents.id, event!.id));
    expect(row!.eventType).toBe("baseline");
    expect(row!.changeOrigin).toBe("baseline");
  });

  it("generates no event, and no baseline, for a failed first scan", async () => {
    const { domainId } = await createUserAndDomain();
    const scanId = await createScan(domainId, {
      status: "target_unavailable",
      robotsTxtHash: null,
    });
    const event = await generateTimelineEvent(db, {
      domainId,
      previousScanId: null,
      currentScanId: scanId,
    });
    expect(event).toBeNull();
  });

  it("generates no event at all for a genuinely unchanged scan", async () => {
    const { domainId } = await createUserAndDomain();
    const previous = await createScan(domainId, { robotsTxtHash: "hash_a" });
    const current = await createScan(domainId, { robotsTxtHash: "hash_a" });
    const event = await generateTimelineEvent(db, {
      domainId,
      previousScanId: previous,
      currentScanId: current,
    });
    expect(event).toBeNull();
  });

  it("is idempotent — calling generateTimelineEvent twice for the same scan pair never creates two rows", async () => {
    const { domainId } = await createUserAndDomain();
    const previous = await createScan(domainId, { robotsTxtHash: "hash_a" });
    const current = await createScan(domainId, { robotsTxtHash: "hash_b" });
    const first = await generateTimelineEvent(db, {
      domainId,
      previousScanId: previous,
      currentScanId: current,
    });
    const second = await generateTimelineEvent(db, {
      domainId,
      previousScanId: previous,
      currentScanId: current,
    });
    expect(first!.id).toBe(second!.id);
    const rows = await db
      .select()
      .from(schema.domainChangeEvents)
      .where(eq(schema.domainChangeEvents.domainId, domainId));
    expect(rows).toHaveLength(1);
  });

  it("generates an operational preset-change event via updateDomain, recorded in account history", async () => {
    const { userId, domainId } = await createUserAndDomain();
    const result = await updateDomain(db, userId, domainId, { preset: "publisher_protection" });
    expect(result.ok).toBe(true);
    const rows = await db
      .select()
      .from(schema.domainChangeEvents)
      .where(eq(schema.domainChangeEvents.domainId, domainId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.eventType).toBe("operational_change");
    expect(rows[0]!.changeOrigin).toBe("operational");
  });

  it("does not generate a preset-change event when the preset is unchanged", async () => {
    const { userId, domainId } = await createUserAndDomain();
    await updateDomain(db, userId, domainId, { preset: "maximum_ai_visibility" });
    const rows = await db
      .select()
      .from(schema.domainChangeEvents)
      .where(eq(schema.domainChangeEvents.domainId, domainId));
    expect(rows).toHaveLength(0);
  });

  it("generatePresetChangeEvent is idempotent within the same minute for the same from/to pair", async () => {
    const { domainId } = await createUserAndDomain();
    const observedAt = new Date().toISOString();
    const first = await generatePresetChangeEvent(db, {
      domainId,
      fromPreset: "maximum_ai_visibility",
      toPreset: "publisher_protection",
      observedAt,
    });
    const second = await generatePresetChangeEvent(db, {
      domainId,
      fromPreset: "maximum_ai_visibility",
      toPreset: "publisher_protection",
      observedAt,
    });
    expect(first!.id).toBe(second!.id);
  });

  it("establishBaseline (Phase 5 anonymous-conversion adopt path) creates a real baseline event, not just a domain save", async () => {
    const { userId, domainId } = await createUserAndDomain();
    // An anonymous, not-yet-owned scan (domainId still null) — exactly the
    // shape establishBaseline's "adopt" branch expects.
    const anonymousScanId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.insert(schema.scans).values({
      id: anonymousScanId,
      domainId: null,
      triggeredBy: "anonymous",
      targetInput: "https://timeline-test.example",
      canonicalOrigin: "https://timeline-test.example",
      status: "completed",
      preset: "maximum_ai_visibility",
      registryVersionId: "reg_test",
      rulesetVersionId: "rules_test",
      score: 80,
      scoreState: "scored",
      startedAt: now,
      completedAt: now,
    });

    const result = await establishBaseline(db, {
      scanId: anonymousScanId,
      domainId,
      domainCanonicalOrigin: "https://timeline-test.example",
      domainPreset: "maximum_ai_visibility",
      userId,
      monitoringFrequency: "none",
      auditEngineEnabled: false,
    });
    expect(result.strategy).toBe("adopted");

    const events = await db
      .select()
      .from(schema.domainChangeEvents)
      .where(eq(schema.domainChangeEvents.domainId, domainId));
    expect(events).toHaveLength(1);
    expect(events[0]!.eventType).toBe("baseline");
  });
});

describe("timeline pagination (real D1)", () => {
  it("paginates in observed_at-descending order with a stable cursor", async () => {
    const { domainId } = await createUserAndDomain();
    let previous = await createScan(domainId, { robotsTxtHash: "hash_0" });
    for (let i = 1; i <= 5; i++) {
      const current = await createScan(domainId, { robotsTxtHash: `hash_${i}` });
      await generateTimelineEvent(db, {
        domainId,
        previousScanId: previous,
        currentScanId: current,
      });
      previous = current;
    }
    // 1 baseline-equivalent (first change from hash_0->hash_1 has no true
    // baseline here since previousScanId is always non-null in this loop)
    // + 5 website_policy_change events = 5 total rows (first iteration's
    // previous scan already existed, so no baseline event is generated by
    // this loop — only the 5 explicit generateTimelineEvent calls above).
    const firstPage = await listDomainChangeEvents(db, domainId, { limit: 2 });
    expect(firstPage.events).toHaveLength(2);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = await listDomainChangeEvents(db, domainId, {
      limit: 2,
      cursor: firstPage.nextCursor,
    });
    expect(secondPage.events).toHaveLength(2);
    // No overlap between pages.
    const firstIds = new Set(firstPage.events.map((e) => e.id));
    expect(secondPage.events.some((e) => firstIds.has(e.id))).toBe(false);

    const thirdPage = await listDomainChangeEvents(db, domainId, {
      limit: 2,
      cursor: secondPage.nextCursor,
    });
    expect(thirdPage.events).toHaveLength(1);
    expect(thirdPage.nextCursor).toBeNull();
  });
});

describe("finding lifecycle (real D1)", () => {
  it("classifies appeared, persisting, and resolved findings correctly", async () => {
    const { domainId } = await createUserAndDomain();
    const previous = await createScan(domainId, {
      findings: [
        { code: "A", severity: "medium", evidenceSummary: "a", fingerprint: "fp_a" },
        { code: "B", severity: "low", evidenceSummary: "b", fingerprint: "fp_b" },
      ],
    });
    const current = await createScan(domainId, {
      findings: [
        { code: "A", severity: "medium", evidenceSummary: "a", fingerprint: "fp_a" },
        { code: "C", severity: "high", evidenceSummary: "c", fingerprint: "fp_c" },
      ],
    });
    const { entries, counts } = await classifyFindingLifecycle(db, {
      previousScanId: previous,
      currentScanId: current,
      currentScanComparable: true,
    });
    expect(counts.persisting).toBe(1);
    expect(counts.appeared).toBe(1);
    expect(counts.resolved).toBe(1);
    expect(entries.find((e) => e.fingerprint === "fp_a")!.state).toBe("persisting");
    expect(entries.find((e) => e.fingerprint === "fp_c")!.state).toBe("appeared");
    expect(entries.find((e) => e.fingerprint === "fp_b")!.state).toBe("resolved");
  });

  it("never claims a finding is resolved against a non-comparable (partial/failed) current scan", async () => {
    const { domainId } = await createUserAndDomain();
    const previous = await createScan(domainId, {
      findings: [{ code: "A", severity: "medium", evidenceSummary: "a", fingerprint: "fp_a" }],
    });
    const current = await createScan(domainId, { status: "target_unavailable" });
    const { entries } = await classifyFindingLifecycle(db, {
      previousScanId: previous,
      currentScanId: current,
      currentScanComparable: false,
    });
    expect(entries.find((e) => e.fingerprint === "fp_a")!.state).toBe("unable_to_compare");
  });
});

describe("scan comparison (real D1)", () => {
  it("compares two comparable scans and reports changed resources", async () => {
    const { domainId } = await createUserAndDomain();
    const previous = await createScan(domainId, { robotsTxtHash: "hash_a" });
    const current = await createScan(domainId, { robotsTxtHash: "hash_b" });
    const result = await compareScans(db, domainId, previous, current);
    expect(result.compatible).toBe(true);
    if (result.compatible) {
      const robots = result.resources.find((r) => r.resourceType === "robots_txt");
      expect(robots?.changed).toBe(true);
    }
  });

  it("rejects the same scan compared to itself", async () => {
    const { domainId } = await createUserAndDomain();
    const scanId = await createScan(domainId, { robotsTxtHash: "hash_a" });
    const result = await compareScans(db, domainId, scanId, scanId);
    expect(result.compatible).toBe(false);
  });

  it("rejects a comparison against a scan belonging to a different domain (cross-domain IDOR)", async () => {
    const { domainId: domainA } = await createUserAndDomain();
    const { domainId: domainB } = await createUserAndDomain();
    const scanA = await createScan(domainA, { robotsTxtHash: "hash_a" });
    const scanB = await createScan(domainB, { robotsTxtHash: "hash_b" });
    const result = await compareScans(db, domainA, scanA, scanB);
    expect(result.compatible).toBe(false);
  });

  it("reports incompatible for a partial scan, with a link to each individual report still possible via scan IDs", async () => {
    const { domainId } = await createUserAndDomain();
    const previous = await createScan(domainId, { robotsTxtHash: "hash_a" });
    const current = await createScan(domainId, { status: "target_unavailable" });
    const result = await compareScans(db, domainId, previous, current);
    expect(result.compatible).toBe(false);
  });
});

describe("scan-lock duplicate-scan prevention (real D1)", () => {
  it("prevents a second concurrent claim until released", async () => {
    const { domainId } = await createUserAndDomain();
    const firstClaim = await tryClaimScanLock(db, domainId);
    expect(firstClaim).toBe(true);
    const secondClaim = await tryClaimScanLock(db, domainId);
    expect(secondClaim).toBe(false);

    await releaseScanLock(db, domainId);
    const thirdClaim = await tryClaimScanLock(db, domainId);
    expect(thirdClaim).toBe(true);
  });
});

describe("scan history and retention (real D1)", () => {
  it("paginates scan history and flags changeDetected accurately", async () => {
    const { domainId } = await createUserAndDomain();
    const previous = await createScan(domainId, { robotsTxtHash: "hash_a" });
    const current = await createScan(domainId, { robotsTxtHash: "hash_b" });
    await generateTimelineEvent(db, { domainId, previousScanId: previous, currentScanId: current });

    const { scans } = await listScanHistory(db, domainId, { filter: "all" });
    expect(scans).toHaveLength(2);
    const currentRow = scans.find((s) => s.scanId === current);
    expect(currentRow?.changeDetected).toBe(true);
    const previousRow = scans.find((s) => s.scanId === previous);
    expect(previousRow?.changeDetected).toBe(false);
  });

  it("computes a real retention boundary from the oldest surviving scan", async () => {
    const { domainId } = await createUserAndDomain();
    await createScan(domainId, { robotsTxtHash: "hash_a" });
    const boundary = await retentionBoundaryFor(db, domainId, 730);
    expect(boundary.retentionDays).toBe(730);
    expect(boundary.retentionMonths).toBe(24);
    expect(boundary.oldestRetainedScanAt).not.toBeNull();
    expect(boundary.hasExpiredHistory).toBe(false);
  });
});
