import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Miniflare } from "miniflare";
import type { D1Database } from "@cloudflare/workers-types";

/**
 * Real D1-backed test harness (Miniflare, no production credentials — see
 * docs/testing/TEST_STRATEGY.md, which explicitly deferred this to "the
 * first endpoint that actually reads/writes a table"). Applies the actual
 * forward-only migration files as-is, so a test run exercises the same
 * schema the real deployment does rather than a hand-maintained fixture
 * that could silently drift from it.
 */

const MIGRATIONS_DIR = fileURLToPath(
  new URL("../../../../packages/database/migrations", import.meta.url),
);

function splitStatements(sql: string): string[] {
  // Strips both full-line and trailing inline `-- ...` comments. Safe here
  // because none of these migrations ever put a literal `--` inside a
  // string value (verified with `grep -n "'.*--.*'"` across migrations/).
  const withoutComments = sql
    .split("\n")
    .map((line) => {
      const commentIndex = line.indexOf("--");
      return commentIndex === -1 ? line : line.slice(0, commentIndex);
    })
    .join("\n");
  return withoutComments
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

export type D1TestHarness = {
  db: D1Database;
  dispose: () => Promise<void>;
};

export async function createD1TestHarness(): Promise<D1TestHarness> {
  const mf = new Miniflare({
    modules: true,
    script: "export default { async fetch() { return new Response('ok'); } };",
    d1Databases: { DB: ":memory:" },
  });

  const db = await mf.getD1Database("DB");

  const migrationFiles = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    const sql = readFileSync(`${MIGRATIONS_DIR}/${file}`, "utf-8");
    for (const [index, statement] of splitStatements(sql).entries()) {
      try {
        await db.prepare(statement).run();
      } catch (error) {
        throw new Error(
          `Migration ${file} statement #${index} failed: ${(error as Error).message}\n---\n${statement}\n---`,
        );
      }
    }
  }

  // Mirrors packages/database/seed/seed.sql's plan rows exactly (SRS §8) so
  // tests can exercise every plan tier's entitlements, not just "free".
  await db
    .prepare(
      `INSERT INTO plans (
        id, name, annual_price_usd_cents, saved_domain_limit, monitoring_frequency,
        history_retention_days, manual_rescans_per_domain_per_month,
        domain_groups_enabled, csv_export_enabled, print_ready_report_tier,
        private_atom_feed_enabled, batch_import_limit, agency_branding_enabled
      ) VALUES
        ('free', 'Free', 0, 1, 'none', 30, 2, 0, 0, 'basic', 0, 0, 0),
        ('solo', 'Solo', 7900, 5, 'monthly', 365, 5, 0, 0, 'full', 1, 0, 0),
        ('pro', 'Pro', 17900, 25, 'weekly', 730, 10, 1, 1, 'full', 1, 10, 0),
        ('agency', 'Agency', 39900, 100, 'weekly', 1095, 20, 1, 1, 'full', 1, 100, 1)`,
    )
    .run();

  // A minimal active registry release (one operator, one crawler) so tests
  // that call getActiveRegistry()/runAudit() (e.g. the monitoring sweep)
  // don't need to hand-roll this every time.
  const now = new Date().toISOString();
  await db
    .prepare(
      "INSERT INTO crawler_operators (id, name, created_at, updated_at) VALUES ('op_test', 'Test Operator', ?, ?)",
    )
    .bind(now, now)
    .run();
  await db
    .prepare(
      `INSERT INTO crawlers (
        id, operator_id, name, user_agent_token, purpose, description,
        official_source_url, lifecycle_status, created_at, updated_at
      ) VALUES ('crawler_test', 'op_test', 'TestBot', 'TestBot', 'search', 'Test crawler', 'https://example.test/testbot', 'active', ?, ?)`,
    )
    .bind(now, now)
    .run();
  await db
    .prepare(
      "INSERT INTO registry_versions (id, version_label, changelog, is_active, created_at) VALUES ('reg_test', 'test-1', 'Initial test registry.', 1, ?)",
    )
    .bind(now)
    .run();
  await db
    .prepare(
      "INSERT INTO ruleset_versions (id, version_label, description, is_active, created_at) VALUES ('rules_test', 'test-1', 'Initial test ruleset.', 1, ?)",
    )
    .bind(now)
    .run();

  // Mirrors seed.sql's admin_roles rows exactly — an FK target for
  // admin_role_assignments, needed by any admin-shell integration test that
  // promotes a signed-up test user to an admin role.
  await db
    .prepare(
      `INSERT INTO admin_roles (id, name, description) VALUES
        ('super_admin', 'Super Admin', 'Full operational visibility and control (SRS §28).'),
        ('registry_manager', 'Registry Manager', 'Manage crawler registry and ruleset releases.'),
        ('billing_viewer', 'Billing Viewer', 'Read-only visibility into billing and revenue data.'),
        ('support_viewer', 'Support Viewer', 'Read-only customer support visibility.'),
        ('security_administrator', 'Security Administrator', 'Manage security events and blocked targets.'),
        ('content_manager', 'Content Manager', 'Manage public content and system notices.')`,
    )
    .run();

  // Mirrors seed.sql's runtime_configuration defaults (SRS §28) — tests can
  // still override individual keys afterwards via a plain UPDATE.
  await db
    .prepare(
      "INSERT INTO runtime_configuration (key, value, value_type, description, min_value, max_value) VALUES ('anonymous_audit_daily_limit', '20', 'integer', 'Max anonymous audits per IP per day.', 1, 1000)",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO runtime_configuration (key, value, value_type, description, min_value, max_value) VALUES ('scan_total_timeout_seconds', '30', 'integer', 'Total wall-clock budget for one scan across all resources (FR-FET-007).', 5, 120)",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO runtime_configuration (key, value, value_type, description, min_value, max_value) VALUES ('maintenance_mode', 'false', 'boolean', 'Global maintenance mode switch (SRS §28.17).', NULL, NULL)",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO runtime_configuration (key, value, value_type, description, min_value, max_value) VALUES ('scheduler_paused', 'false', 'boolean', 'Pauses the scheduled monitoring sweep globally (SRS §28.10).', NULL, NULL)",
    )
    .run();
  await db
    .prepare(
      `INSERT INTO runtime_configuration (key, value, value_type, description, min_value, max_value) VALUES
        ('monitoring_scan_batch_size', '20', 'integer', 'Maximum domains claimed per scheduled monitoring sweep.', 1, 200),
        ('monitoring_claim_lock_minutes', '15', 'integer', 'How long a claimed domain is locked against a second concurrent sweep.', 1, 120),
        ('monitoring_failure_pause_threshold', '5', 'integer', 'Consecutive scan failures before monitoring auto-pauses for a domain.', 1, 20),
        ('anonymous_scan_retention_days', '7', 'integer', 'Days an anonymous scan is kept before purge.', 1, 90),
        ('account_deletion_grace_period_days', '30', 'integer', 'Cancellable grace period before hard-deletion.', 1, 180)`,
    )
    .run();

  return {
    db: db as unknown as D1Database,
    dispose: () => mf.dispose(),
  };
}
