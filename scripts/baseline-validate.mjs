#!/usr/bin/env node
// Read-only Phase 0 baseline validator. No production/runtime import path — only checks that the
// docs/baseline/<date>/ directory this repository's Phase 0 process produced is internally
// consistent. Never writes files, never touches a database, never calls a network API.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const BASELINE_ROOT = path.join(REPO_ROOT, "docs", "baseline");

const REQUIRED_FILES = [
  "README.md",
  "PHASE_0_BASELINE_REPORT.md",
  "phase-0-baseline.json",
  "phase-0-baseline.schema.json",
  "ROUTE_INVENTORY.md",
  "CAPABILITY_MATRIX.md",
  "PRODUCTION_INFRASTRUCTURE_INVENTORY.md",
  "ENVIRONMENT_AND_BINDING_INVENTORY.md",
  "DATABASE_AND_MIGRATION_BASELINE.md",
  "BILLING_AND_PLAN_BASELINE.md",
  "CRAWLER_REGISTRY_BASELINE.md",
  "ANALYTICS_AND_CONSENT_BASELINE.md",
  "TEST_AND_CI_EVIDENCE.md",
  "SCREENSHOT_MANIFEST.md",
  "DOCUMENTATION_CONFLICTS.md",
  "BASELINE_RISKS_AND_UNKNOWNS.md",
  "file-hashes.sha256",
];

const APPROVED_CAPABILITY_STATUSES = [
  "verified-live",
  "verified-disabled",
  "verified-partial",
  "code-present-not-production-verified",
  "documented-only",
  "historical-only",
  "unknown",
  "verification-blocked",
];

// Deliberately narrow patterns — real secrets, not every string containing "key"/"token".
const SECRET_PATTERNS = [
  { name: "Paddle live API key", pattern: /\bpdl_live_[A-Za-z0-9]{10,}/ },
  { name: "Paddle webhook secret prefix", pattern: /\bpdl_ntfset_[A-Za-z0-9]{10,}/ },
  { name: "AWS access key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "generic private key block", pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/ },
  { name: "Cloudflare API token shape", pattern: /\b[A-Za-z0-9_-]{37}\b.*Cloudflare/i },
];

function findLatestBaselineDir() {
  if (!existsSync(BASELINE_ROOT)) {
    return null;
  }
  const dateDirs = readdirSync(BASELINE_ROOT).filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name));
  if (dateDirs.length === 0) {
    return null;
  }
  dateDirs.sort();
  return path.join(BASELINE_ROOT, dateDirs[dateDirs.length - 1]);
}

function listAllFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listAllFiles(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function main() {
  const errors = [];
  const warnings = [];

  const dir = findLatestBaselineDir();
  if (!dir) {
    console.error("baseline:validate: no docs/baseline/YYYY-MM-DD directory found.");
    process.exit(1);
  }
  console.log(`baseline:validate: checking ${path.relative(REPO_ROOT, dir)}`);

  // 1. Required files exist
  for (const rel of REQUIRED_FILES) {
    if (!existsSync(path.join(dir, rel))) {
      errors.push(`Missing required file: ${rel}`);
    }
  }

  // 2. JSON matches its schema (structural check only — required top-level keys, no external
  // ajv/zod dependency added solely for this).
  const jsonPath = path.join(dir, "phase-0-baseline.json");
  const schemaPath = path.join(dir, "phase-0-baseline.schema.json");
  if (existsSync(jsonPath) && existsSync(schemaPath)) {
    try {
      const data = JSON.parse(readFileSync(jsonPath, "utf8"));
      const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
      for (const key of schema.required ?? []) {
        if (!(key in data)) {
          errors.push(`phase-0-baseline.json missing required top-level key: ${key}`);
        }
      }
      // runtimeImpact must be all-false per the schema's own const constraints.
      const runtimeImpact = data.runtimeImpact ?? {};
      for (const [key, value] of Object.entries(runtimeImpact)) {
        if (value !== false) {
          errors.push(
            `phase-0-baseline.json runtimeImpact.${key} must be false, got ${JSON.stringify(value)}`,
          );
        }
      }
    } catch (err) {
      errors.push(`phase-0-baseline.json is not valid JSON: ${err.message}`);
    }
  }

  // 3. No obvious secret patterns present, across every file in the directory.
  const allFiles = existsSync(dir) ? listAllFiles(dir) : [];
  for (const file of allFiles) {
    if (path.extname(file) === ".png" || path.extname(file) === ".jpg") continue;
    const content = readFileSync(file, "utf8");
    for (const { name, pattern } of SECRET_PATTERNS) {
      if (pattern.test(content)) {
        errors.push(`Possible secret pattern (${name}) found in ${path.relative(dir, file)}`);
      }
    }
  }

  // 4. Evidence files listed in the JSON manifest all exist.
  if (existsSync(jsonPath)) {
    try {
      const data = JSON.parse(readFileSync(jsonPath, "utf8"));
      for (const rel of data.evidenceFiles ?? []) {
        if (!existsSync(path.join(dir, rel))) {
          errors.push(`evidenceFiles entry does not exist on disk: ${rel}`);
        }
      }
    } catch {
      // already reported above
    }
  }

  // 5. File hashes match (only checked if file-hashes.sha256 exists — generation is a separate
  // step, run once all baseline documents are final).
  const hashesPath = path.join(dir, "file-hashes.sha256");
  if (existsSync(hashesPath)) {
    const lines = readFileSync(hashesPath, "utf8").split("\n").filter(Boolean);
    for (const line of lines) {
      const match = line.match(/^([0-9a-f]{64})\s+\S*?([^/\s]+(?:\/[^/\s]+)*)$/);
      if (!match) continue;
      const [, expectedHash, relPath] = match;
      const filePath = path.join(dir, relPath);
      if (!existsSync(filePath)) {
        errors.push(`file-hashes.sha256 references a missing file: ${relPath}`);
        continue;
      }
      const actualHash = createHash("sha256").update(readFileSync(filePath)).digest("hex");
      if (actualHash !== expectedHash) {
        errors.push(`Hash mismatch for ${relPath}: expected ${expectedHash}, got ${actualHash}`);
      }
    }
  } else {
    warnings.push("file-hashes.sha256 not found — hash verification skipped");
  }

  // 6. Roadmap phase index contains Phases 0-19.
  const roadmapPath = path.join(
    REPO_ROOT,
    "docs",
    "roadmap",
    "CRAWLPACT_IMPROVEMENT_IMPLEMENTATION_PLAN.md",
  );
  if (existsSync(roadmapPath)) {
    const roadmap = readFileSync(roadmapPath, "utf8");
    for (let i = 0; i <= 19; i++) {
      if (!new RegExp(`Phase ${i}\\b`).test(roadmap)) {
        errors.push(`Roadmap is missing Phase ${i}`);
      }
    }
  } else {
    errors.push(
      "Master roadmap docs/roadmap/CRAWLPACT_IMPROVEMENT_IMPLEMENTATION_PLAN.md not found",
    );
  }

  // 7. Capability statuses use the approved vocabulary (spot-check CAPABILITY_MATRIX.md's status
  // column values against the approved list; flags any status-looking token not on the list).
  const matrixPath = path.join(dir, "CAPABILITY_MATRIX.md");
  if (existsSync(matrixPath)) {
    const matrix = readFileSync(matrixPath, "utf8");
    const statusLikeTokens =
      matrix.match(
        /\b(?:verified-\w+|documented-only|historical-only|code-present-not-production-verified)\b/g,
      ) ?? [];
    for (const token of new Set(statusLikeTokens)) {
      if (!APPROVED_CAPABILITY_STATUSES.includes(token)) {
        errors.push(`CAPABILITY_MATRIX.md uses a non-approved status-like token: ${token}`);
      }
    }
  }

  // Report
  if (warnings.length > 0) {
    console.warn(`\n${warnings.length} warning(s):`);
    for (const w of warnings) console.warn(`  - ${w}`);
  }
  if (errors.length > 0) {
    console.error(`\n${errors.length} error(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    console.error("\nbaseline:validate: FAILED");
    process.exit(1);
  }

  console.log(
    `\nbaseline:validate: PASSED (${REQUIRED_FILES.length} required files present, ${allFiles.length} files scanned for secrets)`,
  );
}

main();
