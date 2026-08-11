import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { createD1TestHarness } from "./d1-harness";
import { createRegistryRelease, publishRegistryVersion } from "../../src/lib/admin/registry";
import { computeSemanticDiff } from "../../src/lib/registry-semantic-diff";

/**
 * Phase 15 Section 137 — release-diff regression tests. Proves each named
 * scenario lands in the correct change class, and that
 * `evaluationSemanticCrawlerIds` only ever includes evaluation-semantic
 * changes (the direct regression test for the pre-Phase-15 bug where any
 * field edit, including a wording tweak, counted as "changed").
 */
describe("registry semantic diff classification (real D1)", () => {
  let db: Database;
  let dispose: () => Promise<void>;
  let operatorId: string;
  let baseCrawlerId: string;

  beforeEach(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    db = createDb(harness.db);

    const now = new Date().toISOString();
    await db.insert(schema.users).values({
      id: "usr_diff_admin",
      displayName: "Diff Test Admin",
      status: "active",
      planId: "free",
      isAdmin: true,
      createdAt: now,
      updatedAt: now,
    });

    operatorId = "op_diff_test";
    await db.insert(schema.crawlerOperators).values({
      id: operatorId,
      name: "Diff Test Operator",
      createdAt: now,
      updatedAt: now,
    });

    baseCrawlerId = "crw_diff_base";
    await db.insert(schema.crawlers).values({
      id: baseCrawlerId,
      operatorId,
      name: "DiffBaseBot",
      userAgentToken: "DiffBaseBot",
      purpose: "search",
      description: "Original description.",
      officialSourceUrl: "https://example.test/diffbase-original",
      lifecycleStatus: "active",
      firstVerifiedAt: now,
      lastVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  });

  afterEach(async () => {
    await dispose();
  });

  async function publishBaseline(): Promise<string> {
    const id = await createRegistryRelease(db, {
      versionLabel: `diff-test-baseline-${crypto.randomUUID().slice(0, 8)}`,
      changelog: "Baseline for diff classification test.",
    });
    await publishRegistryVersion(db, id, "usr_diff_admin");
    return id;
  }

  it("classifies an added crawler as evaluation-semantic", async () => {
    const releaseA = await publishBaseline();
    const now = new Date().toISOString();
    await db.insert(schema.crawlers).values({
      id: "crw_diff_new",
      operatorId,
      name: "NewBot",
      userAgentToken: "NewBot",
      purpose: "training",
      description: "A new crawler.",
      officialSourceUrl: "https://example.test/newbot",
      lifecycleStatus: "active",
      firstVerifiedAt: now,
      lastVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    const releaseB = await publishBaseline();

    const diff = await computeSemanticDiff(db, releaseA, releaseB);
    expect(diff.added.some((c) => c.id === "crw_diff_new")).toBe(true);
    expect(diff.evaluationSemanticCrawlerIds).toContain("crw_diff_new");
  });

  it("classifies a removed crawler (retired) as evaluation-semantic", async () => {
    const releaseA = await publishBaseline();
    await db
      .update(schema.crawlers)
      .set({ lifecycleStatus: "retired", updatedAt: new Date().toISOString() })
      .where(eq(schema.crawlers.id, baseCrawlerId));
    const releaseB = await createRegistryRelease(db, {
      versionLabel: `diff-test-retired-${crypto.randomUUID().slice(0, 8)}`,
      changelog: "Retires the base crawler.",
    });
    await publishRegistryVersion(db, releaseB, "usr_diff_admin");

    const diff = await computeSemanticDiff(db, releaseA, releaseB);
    // The crawler still has a snapshot entry in release B (createRegistryRelease
    // includes retired crawlers), but with a lifecycle change — evaluation-semantic.
    const changedEntry = diff.changed.find((c) => c.crawlerId === baseCrawlerId);
    expect(changedEntry?.isEvaluationSemantic).toBe(true);
    expect(diff.evaluationSemanticCrawlerIds).toContain(baseCrawlerId);
  });

  it("classifies a purpose change as evaluation-semantic", async () => {
    const releaseA = await publishBaseline();
    await db
      .update(schema.crawlers)
      .set({ purpose: "training", updatedAt: new Date().toISOString() })
      .where(eq(schema.crawlers.id, baseCrawlerId));
    const releaseB = await publishBaseline();

    const diff = await computeSemanticDiff(db, releaseA, releaseB);
    const entry = diff.changed.find((c) => c.crawlerId === baseCrawlerId);
    expect(entry?.isEvaluationSemantic).toBe(true);
    expect(entry?.fieldChanges.some((f) => f.field === "purpose")).toBe(true);
  });

  it("classifies a token change as evaluation-semantic", async () => {
    const releaseA = await publishBaseline();
    await db
      .update(schema.crawlers)
      .set({ userAgentToken: "DiffBaseBot-v2", updatedAt: new Date().toISOString() })
      .where(eq(schema.crawlers.id, baseCrawlerId));
    const releaseB = await publishBaseline();

    const diff = await computeSemanticDiff(db, releaseA, releaseB);
    const entry = diff.changed.find((c) => c.crawlerId === baseCrawlerId);
    expect(entry?.isEvaluationSemantic).toBe(true);
    expect(entry?.fieldChanges.some((f) => f.field === "userAgentToken")).toBe(true);
  });

  it("classifies a lifecycle change (active -> deprecated) as evaluation-semantic", async () => {
    const releaseA = await publishBaseline();
    await db
      .update(schema.crawlers)
      .set({ lifecycleStatus: "deprecated", updatedAt: new Date().toISOString() })
      .where(eq(schema.crawlers.id, baseCrawlerId));
    const releaseB = await publishBaseline();

    const diff = await computeSemanticDiff(db, releaseA, releaseB);
    const entry = diff.changed.find((c) => c.crawlerId === baseCrawlerId);
    expect(entry?.isEvaluationSemantic).toBe(true);
  });

  it("classifies a source-URL-only change as evidence, NOT evaluation-semantic", async () => {
    const releaseA = await publishBaseline();
    await db
      .update(schema.crawlers)
      .set({
        officialSourceUrl: "https://example.test/diffbase-moved",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.crawlers.id, baseCrawlerId));
    const releaseB = await publishBaseline();

    const diff = await computeSemanticDiff(db, releaseA, releaseB);
    const entry = diff.changed.find((c) => c.crawlerId === baseCrawlerId);
    expect(entry?.isEvaluationSemantic).toBe(false);
    expect(entry?.fieldChanges.every((f) => f.changeClass === "evidence")).toBe(true);
    expect(diff.evaluationSemanticCrawlerIds).not.toContain(baseCrawlerId);
  });

  it("classifies a verification-date-only refresh as evidence, NOT evaluation-semantic", async () => {
    const releaseA = await publishBaseline();
    await db
      .update(schema.crawlers)
      .set({
        lastVerifiedAt: new Date(Date.now() + 60_000).toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.crawlers.id, baseCrawlerId));
    const releaseB = await publishBaseline();

    const diff = await computeSemanticDiff(db, releaseA, releaseB);
    const entry = diff.changed.find((c) => c.crawlerId === baseCrawlerId);
    expect(entry?.isEvaluationSemantic).toBe(false);
    expect(diff.evaluationSemanticCrawlerIds).not.toContain(baseCrawlerId);
  });

  it("classifies a description-only change as editorial, NOT evaluation-semantic", async () => {
    const releaseA = await publishBaseline();
    await db
      .update(schema.crawlers)
      .set({
        description: "A completely reworded description.",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.crawlers.id, baseCrawlerId));
    const releaseB = await publishBaseline();

    const diff = await computeSemanticDiff(db, releaseA, releaseB);
    const entry = diff.changed.find((c) => c.crawlerId === baseCrawlerId);
    expect(entry?.isEvaluationSemantic).toBe(false);
    expect(entry?.fieldChanges.every((f) => f.changeClass === "editorial")).toBe(true);
  });

  it("produces no diff entry for an internal-timestamp-only change (updatedAt)", async () => {
    const releaseA = await publishBaseline();
    // Touch only updatedAt (no other field) — createRegistryRelease's
    // canonical snapshot deliberately excludes updatedAt entirely, so this
    // must produce zero field changes.
    await db
      .update(schema.crawlers)
      .set({ updatedAt: new Date(Date.now() + 120_000).toISOString() })
      .where(eq(schema.crawlers.id, baseCrawlerId));
    const releaseB = await publishBaseline();

    const diff = await computeSemanticDiff(db, releaseA, releaseB);
    expect(diff.changed.find((c) => c.crawlerId === baseCrawlerId)).toBeUndefined();
  });
});
