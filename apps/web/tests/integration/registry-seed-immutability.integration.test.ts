import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { createD1TestHarness } from "./d1-harness";
import { computeRegistryChecksum } from "../../src/lib/registry-checksum";

const REFERENCE_DATA_PATH = fileURLToPath(
  new URL("../../../../packages/database/seed/reference-data.sql", import.meta.url),
);

function stripLineComments(sql: string): string {
  // Strips `-- ...` comments only outside single-quoted string literals —
  // reference-data.sql's crawler descriptions are prose and may contain a
  // semicolon or (in principle) a literal `--`, unlike the migration files
  // this pattern was originally written for (see d1-harness.ts).
  let result = "";
  let inString = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'") inString = !inString;
    if (!inString && ch === "-" && sql[i + 1] === "-") {
      const newlineIndex = sql.indexOf("\n", i);
      i = newlineIndex === -1 ? sql.length : newlineIndex - 1;
      continue;
    }
    result += ch;
  }
  return result;
}

function splitStatements(sql: string): string[] {
  const withoutComments = stripLineComments(sql);
  const statements: string[] = [];
  let current = "";
  let inString = false;
  for (let i = 0; i < withoutComments.length; i++) {
    const ch = withoutComments[i];
    if (ch === "'") inString = !inString;
    if (!inString && ch === ";") {
      const trimmed = current.trim();
      if (trimmed.length > 0) statements.push(trimmed);
      current = "";
      continue;
    }
    current += ch;
  }
  const trimmedTail = current.trim();
  if (trimmedTail.length > 0) statements.push(trimmedTail);
  return statements;
}

async function applyReferenceData(harnessDb: import("@cloudflare/workers-types").D1Database) {
  const sql = readFileSync(REFERENCE_DATA_PATH, "utf-8");
  for (const [index, statement] of splitStatements(sql).entries()) {
    try {
      await harnessDb.prepare(statement).run();
    } catch (error) {
      throw new Error(
        `reference-data.sql statement #${index} failed: ${(error as Error).message}\n---\n${statement}\n---`,
      );
    }
  }
}

/**
 * RISK-018 regression test (Phase 0-18 final release). Proves that
 * re-running `reference-data.sql` after a new crawler is added under an
 * operator already represented in the published `reg_2026_07_3` release
 * cannot silently expand that release's membership. Fails against the old
 * `WHERE operator_id IN (...)` implementation, passes against the fixed
 * static-id-list implementation.
 */
describe("registry seed immutability (RISK-018, real D1)", () => {
  let db: Database;
  let dispose: () => Promise<void>;
  let rawDb: import("@cloudflare/workers-types").D1Database;

  beforeAll(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    rawDb = harness.db;
    db = createDb(harness.db);
    // The harness's own default fixture (reg_test/rules_test) is already
    // active, and both registry_versions.is_active and
    // ruleset_versions.is_active are guarded by a single-active unique
    // index — deactivate the fixture first so reference-data.sql's own
    // INSERT OR IGNORE for reg_2026_07_3/rules_2026_07_2 isn't silently
    // dropped by that constraint.
    await db.update(schema.registryVersions).set({ isActive: false });
    await db.update(schema.rulesetVersions).set({ isActive: false });
    await applyReferenceData(rawDb);
  });

  afterAll(async () => {
    await dispose();
  });

  it("does not gain a new entry when a new crawler is added under an already-represented operator and the seed re-runs", async () => {
    const entriesBefore = await db
      .select({ crawlerId: schema.registryVersionEntries.crawlerId })
      .from(schema.registryVersionEntries)
      .where(eq(schema.registryVersionEntries.registryVersionId, "reg_2026_07_3"));
    expect(entriesBefore).toHaveLength(23);
    const checksumBefore = await computeRegistryChecksum(db, "reg_2026_07_3");

    // Add a brand-new crawler under op_openai — one of the 9 operators the
    // old `WHERE operator_id IN (...)` clause matched — simulating a
    // registry admin adding a new crawler after this release was published.
    const now = new Date().toISOString();
    await db.insert(schema.crawlers).values({
      id: "crw_new_openai_bot",
      operatorId: "op_openai",
      name: "NewOpenAIBot",
      userAgentToken: "NewOpenAIBot",
      purpose: "search",
      description: "A crawler added after reg_2026_07_3 was published.",
      officialSourceUrl: "https://example.test/new-openai-bot",
      lifecycleStatus: "active",
      firstVerifiedAt: now,
      lastVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Re-run the seed file exactly as an operator/CI job might.
    await applyReferenceData(rawDb);

    const entriesAfter = await db
      .select({ crawlerId: schema.registryVersionEntries.crawlerId })
      .from(schema.registryVersionEntries)
      .where(eq(schema.registryVersionEntries.registryVersionId, "reg_2026_07_3"));
    expect(entriesAfter).toHaveLength(23);
    expect(entriesAfter.map((e) => e.crawlerId).sort()).toEqual(
      entriesBefore.map((e) => e.crawlerId).sort(),
    );
    expect(entriesAfter.some((e) => e.crawlerId === "crw_new_openai_bot")).toBe(false);

    const checksumAfter = await computeRegistryChecksum(db, "reg_2026_07_3");
    expect(checksumAfter).toBe(checksumBefore);
  });
});
