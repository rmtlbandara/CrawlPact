import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { createD1TestHarness } from "./d1-harness";
import { createRegistryRelease, publishRegistryVersion } from "../../src/lib/admin/registry";
import {
  getRegistryObservatorySnapshot,
  getRegistryObservatoryReleaseHistory,
} from "../../src/lib/observatory/registry-observatory";

/**
 * Phase 16 §197 — Registry Observatory metrics must be computed exclusively
 * from immutable registry releases, never a live mutable table. Every
 * assertion here is against real published releases created via the same
 * `createRegistryRelease`/`publishRegistryVersion` path the admin UI uses.
 */
describe("registry observatory (real D1)", () => {
  let db: Database;
  let dispose: () => Promise<void>;

  beforeEach(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    db = createDb(harness.db);

    const now = new Date().toISOString();
    await db.insert(schema.users).values({
      id: "usr_obs_admin",
      displayName: "Observatory Test Admin",
      status: "active",
      planId: "free",
      isAdmin: true,
      createdAt: now,
      updatedAt: now,
    });
  });

  afterEach(async () => {
    await dispose();
  });

  it("computes crawler/operator/purpose/lifecycle counts from the active release, not the live table", async () => {
    const now = new Date().toISOString();
    await db.insert(schema.crawlerOperators).values({
      id: "op_obs_second",
      name: "Second Operator",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.crawlers).values([
      {
        id: "crw_obs_training",
        operatorId: "op_obs_second",
        name: "TrainBot",
        userAgentToken: "TrainBot",
        purpose: "training",
        description: "Training crawler.",
        officialSourceUrl: "https://example.test/trainbot",
        lifecycleStatus: "active",
        firstVerifiedAt: now,
        lastVerifiedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "crw_obs_deprecated",
        operatorId: "op_obs_second",
        name: "OldSearchBot",
        userAgentToken: "OldSearchBot",
        purpose: "search",
        description: "Deprecated search crawler.",
        officialSourceUrl: "https://example.test/oldsearchbot",
        lifecycleStatus: "deprecated",
        firstVerifiedAt: now,
        lastVerifiedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const releaseId = await createRegistryRelease(db, {
      versionLabel: `obs-test-${crypto.randomUUID().slice(0, 8)}`,
      changelog: "Adds two crawlers under a second operator.",
    });
    await publishRegistryVersion(db, releaseId, "usr_obs_admin");

    const snapshot = await getRegistryObservatorySnapshot(db);
    expect(snapshot).not.toBeNull();
    // crawler_test (harness fixture, search/active) + the two new crawlers.
    expect(snapshot?.crawlerCount).toBe(3);
    expect(snapshot?.operatorCount).toBe(2);
    expect(snapshot?.evaluationEligibleCount).toBe(3); // active, active, deprecated all eligible
    expect(snapshot?.purposeDistribution).toEqual({ search: 2, training: 1 });
    expect(snapshot?.lifecycleDistribution).toEqual({ active: 2, deprecated: 1 });

    const secondOperatorRow = snapshot?.operatorByPurpose.find(
      (o) => o.operatorId === "op_obs_second",
    );
    expect(secondOperatorRow?.purposes.sort()).toEqual(["search", "training"]);
  });

  it("classifies an evidence-only source-URL edit separately from an evaluation-semantic change in release history", async () => {
    const baselineReleaseId = await createRegistryRelease(db, {
      versionLabel: `obs-baseline-${crypto.randomUUID().slice(0, 8)}`,
      changelog: "Baseline snapshot.",
    });
    await publishRegistryVersion(db, baselineReleaseId, "usr_obs_admin");

    // Evidence-only edit: only the source URL changes.
    await db
      .update(schema.crawlers)
      .set({ officialSourceUrl: "https://example.test/testbot-moved" })
      .where(eq(schema.crawlers.id, "crawler_test"));

    const secondReleaseId = await createRegistryRelease(db, {
      versionLabel: `obs-second-${crypto.randomUUID().slice(0, 8)}`,
      changelog: "Source URL correction only.",
    });
    await publishRegistryVersion(db, secondReleaseId, "usr_obs_admin");

    const history = await getRegistryObservatoryReleaseHistory(db);
    const secondEntry = history.find((r) => r.registryVersionId === secondReleaseId);
    expect(secondEntry).toBeDefined();
    expect(secondEntry?.added).toBe(0);
    expect(secondEntry?.removed).toBe(0);
    expect(secondEntry?.purposeChanges).toBe(0);
    expect(secondEntry?.tokenChanges).toBe(0);
    expect(secondEntry?.evidenceOnlyChanges).toBe(1);
  });

  it("flags never-verified and stale evaluation-eligible crawlers as review-due", async () => {
    const staleDate = new Date(Date.now() - 200 * 86_400_000).toISOString();
    const now = new Date().toISOString();
    await db.insert(schema.crawlerOperators).values({
      id: "op_obs_freshness",
      name: "Freshness Operator",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.crawlers).values([
      {
        id: "crw_obs_stale",
        operatorId: "op_obs_freshness",
        name: "StaleBot",
        userAgentToken: "StaleBot",
        purpose: "search",
        description: "Verified long ago.",
        officialSourceUrl: "https://example.test/stalebot",
        lifecycleStatus: "active",
        firstVerifiedAt: staleDate,
        lastVerifiedAt: staleDate,
        createdAt: now,
        updatedAt: now,
      },
      {
        // Real candidate validation (Phase 15) rejects a release containing
        // an *evaluation-eligible* crawler with no verification date — so a
        // never-verified crawler can only legitimately exist with lifecycle
        // "unverified" itself, which is exactly what that status means.
        id: "crw_obs_never",
        operatorId: "op_obs_freshness",
        name: "NeverVerifiedBot",
        userAgentToken: "NeverVerifiedBot",
        purpose: "agent",
        description: "Never verified.",
        officialSourceUrl: "https://example.test/neververifiedbot",
        lifecycleStatus: "unverified",
        firstVerifiedAt: null,
        lastVerifiedAt: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const releaseId = await createRegistryRelease(db, {
      versionLabel: `obs-freshness-${crypto.randomUUID().slice(0, 8)}`,
      changelog: "Freshness fixture.",
    });
    await publishRegistryVersion(db, releaseId, "usr_obs_admin");

    const snapshot = await getRegistryObservatorySnapshot(db);
    // crawler_test (fresh, eligible) is not due; StaleBot (eligible, stale)
    // is. NeverVerifiedBot is "unverified" lifecycle, so it's counted as
    // never-verified but excluded from evaluation-eligible review-due math.
    expect(snapshot?.verification.reviewDueCount).toBe(1);
    expect(snapshot?.verification.neverVerifiedCount).toBe(1);
  });
});
