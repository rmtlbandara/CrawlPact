#!/usr/bin/env node
// Read-only documentation-governance validator (Phase 1). No production/runtime import path,
// no network access — only checks committed documentation files for internal consistency.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");

const REQUIRED_FILES = [
  "README.md",
  "docs/status/CURRENT_STATE.md",
  "CHANGELOG.md",
  "docs/README.md",
  "docs/risks/ACTIVE_RISKS.md",
  "docs/risks/RISK_ARCHIVE.md",
  "docs/governance/DOCUMENTATION_GOVERNANCE.md",
  "docs/governance/DOCUMENTATION_INVENTORY.md",
  "docs/roadmap/CRAWLPACT_IMPROVEMENT_IMPLEMENTATION_PLAN.md",
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

// Current-authoritative documents that must never describe these verified-live capabilities as
// unimplemented. Scoped narrowly (current-authoritative docs only) so historical archive files
// that truthfully describe an older state never fail this check.
const CURRENT_AUTHORITATIVE_DOCS = [
  "README.md",
  "docs/status/CURRENT_STATE.md",
  "docs/product/PRODUCT_SCOPE.md",
  "docs/status/REQUIREMENTS_TRACEABILITY.md",
  "docs/architecture/DATA_FLOW.md",
  "docs/architecture/SYSTEM_CONTEXT.md",
  "docs/design/UX_FLOWS.md",
];

const STALE_CLAIM_PATTERNS = [
  { name: "scanner unimplemented", pattern: /scanner[^.\n]{0,40}(not|un)implemented/i },
  {
    name: "authentication unimplemented",
    pattern: /authentication[^.\n]{0,40}(not|un)implemented/i,
  },
  { name: "monitoring unimplemented", pattern: /monitoring[^.\n]{0,40}(not|un)implemented/i },
  { name: "billing unimplemented", pattern: /billing[^.\n]{0,40}(not|un)implemented/i },
  { name: "Super Admin unimplemented", pattern: /super admin[^.\n]{0,40}(not|un)implemented/i },
  {
    name: "agency functionality entirely unimplemented",
    pattern: /agency[^.\n]{0,40}(not built|not implemented|entirely unimplemented)/i,
  },
  {
    name: "incident/status capability unimplemented",
    pattern: /(incident|status)[^.\n]{0,40}(not|un)implemented/i,
  },
];

const ARCHIVE_DIR = "docs/archive";

function readIfExists(relPath) {
  const full = path.join(REPO_ROOT, relPath);
  return existsSync(full) ? readFileSync(full, "utf8") : null;
}

function listMarkdownFiles(dir) {
  const full = path.join(REPO_ROOT, dir);
  if (!existsSync(full)) return [];
  const out = [];
  for (const entry of readdirSync(full, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listMarkdownFiles(rel));
    } else if (entry.name.endsWith(".md")) {
      out.push(rel);
    }
  }
  return out;
}

function main() {
  const errors = [];
  const warnings = [];

  // 1. Required files exist.
  for (const rel of REQUIRED_FILES) {
    if (!existsSync(path.join(REPO_ROOT, rel))) {
      errors.push(`Missing required documentation file: ${rel}`);
    }
  }

  // 2. Current-state metadata: required front-matter fields present.
  const currentState = readIfExists("docs/status/CURRENT_STATE.md");
  if (currentState) {
    const requiredFields = [
      "Document owner",
      "Status",
      "Last verified",
      "Repository commit",
      "Database migration version",
      "Review frequency",
    ];
    for (const field of requiredFields) {
      if (!currentState.includes(field)) {
        errors.push(
          `docs/status/CURRENT_STATE.md is missing required front-matter field: ${field}`,
        );
      }
    }
  }

  // 3. Status vocabulary: reject unapproved capability-status-like tokens inside CURRENT_STATE.md
  // and the requirements traceability matrix's capability-status columns (heuristic: any
  // hyphenated "verified-*"/"documented-only"/etc.-shaped token not on the approved list).
  for (const rel of [
    "docs/status/CURRENT_STATE.md",
    "docs/baseline/2026-08-03/CAPABILITY_MATRIX.md",
  ]) {
    const content = readIfExists(rel);
    if (!content) continue;
    const tokens =
      content.match(
        /\b(?:verified-\w+|documented-only|historical-only|code-present-not-production-verified)\b/g,
      ) ?? [];
    for (const token of new Set(tokens)) {
      if (!APPROVED_CAPABILITY_STATUSES.includes(token)) {
        errors.push(`${rel} uses a non-approved status-like token: ${token}`);
      }
    }
  }

  // 4. Prohibited stale statements, scoped to current-authoritative documents only.
  for (const rel of CURRENT_AUTHORITATIVE_DOCS) {
    const content = readIfExists(rel);
    if (!content) continue;
    for (const { name, pattern } of STALE_CLAIM_PATTERNS) {
      if (pattern.test(content)) {
        errors.push(
          `${rel} contains a stale claim ("${name}") in a current-authoritative document`,
        );
      }
    }
  }

  // 5. Archive notices: every file under docs/archive/ (excluding its own README index files)
  // must contain a historical-document notice.
  const archiveFiles = listMarkdownFiles(ARCHIVE_DIR).filter(
    (f) => !f.endsWith("/README.md") && !f.endsWith("\\README.md"),
  );
  for (const rel of archiveFiles) {
    const content = readIfExists(rel);
    if (content && !/Historical document/i.test(content)) {
      errors.push(`${rel} is under docs/archive/ but has no historical-document notice`);
    }
  }

  // 6. Duplicate current-state ownership: only one file may claim to be "the authoritative
  // current-state document" (a phrase this project's own docs use consistently for this purpose).
  const claimants = [];
  for (const rel of listMarkdownFiles("docs")) {
    if (rel === "docs/README.md") continue; // the portal describes other docs, doesn't self-claim
    const content = readIfExists(rel);
    if (
      content &&
      /this is the single,? (shortest )?authoritative description of what('s| is) currently true/i.test(
        content,
      )
    ) {
      claimants.push(rel);
    }
  }
  if (claimants.length > 1) {
    errors.push(
      `Multiple files claim to be the authoritative current-state document: ${claimants.join(", ")}`,
    );
  } else if (claimants.length === 0) {
    warnings.push(
      "No file was found claiming to be the authoritative current-state document (expected docs/status/CURRENT_STATE.md)",
    );
  }

  // 7. Roadmap phase index contains Phases 0-19.
  const roadmap = readIfExists("docs/roadmap/CRAWLPACT_IMPROVEMENT_IMPLEMENTATION_PLAN.md");
  if (roadmap) {
    for (let i = 0; i <= 19; i++) {
      if (!new RegExp(`Phase ${i}\\b`).test(roadmap)) {
        errors.push(`Roadmap is missing Phase ${i}`);
      }
    }
  }

  // 8. No secret-shaped values in documentation (narrow patterns only — real secrets, not every
  // string containing "key"/"token").
  const SECRET_PATTERNS = [
    { name: "Paddle live API key", pattern: /\bpdl_live_[A-Za-z0-9]{10,}/ },
    { name: "generic private key block", pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/ },
  ];
  for (const rel of listMarkdownFiles("docs").concat(["README.md", "CHANGELOG.md"])) {
    const content = readIfExists(rel);
    if (!content) continue;
    for (const { name, pattern } of SECRET_PATTERNS) {
      if (pattern.test(content)) {
        errors.push(`Possible secret pattern (${name}) found in ${rel}`);
      }
    }
  }

  if (warnings.length > 0) {
    console.warn(`\n${warnings.length} warning(s):`);
    for (const w of warnings) console.warn(`  - ${w}`);
  }
  if (errors.length > 0) {
    console.error(`\n${errors.length} error(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    console.error("\ndocs:validate: FAILED");
    process.exit(1);
  }

  console.log(
    `docs:validate: PASSED (${REQUIRED_FILES.length} required files present, ${CURRENT_AUTHORITATIVE_DOCS.length} current-authoritative docs checked for stale claims, ${archiveFiles.length} archive files checked for notices)`,
  );
}

main();
