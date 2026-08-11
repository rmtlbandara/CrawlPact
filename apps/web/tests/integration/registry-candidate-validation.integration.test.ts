import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { createD1TestHarness } from "./d1-harness";
import {
  createRegistryRelease,
  publishRegistryVersion,
  validateReleaseCandidate,
} from "../../src/lib/admin/registry";
import { computeRegistryChecksum } from "../../src/lib/registry-checksum";

/**
 * Phase 15 Section 143 — release-candidate validation tests. Proves the
 * blocking-error conditions in `validateReleaseCandidate`
 * (`apps/web/src/lib/admin/registry.ts`), and that `publishRegistryVersion`
 * actually refuses to publish an invalid candidate (Section 144).
 */
describe("registry release candidate validation (real D1)", () => {
  let db: Database;
  let dispose: () => Promise<void>;
  let operatorId: string;

  beforeEach(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    db = createDb(harness.db);

    const now = new Date().toISOString();
    await db.insert(schema.users).values({
      id: "usr_candidate_admin",
      displayName: "Candidate Test Admin",
      status: "active",
      planId: "free",
      isAdmin: true,
      createdAt: now,
      updatedAt: now,
    });

    operatorId = "op_candidate_test";
    await db.insert(schema.crawlerOperators).values({
      id: operatorId,
      name: "Candidate Test Operator",
      createdAt: now,
      updatedAt: now,
    });
  });

  afterEach(async () => {
    await dispose();
  });

  it("blocks a candidate with an evaluation-eligible crawler missing an official source", async () => {
    const now = new Date().toISOString();
    await db.insert(schema.crawlers).values({
      id: "crw_no_source",
      operatorId,
      name: "NoSourceBot",
      userAgentToken: "NoSourceBot",
      purpose: "search",
      description: "Missing source URL for this test.",
      officialSourceUrl: "",
      lifecycleStatus: "active",
      lastVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    const releaseId = await createRegistryRelease(db, {
      versionLabel: "candidate-no-source",
      changelog: "Missing source test.",
    });

    const validation = await validateReleaseCandidate(db, releaseId);
    expect(validation.errors.some((e) => e.code === "missing_official_source")).toBe(true);
    await expect(publishRegistryVersion(db, releaseId, "usr_candidate_admin")).rejects.toThrow();
  });

  it("blocks a candidate with an evaluation-eligible crawler missing a verification date", async () => {
    const now = new Date().toISOString();
    await db.insert(schema.crawlers).values({
      id: "crw_no_verify",
      operatorId,
      name: "NoVerifyBot",
      userAgentToken: "NoVerifyBot",
      purpose: "search",
      description: "Missing verification date for this test.",
      officialSourceUrl: "https://example.test/noverify",
      lifecycleStatus: "active",
      createdAt: now,
      updatedAt: now,
    });
    const releaseId = await createRegistryRelease(db, {
      versionLabel: "candidate-no-verify",
      changelog: "Missing verification date test.",
    });

    const validation = await validateReleaseCandidate(db, releaseId);
    expect(validation.errors.some((e) => e.code === "missing_verification_date")).toBe(true);
    await expect(publishRegistryVersion(db, releaseId, "usr_candidate_admin")).rejects.toThrow();
  });

  it("blocks a candidate with a duplicate primary token across two evaluation-eligible crawlers", async () => {
    const now = new Date().toISOString();
    await db.insert(schema.crawlers).values([
      {
        id: "crw_dup_1",
        operatorId,
        name: "DupBot",
        userAgentToken: "DupBot",
        purpose: "search",
        description: "First of a duplicate-token pair.",
        officialSourceUrl: "https://example.test/dup1",
        lifecycleStatus: "active",
        lastVerifiedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "crw_dup_2",
        operatorId,
        name: "DupBot Duplicate",
        userAgentToken: "dupbot",
        purpose: "training",
        description: "Second of a duplicate-token pair (case-insensitive match).",
        officialSourceUrl: "https://example.test/dup2",
        lifecycleStatus: "active",
        lastVerifiedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    const releaseId = await createRegistryRelease(db, {
      versionLabel: "candidate-dup-token",
      changelog: "Duplicate token test.",
    });

    const validation = await validateReleaseCandidate(db, releaseId);
    expect(validation.errors.some((e) => e.code === "duplicate_token")).toBe(true);
  });

  it("does not block on an unverified crawler (unverified is simply excluded from evaluation, not an error)", async () => {
    const now = new Date().toISOString();
    await db.insert(schema.crawlers).values({
      id: "crw_unverified",
      operatorId,
      name: "CandidateBot",
      userAgentToken: "CandidateBot",
      purpose: "search",
      description: "A draft crawler awaiting verification.",
      officialSourceUrl: "https://example.test/candidatebot",
      lifecycleStatus: "unverified",
      createdAt: now,
      updatedAt: now,
    });
    const releaseId = await createRegistryRelease(db, {
      versionLabel: "candidate-unverified-ok",
      changelog: "Unverified crawler is fine, just excluded from evaluation.",
    });

    const validation = await validateReleaseCandidate(db, releaseId);
    expect(validation.errors).toHaveLength(0);

    const result = await publishRegistryVersion(db, releaseId, "usr_candidate_admin");
    expect(result.alreadyActive).toBe(false);

    // The unverified crawler's snapshot exists (for candidate/research
    // purposes) but must never surface as an active evaluation entry.
    const { getActiveRegistry } = await import("../../src/lib/registry-data");
    const active = await getActiveRegistry(db);
    expect(active?.crawlers.some((c) => c.id === "crw_unverified")).toBe(false);
  });

  it("produces a checksum in the validation result that matches the independently computed checksum", async () => {
    const now = new Date().toISOString();
    await db.insert(schema.crawlers).values({
      id: "crw_checksum_test",
      operatorId,
      name: "ChecksumBot",
      userAgentToken: "ChecksumBot",
      purpose: "search",
      description: "Checksum consistency test.",
      officialSourceUrl: "https://example.test/checksumbot",
      lifecycleStatus: "active",
      lastVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    const releaseId = await createRegistryRelease(db, {
      versionLabel: "candidate-checksum-consistency",
      changelog: "Checksum consistency test.",
    });

    const validation = await validateReleaseCandidate(db, releaseId);
    const independentChecksum = await computeRegistryChecksum(db, releaseId);
    expect(validation.checksum).toBe(independentChecksum);

    const publishResult = await publishRegistryVersion(db, releaseId, "usr_candidate_admin");
    expect(publishResult.checksum).toBe(independentChecksum);

    const [stored] = await db
      .select({ checksum: schema.registryVersions.checksum })
      .from(schema.registryVersions)
      .where(eq(schema.registryVersions.id, releaseId))
      .limit(1);
    expect(stored?.checksum).toBe(independentChecksum);
  });
});
