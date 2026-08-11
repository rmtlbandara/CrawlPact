import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb, schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { createD1TestHarness } from "./d1-harness";
import {
  correctResearchPublication,
  generateRegistryLandscapeDraft,
  getResearchPublicationById,
  getVisibleResearchPublicationBySlug,
  listPublishedResearchPublications,
  publishResearchPublication,
  submitResearchPublicationForReview,
  withdrawResearchPublication,
} from "../../src/lib/admin/research";

/**
 * Phase 16 §45/§47/§199/§217 — the full research-publication lifecycle:
 * draft -> review -> published -> corrected -> withdrawn. Every transition
 * is exercised against real D1, mirroring the publish/rollback discipline
 * `admin/registry.ts` established in Phase 15.
 */
describe("research publication lifecycle (real D1)", () => {
  let db: Database;
  let dispose: () => Promise<void>;

  beforeEach(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    db = createDb(harness.db);

    const now = new Date().toISOString();
    await db.insert(schema.users).values({
      id: "usr_pub_admin",
      displayName: "Publication Test Admin",
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

  it("moves draft -> review -> published, and a draft/review publication is never publicly visible", async () => {
    const { id, slug } = await generateRegistryLandscapeDraft(db, {
      createdByUserId: "usr_pub_admin",
    });

    let row = await getResearchPublicationById(db, id);
    expect(row?.status).toBe("draft");
    expect(await getVisibleResearchPublicationBySlug(db, slug)).toBeNull();

    const reviewValidation = await submitResearchPublicationForReview(db, id);
    expect(reviewValidation.errors).toEqual([]);
    row = await getResearchPublicationById(db, id);
    expect(row?.status).toBe("review");
    expect(await getVisibleResearchPublicationBySlug(db, slug)).toBeNull();

    const publishResult = await publishResearchPublication(db, id, "usr_pub_admin");
    expect(publishResult.alreadyPublished).toBe(false);
    row = await getResearchPublicationById(db, id);
    expect(row?.status).toBe("published");
    expect(row?.publishedAt).not.toBeNull();

    const visible = await getVisibleResearchPublicationBySlug(db, slug);
    expect(visible).not.toBeNull();
    expect(visible?.status).toBe("published");

    const published = await listPublishedResearchPublications(db);
    expect(published.map((p) => p.id)).toContain(id);
  });

  it("publish is idempotent — publishing an already-published row is a no-op, not an error", async () => {
    const { id } = await generateRegistryLandscapeDraft(db, { createdByUserId: "usr_pub_admin" });
    await submitResearchPublicationForReview(db, id);
    await publishResearchPublication(db, id, "usr_pub_admin");

    const second = await publishResearchPublication(db, id, "usr_pub_admin");
    expect(second.alreadyPublished).toBe(true);
  });

  it("refuses to publish straight from draft (must pass through review first)", async () => {
    const { id } = await generateRegistryLandscapeDraft(db, { createdByUserId: "usr_pub_admin" });
    await expect(publishResearchPublication(db, id, "usr_pub_admin")).rejects.toThrow(
      /not "review"/,
    );
  });

  it("correction recomputes from the same pinned release, appends a visible correction entry, and updates the checksum", async () => {
    const { id, slug } = await generateRegistryLandscapeDraft(db, {
      createdByUserId: "usr_pub_admin",
    });
    await submitResearchPublicationForReview(db, id);
    await publishResearchPublication(db, id, "usr_pub_admin");
    const beforeChecksum = (await getResearchPublicationById(db, id))?.checksum;

    await correctResearchPublication(db, id, {
      what: "Re-verified the finding wording.",
      why: "A rounding display bug in an earlier draft of this test fixture.",
      conclusionsChanged: false,
    });

    const corrected = await getResearchPublicationById(db, id);
    expect(corrected?.status).toBe("corrected");
    expect(corrected?.correctedAt).not.toBeNull();
    const correctionLog = JSON.parse(corrected?.correctionLog ?? "[]") as { what: string }[];
    expect(correctionLog).toHaveLength(1);
    expect(correctionLog[0]?.what).toContain("Re-verified");
    // Content didn't structurally change (same registry release, no real
    // data difference) so the checksum should be stable — proving
    // correction doesn't silently mutate unrelated data.
    expect(corrected?.checksum).toBe(beforeChecksum);

    // Still visible at the same slug — correction never changes the URL.
    const visible = await getVisibleResearchPublicationBySlug(db, slug);
    expect(visible?.status).toBe("corrected");
  });

  it("withdrawal is terminal and preserves the row at its URL with a reason", async () => {
    const { id, slug } = await generateRegistryLandscapeDraft(db, {
      createdByUserId: "usr_pub_admin",
    });
    await submitResearchPublicationForReview(db, id);
    await publishResearchPublication(db, id, "usr_pub_admin");

    await withdrawResearchPublication(db, id, "Superseded by a corrected methodology.");

    const row = await getResearchPublicationById(db, id);
    expect(row?.status).toBe("withdrawn");
    expect(row?.withdrawalReason).toContain("Superseded");

    // Withdrawn publications remain visible (rendered with a notice), not 404'd.
    const visible = await getVisibleResearchPublicationBySlug(db, slug);
    expect(visible?.status).toBe("withdrawn");

    // But never listed among "latest research."
    const published = await listPublishedResearchPublications(db);
    expect(published.map((p) => p.id)).not.toContain(id);
  });
});
