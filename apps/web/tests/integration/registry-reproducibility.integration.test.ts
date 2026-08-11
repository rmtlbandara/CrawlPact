import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { createD1TestHarness } from "./d1-harness";
import { getActiveRegistry } from "../../src/lib/registry-data";
import { getScanReport } from "../../src/lib/get-scan-report";
import { createRegistryRelease, publishRegistryVersion } from "../../src/lib/admin/registry";
import { computeRegistryChecksum } from "../../src/lib/registry-checksum";

/**
 * Phase 15 Section 28 — "Mandatory Reproducibility Test." Release-blocking:
 * proves that editing a crawler's live, mutable row after a registry
 * release has been published cannot alter what that already-active release
 * evaluates against, what it reports as its own version, or its checksum.
 * This is the direct regression test for the confirmed pre-Phase-15 bug
 * where `getActiveRegistry()` joined straight back to the live `crawlers`
 * table instead of the frozen `registry_version_entries` snapshot.
 */
describe("registry release reproducibility (real D1)", () => {
  let db: Database;
  let dispose: () => Promise<void>;
  let operatorId: string;
  let crawlerId: string;

  beforeAll(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    db = createDb(harness.db);

    const now = new Date().toISOString();

    // registry_versions.published_by_user_id and
    // registry_version_activations.performed_by_user_id both reference a
    // real users row.
    await db.insert(schema.users).values({
      id: "usr_repro_admin",
      displayName: "Repro Test Admin",
      status: "active",
      planId: "free",
      isAdmin: true,
      createdAt: now,
      updatedAt: now,
    });

    operatorId = "op_repro_test";
    await db.insert(schema.crawlerOperators).values({
      id: operatorId,
      name: "Repro Test Operator",
      createdAt: now,
      updatedAt: now,
    });

    crawlerId = "crw_repro_test";
    await db.insert(schema.crawlers).values({
      id: crawlerId,
      operatorId,
      name: "ReproTestBot",
      userAgentToken: "ReproTestBot",
      purpose: "search",
      description: "A crawler used to test release reproducibility.",
      officialSourceUrl: "https://example.test/reprotestbot-docs",
      lifecycleStatus: "active",
      firstVerifiedAt: now,
      lastVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // A ruleset must also be active for getActiveRegistry() to return
    // non-null — reuse the seeded/created active ruleset if present,
    // otherwise create and publish a minimal one.
    const [existingActiveRuleset] = await db
      .select({ id: schema.rulesetVersions.id })
      .from(schema.rulesetVersions)
      .where(eq(schema.rulesetVersions.isActive, true))
      .limit(1);
    if (!existingActiveRuleset) {
      await db.insert(schema.rulesetVersions).values({
        id: "rules_repro_test",
        versionLabel: "repro-test-ruleset",
        description: "Test ruleset for reproducibility test.",
        isActive: true,
        createdAt: now,
      });
    }
  });

  afterAll(async () => {
    await dispose();
  });

  it("keeps an already-active release's evaluation, version ID and checksum unchanged after the live crawler row is edited", async () => {
    // 1. Publish release A with the crawler's original purpose/token.
    const releaseAId = await createRegistryRelease(db, {
      versionLabel: "repro-test-a",
      changelog: "Baseline release for reproducibility test.",
    });
    const publishResult = await publishRegistryVersion(db, releaseAId, "usr_repro_admin");
    const checksumAfterPublish = publishResult.checksum;

    // 2. Confirm release A's frozen snapshot recorded the original purpose.
    const activeBeforeEdit = await getActiveRegistry(db);
    expect(activeBeforeEdit?.registryVersionId).toBe(releaseAId);
    const crawlerRowBeforeEdit = activeBeforeEdit?.crawlers.find((c) => c.id === crawlerId);
    expect(crawlerRowBeforeEdit?.purpose).toBe("search");
    expect(crawlerRowBeforeEdit?.userAgentToken).toBe("ReproTestBot");

    // 3. Modify the mutable crawler row directly — simulating an in-place
    // admin edit that does NOT go through a new release. Change both
    // purpose (evaluation-semantic) and the token, the two fields most
    // likely to break evaluation if the snapshot boundary leaks.
    await db
      .update(schema.crawlers)
      .set({
        purpose: "training",
        userAgentToken: "ReproTestBot-Mutated",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.crawlers.id, crawlerId));

    // 4. Do NOT publish a new release.

    // 5/6. Re-fetch the active registry — it must still be release A's
    // frozen data, not the just-mutated live row.
    const activeAfterEdit = await getActiveRegistry(db);
    const crawlerRowAfterEdit = activeAfterEdit?.crawlers.find((c) => c.id === crawlerId);
    expect(crawlerRowAfterEdit?.purpose).toBe("search");
    expect(crawlerRowAfterEdit?.userAgentToken).toBe("ReproTestBot");

    // 7. The reported active registry version must remain A.
    expect(activeAfterEdit?.registryVersionId).toBe(releaseAId);

    // 8. The release's checksum, recomputed from its (immutable) entries,
    // must be identical before and after the live-row mutation.
    const checksumAfterEdit = await computeRegistryChecksum(db, releaseAId);
    expect(checksumAfterEdit).toBe(checksumAfterPublish);

    const [storedVersion] = await db
      .select({ checksum: schema.registryVersions.checksum })
      .from(schema.registryVersions)
      .where(eq(schema.registryVersions.id, releaseAId))
      .limit(1);
    expect(storedVersion?.checksum).toBe(checksumAfterPublish);
  });

  it("keeps a historical scan's rendered crawler matrix unchanged after the live crawler row is edited", async () => {
    // Publish a fresh release (B) that reflects the *mutated* crawler row
    // from the previous test, so this test is self-contained regardless of
    // execution order relative to the first.
    const releaseBId = await createRegistryRelease(db, {
      versionLabel: "repro-test-b",
      changelog: "Second release for historical-scan reproducibility test.",
    });
    await publishRegistryVersion(db, releaseBId, "usr_repro_admin");

    const activeNow = await getActiveRegistry(db);
    const crawlerRow = activeNow?.crawlers.find((c) => c.id === crawlerId);
    // Sanity: release B really did freeze the mutated values from the prior test.
    expect(crawlerRow?.purpose).toBe("training");

    // Persist a scan that recorded release B's version ID and evaluated
    // this crawler.
    const scanId = "scan_repro_test";
    const now = new Date().toISOString();
    await db.insert(schema.scans).values({
      id: scanId,
      domainId: null,
      triggeredBy: "anonymous",
      targetInput: "https://repro-test.example.com",
      canonicalOrigin: "https://repro-test.example.com",
      status: "completed",
      scoreState: "scored",
      score: 90,
      registryVersionId: releaseBId,
      rulesetVersionId: activeNow?.rulesetVersionId,
      externalRequestCount: 1,
      startedAt: now,
      completedAt: now,
    });
    await db.insert(schema.scanCrawlerResults).values({
      id: "scr_repro_test",
      scanId,
      crawlerId,
      result: "allowed",
    });

    const reportBeforeEdit = await getScanReport(db, scanId);
    const matrixRowBeforeEdit = reportBeforeEdit?.crawlerMatrix.find(
      (r) => r.crawlerId === crawlerId,
    );
    expect(matrixRowBeforeEdit?.purpose).toBe("training");

    // Edit the live crawler row again, after the scan was persisted.
    await db
      .update(schema.crawlers)
      .set({
        purpose: "research",
        name: "ReproTestBot Renamed",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.crawlers.id, crawlerId));

    // The historical scan's rendered report must still show release B's
    // frozen purpose/name, not the just-made live edit.
    const reportAfterEdit = await getScanReport(db, scanId);
    const matrixRowAfterEdit = reportAfterEdit?.crawlerMatrix.find(
      (r) => r.crawlerId === crawlerId,
    );
    expect(matrixRowAfterEdit?.purpose).toBe("training");
    expect(matrixRowAfterEdit?.crawlerName).toBe("ReproTestBot");
  });
});
