import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { createD1TestHarness } from "./d1-harness";

/**
 * RISK-025 regression test. `scripts/registry-tools.mjs`'s duplicate-token
 * validator has always compared tokens case-insensitively
 * (`GROUP BY LOWER(user_agent_token)`), but the DB's own unique index used
 * SQLite's default BINARY collation, so 'TestBot' and 'testbot' could both be
 * inserted as distinct rows even though the CLI validator would flag them as
 * duplicates. Migration 0037 redefines the index `COLLATE NOCASE` to close
 * that gap. Fails against the pre-0037 index, passes against the fixed one.
 */
describe("registry crawler user_agent_token case-insensitive uniqueness (RISK-025, real D1)", () => {
  let dispose: () => Promise<void>;
  let rawDb: D1Database;

  beforeEach(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    rawDb = harness.db as unknown as D1Database;
  });

  afterEach(async () => {
    await dispose();
  });

  it("rejects a second crawler whose token differs only by case from an existing one", async () => {
    // The harness fixture already inserts crawler 'crawler_test' with
    // user_agent_token 'TestBot' under operator 'op_test'.
    const now = new Date().toISOString();

    await expect(
      rawDb
        .prepare(
          `INSERT INTO crawlers (
            id, operator_id, name, user_agent_token, purpose, description,
            official_source_url, lifecycle_status, first_verified_at, last_verified_at,
            created_at, updated_at
          ) VALUES ('crawler_test_case_variant', 'op_test', 'TestBot (case variant)', 'testbot', 'search', 'Case-variant test crawler', 'https://example.test/testbot', 'active', ?, ?, ?, ?)`,
        )
        .bind(now, now, now, now)
        .run(),
    ).rejects.toThrow(/UNIQUE constraint failed/i);
  });

  it("still allows two genuinely distinct tokens", async () => {
    const now = new Date().toISOString();

    await expect(
      rawDb
        .prepare(
          `INSERT INTO crawlers (
            id, operator_id, name, user_agent_token, purpose, description,
            official_source_url, lifecycle_status, first_verified_at, last_verified_at,
            created_at, updated_at
          ) VALUES ('crawler_test_distinct', 'op_test', 'AnotherBot', 'AnotherBot', 'search', 'Distinct test crawler', 'https://example.test/anotherbot', 'active', ?, ?, ?, ?)`,
        )
        .bind(now, now, now, now)
        .run(),
    ).resolves.toBeDefined();
  });
});
