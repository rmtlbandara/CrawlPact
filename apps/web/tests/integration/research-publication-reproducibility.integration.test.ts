import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { createD1TestHarness } from "./d1-harness";
import {
  generateRegistryLandscapeDraft,
  publishResearchPublication,
  reproduceResearchPublication,
  submitResearchPublicationForReview,
} from "../../src/lib/admin/research";
import { createRegistryRelease, publishRegistryVersion } from "../../src/lib/admin/registry";

/**
 * Phase 16 §199 — a published publication must remain reproducible from its
 * *pinned* registry release even after the live crawler table changes and
 * even after a newer release becomes active (§149/§24: never silently
 * recompute against a different source than what was actually published).
 */
describe("research publication reproducibility (real D1)", () => {
  let db: Database;
  let dispose: () => Promise<void>;

  beforeEach(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    db = createDb(harness.db);

    const now = new Date().toISOString();
    await db.insert(schema.users).values({
      id: "usr_repro_admin",
      displayName: "Reproducibility Test Admin",
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

  it("matches its stored checksum immediately after publication", async () => {
    const { id } = await generateRegistryLandscapeDraft(db, { createdByUserId: "usr_repro_admin" });
    await submitResearchPublicationForReview(db, id);
    await publishResearchPublication(db, id, "usr_repro_admin");

    const result = await reproduceResearchPublication(db, id);
    expect(result.matches).toBe(true);
    expect(result.recomputedChecksum).toBe(result.storedChecksum);
  });

  it("still reproduces correctly after the live crawler table is mutated and a newer release becomes active", async () => {
    const { id } = await generateRegistryLandscapeDraft(db, { createdByUserId: "usr_repro_admin" });
    await submitResearchPublicationForReview(db, id);
    await publishResearchPublication(db, id, "usr_repro_admin");
    const originalResult = await reproduceResearchPublication(db, id);
    expect(originalResult.matches).toBe(true);

    // Mutate the live, mutable crawlers table directly — this must not be
    // visible to a publication pinned to the already-published release.
    await db
      .update(schema.crawlers)
      .set({ purpose: "training" })
      .where(eq(schema.crawlers.id, "crawler_test"));

    // Publish an entirely new registry release, moving the active pointer
    // away from the release this publication was pinned to.
    const newReleaseId = await createRegistryRelease(db, {
      versionLabel: `repro-new-${crypto.randomUUID().slice(0, 8)}`,
      changelog: "A later release, unrelated to the pinned publication.",
    });
    await publishRegistryVersion(db, newReleaseId, "usr_repro_admin");

    const resultAfterChanges = await reproduceResearchPublication(db, id);
    expect(resultAfterChanges.matches).toBe(true);
    expect(resultAfterChanges.recomputedChecksum).toBe(originalResult.storedChecksum);
  });
});
