#!/usr/bin/env node
// Read-only status/changelog trust validator (Public Status and Changelog Trust Correction). No
// network access — checks current public source files for the specific regressions that
// correction fixed: the removed trust-reducing uptime sentence (and close variants), a
// fabricated uptime percentage, a public link to the archived IMPLEMENTATION_STATUS.md doc, and
// internal-only status fields leaking into the public status page's own source. This is narrower
// than scripts/trust-validate.mjs (country/jurisdiction/contact) by design — a distinct concern,
// not a duplicate.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");

const SCAN_DIRS = ["apps/web/src"];

const EXCLUDE_PATTERNS = [
  /\/node_modules\//,
  /\/dist\//,
  /\/\.astro\//,
  /\/test-results\//,
  /\/playwright-report\//,
];

const SCAN_EXTENSIONS = [".astro", ".ts", ".tsx", ".md"];

function isExcluded(filePath) {
  return EXCLUDE_PATTERNS.some((p) => p.test(filePath));
}

function listFiles(relDir) {
  const full = path.join(REPO_ROOT, relDir);
  if (!existsSync(full)) return [];
  const stat = statSync(full);
  if (stat.isFile()) {
    return SCAN_EXTENSIONS.includes(path.extname(full)) ? [relDir] : [];
  }
  const out = [];
  for (const entry of readdirSync(full, { withFileTypes: true })) {
    const rel = path.join(relDir, entry.name);
    if (isExcluded(rel)) continue;
    if (entry.isDirectory()) {
      out.push(...listFiles(rel));
    } else if (SCAN_EXTENSIONS.includes(path.extname(entry.name))) {
      out.push(rel);
    }
  }
  return out;
}

// The exact sentence removed, plus close negative-explanation variants that must never replace
// it (see §8 of the correction prompt: do not swap one negative admission for another).
const PROHIBITED_UPTIME_EXPLANATION_PATTERNS = [
  {
    name: "removed trust-reducing sentence",
    pattern: /does not yet have reliable historical uptime/i,
  },
  { name: "uptime is not available", pattern: /uptime is not available/i },
  {
    name: "historical monitoring is unavailable",
    pattern: /historical monitoring is unavailable/i,
  },
  { name: "we cannot calculate uptime", pattern: /we cannot calculate uptime/i },
  { name: "uptime tracking is incomplete", pattern: /uptime tracking is incomplete/i },
  { name: "reliable data is not yet available", pattern: /reliable data is not yet available/i },
];

// A real uptime/availability percentage would be a fabricated statistic (no measurement pipeline
// exists) — catches "99.9% uptime" / "uptime: 99.95%" shaped strings anywhere in public source.
const FABRICATED_UPTIME_PATTERN = /\b\d{1,3}(\.\d+)?%\s*(uptime|availability)\b/i;

const GENERIC_TRUST_REDUCING_PATTERNS = [
  { name: "still in development", pattern: /still in development/i },
  { name: "not yet production-ready", pattern: /not yet production-ready/i },
  { name: "experimental deployment", pattern: /experimental deployment/i },
  { name: "incomplete implementation", pattern: /incomplete implementation/i },
  { name: "verification has not been performed", pattern: /verification has not been performed/i },
  { name: "work in progress", pattern: /work in progress/i },
];

// The archived doc must never be linked from public source again (§10) — matches both a Markdown
// link and a bare path reference, the exact shape the pre-correction bug used.
const IMPLEMENTATION_STATUS_REFERENCE_PATTERN = /docs\/status\/IMPLEMENTATION_STATUS\.md/i;

// Public-facing files that must never import/reference internal-only status fields — the
// structural half of "internal reasons are absent from public output" (§15). `ComponentHealth`/
// `getComponentHealth`/`getStatusOverview` carry internal detail (`detail`, `internalReason`,
// `verificationSource`); public pages must only ever consume `getPublicStatus`'s own
// `PublicStatusReport`/`PublicComponentStatus` types, which structurally have no such fields.
const PUBLIC_STATUS_FILES = ["apps/web/src/pages/status.astro"];
const INTERNAL_LEAK_PATTERNS = [
  { name: "getComponentHealth import", pattern: /getComponentHealth/ },
  { name: "getStatusOverview import", pattern: /getStatusOverview/ },
  { name: "getSystemStatusSummary import", pattern: /getSystemStatusSummary/ },
];

function main() {
  const errors = [];
  const allFiles = SCAN_DIRS.flatMap(listFiles);

  for (const rel of allFiles) {
    const content = readFileSync(path.join(REPO_ROOT, rel), "utf8");

    for (const { name, pattern } of PROHIBITED_UPTIME_EXPLANATION_PATTERNS) {
      if (pattern.test(content)) {
        errors.push(`${rel}: contains a prohibited uptime-explanation pattern (${name})`);
      }
    }

    if (FABRICATED_UPTIME_PATTERN.test(content)) {
      const match = content.match(FABRICATED_UPTIME_PATTERN);
      errors.push(`${rel}: possible fabricated uptime/availability percentage (${match?.[0]})`);
    }

    for (const { name, pattern } of GENERIC_TRUST_REDUCING_PATTERNS) {
      if (pattern.test(content)) {
        errors.push(`${rel}: contains prohibited trust-reducing wording (${name})`);
      }
    }

    if (IMPLEMENTATION_STATUS_REFERENCE_PATTERN.test(content)) {
      errors.push(
        `${rel}: references the archived docs/status/IMPLEMENTATION_STATUS.md — must not be linked from public source (see docs/archive/implementation-history/IMPLEMENTATION_STATUS.md)`,
      );
    }
  }

  for (const rel of PUBLIC_STATUS_FILES) {
    const full = path.join(REPO_ROOT, rel);
    if (!existsSync(full)) {
      errors.push(`${rel}: expected public status page not found`);
      continue;
    }
    const content = readFileSync(full, "utf8");
    for (const { name, pattern } of INTERNAL_LEAK_PATTERNS) {
      if (pattern.test(content)) {
        errors.push(
          `${rel}: references an internal-only status function (${name}) — must only consume getPublicStatus's PublicStatusReport`,
        );
      }
    }
  }

  if (errors.length > 0) {
    console.error(`\n${errors.length} error(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    console.error("\nstatus:validate: FAILED");
    process.exit(1);
  }

  console.log(`status:validate: PASSED (${allFiles.length} files scanned)`);
}

main();
