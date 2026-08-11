#!/usr/bin/env node
// Phase 14 operations-documentation validator (§139). Read-only, no network access. Checks that
// the operational runbook/documentation set stays honest and doesn't silently rot — it does not
// (and cannot) prove procedural correctness through filename existence alone (§140); it only
// catches the specific regressions this phase's own audit found: stale "no production deployment"
// language, missing required-runbook topics, and a second, competing status vocabulary being
// introduced somewhere.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");

function read(relPath) {
  return readFileSync(path.join(REPO_ROOT, relPath), "utf8");
}

function exists(relPath) {
  return existsSync(path.join(REPO_ROOT, relPath));
}

const errors = [];

// --- 1. Required scheduled jobs are documented somewhere under docs/operations/ -------------

const WORKER_TS = read("apps/web/src/worker.ts");
const jobNameMatches = [
  ...WORKER_TS.matchAll(/startJobRun\(\s*env,\s*"([a-z_]+)"/g),
  ...WORKER_TS.matchAll(/scheduledDowngradesJob.*?"([a-z_]+)"/g),
];
const REQUIRED_JOB_NAMES = [
  "monitoring_sweep",
  "notification_reconciliation",
  "scheduled_plan_changes",
  "data_retention_purge",
];
const opsDocsDir = "docs/operations";
const opsDocFiles = readdirSync(path.join(REPO_ROOT, opsDocsDir)).filter((f) => f.endsWith(".md"));
const opsDocsCombined = opsDocFiles.map((f) => read(path.join(opsDocsDir, f))).join("\n");
for (const jobName of REQUIRED_JOB_NAMES) {
  if (!opsDocsCombined.includes(jobName)) {
    errors.push(
      `Required scheduled job "${jobName}" is not mentioned anywhere under docs/operations/`,
    );
  }
}
if (jobNameMatches.length === 0) {
  errors.push(
    "Could not find any startJobRun(...) calls in worker.ts — job-name extraction regex may be stale",
  );
}

// --- 2. Health-signal mapping documents exist ------------------------------------------------

const REQUIRED_SIGNAL_DOCS = [
  "docs/operations/SERVICE_HEALTH_SIGNAL_MODEL.md",
  "docs/operations/PUBLIC_COMPONENT_SIGNAL_MAPPING.md",
];
for (const docPath of REQUIRED_SIGNAL_DOCS) {
  if (!exists(docPath)) errors.push(`Required health-signal doc missing: ${docPath}`);
}

// --- 3. Required runbook topics exist somewhere (not proof of correctness, just presence) ---

const REQUIRED_RUNBOOK_TOPICS = [
  { topic: "Incident", anyOf: ["docs/operations/INCIDENT_RESPONSE.md"] },
  {
    topic: "Recovery",
    anyOf: [
      "docs/operations/BACKUP_AND_RECOVERY.md",
      "docs/operations/DISASTER_RECOVERY_RUNBOOK.md",
    ],
  },
  { topic: "Monitoring", anyOf: ["docs/operations/PHASE_10_MONITORING_RELIABILITY_RUNBOOK.md"] },
  { topic: "Billing", anyOf: ["docs/operations/DISASTER_RECOVERY_RUNBOOK.md"] },
  { topic: "Authentication", anyOf: ["docs/operations/DISASTER_RECOVERY_RUNBOOK.md"] },
  { topic: "Scanner", anyOf: ["docs/operations/DISASTER_RECOVERY_RUNBOOK.md"] },
  {
    topic: "Retention",
    anyOf: [
      "docs/data/PHASE_11_RETENTION_DECISION_MATRIX.md",
      "docs/operations/DISASTER_RECOVERY_RUNBOOK.md",
    ],
  },
  { topic: "Deployment", anyOf: ["docs/operations/RUNBOOK.md"] },
  { topic: "Maintenance", anyOf: ["docs/operations/MAINTENANCE_MODE_DECISION_MATRIX.md"] },
];
for (const { topic, anyOf } of REQUIRED_RUNBOOK_TOPICS) {
  if (!anyOf.some((p) => exists(p))) {
    errors.push(`No runbook found for required topic "${topic}" (checked: ${anyOf.join(", ")})`);
  }
}

// --- 4. No stale "production does not exist" language ----------------------------------------

const STALE_PATTERNS = [
  /no production deployment exists yet/i,
  /nothing has been deployed to any live environment/i,
];
for (const docPath of [
  "docs/operations/INCIDENT_RESPONSE.md",
  "docs/operations/RUNBOOK.md",
  "docs/operations/SYSTEM_HEALTH.md",
]) {
  if (!exists(docPath)) continue;
  const content = read(docPath);
  for (const pattern of STALE_PATTERNS) {
    if (pattern.test(content)) {
      errors.push(`${docPath}: contains stale "production does not exist" language (${pattern})`);
    }
  }
}

// --- 5. Recovery docs exist and are not the pre-2026-07-26 "no production database" framing --

if (exists("docs/operations/BACKUP_AND_RECOVERY.md")) {
  const content = read("docs/operations/BACKUP_AND_RECOVERY.md");
  if (/^No production D1 database exists yet$/m.test(content)) {
    errors.push(
      "docs/operations/BACKUP_AND_RECOVERY.md: contains the unstruck-through stale 'no production D1 database' claim",
    );
  }
}

// --- 6. Exactly one definition of the public status vocabulary / component list -------------

const filesLikelyToRedefineVocabulary = [];
function walk(dir) {
  for (const entry of readdirSync(path.join(REPO_ROOT, dir), { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(rel);
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      const content = read(rel);
      if (
        content.includes("degraded_performance") &&
        content.includes("partial_outage") &&
        content.includes("major_outage") &&
        content.includes("status_unavailable")
      ) {
        filesLikelyToRedefineVocabulary.push(rel);
      }
    }
  }
}
walk("apps/web/src");
// The public vocabulary's canonical TYPE definition lives in exactly one place
// (lib/status/public-status.ts); every other file that mentions all four
// non-operational levels together is expected to be *consuming* that type
// (a component, an API route), not redefining it as a second literal union.
const canonicalDefiners = filesLikelyToRedefineVocabulary.filter((f) =>
  read(f).includes("export type PublicStatusLevel"),
);
if (canonicalDefiners.length !== 1) {
  errors.push(
    `Expected exactly one canonical "export type PublicStatusLevel" definition, found ${canonicalDefiners.length}: ${canonicalDefiners.join(", ")}`,
  );
}

// --- Report -----------------------------------------------------------------------------------

if (errors.length > 0) {
  console.error(`\n${errors.length} error(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  console.error("\noperations:validate: FAILED");
  process.exit(1);
}

console.log(
  `operations:validate: PASSED (${REQUIRED_JOB_NAMES.length} scheduled jobs documented, ${REQUIRED_RUNBOOK_TOPICS.length} runbook topics present, 1 canonical status vocabulary)`,
);
