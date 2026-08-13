#!/usr/bin/env node
/**
 * Phase 17 customer-pilot validation tooling (§179). Operates against the
 * local D1 database via `wrangler d1 execute --local` (never remote),
 * mirroring `scripts/registry-tools.mjs`/`scripts/research-tools.mjs`'s
 * pattern exactly.
 *
 *   node scripts/pilot-validate.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(import.meta.url), "../..");
const wranglerConfig = path.join(rootDir, "apps/web/wrangler.jsonc");

function query(sql) {
  const output = execFileSync(
    "npx",
    [
      "--yes",
      "wrangler",
      "d1",
      "execute",
      "crawlpact-db",
      "--local",
      "--config",
      wranglerConfig,
      "--json",
      "--command",
      sql,
    ],
    { encoding: "utf8", cwd: rootDir },
  );
  const parsed = JSON.parse(output);
  return parsed[0]?.results ?? [];
}

const REQUIRED_DOCS = [
  "docs/pilot/PHASE_17_PILOT_BASELINE.md",
  "docs/pilot/PHASE_17_PILOT_HYPOTHESES.md",
  "docs/pilot/PHASE_17_SUCCESS_CRITERIA.md",
  "docs/pilot/PHASE_17_PARTICIPANT_QUALIFICATION.md",
  "docs/pilot/PHASE_17_PILOT_DATA_MODEL_DECISION.md",
  "docs/pilot/PILOT_PARTICIPANT_NOTICE.md",
  "docs/pilot/PILOT_TASK_SCRIPT.md",
  "docs/pilot/PILOT_INTERVIEW_GUIDE.md",
  "docs/pilot/PILOT_FEEDBACK_CODING_SCHEMA.md",
  "docs/pilot/PILOT_SUPPORT_BURDEN_MEASUREMENT.md",
  "docs/pilot/PHASE_17_COMMERCIAL_METRIC_DICTIONARY.md",
  "docs/pilot/REAL_PAID_CHECKOUT_VALIDATION_PROTOCOL.md",
  "docs/pilot/PHASE_17_CHANGE_CONTROL_POLICY.md",
  "docs/pilot/PHASE_17_PILOT_DATA_RETENTION_DECISION.md",
  "docs/pilot/COMMERCIAL_VALIDATION_DECISION_FRAMEWORK.md",
  "docs/pilot/PHASE_17_COMMERCIAL_VALIDATION_DECISION.md",
  "docs/security/PHASE_17_PILOT_SECURITY_AND_PRIVACY_THREAT_REVIEW.md",
  "docs/operations/PHASE_17_PILOT_RELIABILITY_REVIEW.md",
];

const PARTICIPATION_STATUSES = new Set([
  "invited",
  "joined",
  "active",
  "completed",
  "withdrew",
  "inactive",
  "disqualified",
]);

function validate() {
  const problems = [];

  // Docs present.
  for (const doc of REQUIRED_DOCS) {
    if (!existsSync(path.join(rootDir, doc))) {
      problems.push(`Required Phase 17 doc missing: ${doc}`);
    }
  }

  // Entitlement-coupling guard: the pilot tables must never gain a
  // plan/subscription/entitlement/payment-shaped column. Static check
  // against the migration source, since that's the authoritative shape.
  const migrationPath = path.join(rootDir, "packages/database/migrations/0036_customer_pilot.sql");
  if (!existsSync(migrationPath)) {
    problems.push("packages/database/migrations/0036_customer_pilot.sql not found.");
  } else {
    const rawSql = execFileSync("cat", [migrationPath], { encoding: "utf8" });
    // Strip SQL `--` comments before scanning — this file's own explanatory
    // comments legitimately discuss (and rule out) these terms in prose;
    // only an actual column/constraint definition should ever trip this.
    const sql = rawSql
      .split("\n")
      .map((line) => line.replace(/--.*$/, ""))
      .join("\n")
      .toLowerCase();
    for (const forbidden of ["plan_id", "entitlement", "paddle_", "discount", "coupon"]) {
      if (sql.includes(forbidden)) {
        problems.push(
          `Migration 0036 contains a forbidden entitlement/billing-shaped token "${forbidden}" — pilot membership must never grant or reference an entitlement.`,
        );
      }
    }
  }

  // Structural checks against local D1, if it has the pilot tables applied.
  let hasPilotTables = true;
  try {
    query("SELECT 1 FROM pilot_cohorts LIMIT 1;");
  } catch {
    hasPilotTables = false;
  }

  if (hasPilotTables) {
    const participants = query(
      "SELECT id, participation_status, human_help_count FROM pilot_participants;",
    );
    for (const row of participants) {
      if (!PARTICIPATION_STATUSES.has(row.participation_status)) {
        problems.push(
          `pilot_participants "${row.id}" has invalid participation_status "${row.participation_status}".`,
        );
      }
      if (Number(row.human_help_count) < 0) {
        problems.push(`pilot_participants "${row.id}" has a negative human_help_count.`);
      }
    }

    const orphanFeedback = query(
      "SELECT f.id FROM pilot_feedback f LEFT JOIN pilot_participants p ON f.pilot_participant_id = p.id WHERE p.id IS NULL;",
    );
    for (const row of orphanFeedback) {
      problems.push(`pilot_feedback "${row.id}" references a non-existent pilot_participant.`);
    }
  } else {
    console.log(
      "pilot-validate: local D1 has no pilot_* tables yet (migration not applied) — skipping row-level checks.",
    );
  }

  if (problems.length > 0) {
    console.error(`pilot-validate: found ${problems.length} issue(s):\n`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exitCode = 1;
    return;
  }
  console.log("pilot-validate: no issues found.");
}

validate();
