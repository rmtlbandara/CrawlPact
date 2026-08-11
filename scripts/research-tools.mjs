#!/usr/bin/env node
/**
 * Phase 16 Policy Observatory research-publication validation tooling.
 * Operates against the local D1 database via `wrangler d1 execute --local`
 * (never remote), mirroring `scripts/registry-tools.mjs`'s pattern exactly.
 *
 *   node scripts/research-tools.mjs validate
 *   node scripts/research-tools.mjs integrity:verify
 *
 * Full metric reproduction (recomputing a publication's content from its
 * pinned registry release and comparing checksums) is intentionally NOT
 * duplicated here — that requires the same registry-snapshot/semantic-diff
 * logic `apps/web/src/lib/observatory/registry-observatory.ts` already
 * implements in TypeScript. Re-implementing it a second time in this script
 * would be exactly the kind of scanner/logic fork Phase 16 §32 warns
 * against. Reproduction is exercised via
 * `apps/web/src/lib/admin/research.ts`'s `reproduceResearchPublication()`
 * and covered by `research-publication-reproducibility.integration.test.ts`
 * instead — see docs/research/PHASE_16_POLICY_OBSERVATORY_BASELINE.md.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(import.meta.url), "../..");
const wranglerConfig = path.join(rootDir, "apps/web/wrangler.jsonc");

const BANNED_CLAIM_PATTERNS = [
  /\bdefinitive\b/i,
  /\bworld'?s most\b/i,
  /\bthe web is blocking\b/i,
  /\bmost websites\b/i,
  /%\s*of the internet\b/i,
  /\bindustry standard\b/i,
  /\bcomprehensive global study\b/i,
  /\bpeer[- ]reviewed\b/i,
  /\bacademic study\b/i,
  /\bscientific consensus\b/i,
  /\bshocking\b/i,
  /\btaking over the web\b/i,
];

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

// Mirrors apps/web/src/lib/research/publication-checksum.ts's
// canonicalizeForChecksum() exactly — deep, key-sorted canonicalisation so
// the checksum never depends on object key-insertion order.
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    const sortedKeys = Object.keys(value).sort();
    const ordered = {};
    for (const key of sortedKeys) ordered[key] = canonicalize(value[key]);
    return ordered;
  }
  return value;
}

// Mirrors apps/web/src/lib/research/publication-content.ts's
// getChecksumSubset() exactly — generatedAt and correctionLog are excluded
// from the checksum (a wall-clock timestamp and operator commentary, not
// reproducible metrics), or the checksum would be spuriously unstable.
function computeChecksum(content) {
  const { generatedAt, correctionLog, ...subset } = content;
  void generatedAt;
  void correctionLog;
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(subset)))
    .digest("hex");
}

function validate() {
  const problems = [];
  const rows = query("SELECT id, slug, status, content_json, checksum FROM research_publications;");

  const seenSlugs = new Set();
  for (const row of rows) {
    if (seenSlugs.has(row.slug)) {
      problems.push(`Duplicate research_publications.slug: "${row.slug}".`);
    }
    seenSlugs.add(row.slug);

    let content;
    try {
      content = JSON.parse(row.content_json);
    } catch {
      problems.push(`Publication "${row.id}" (${row.slug}) has unparseable content_json.`);
      continue;
    }

    if (!Array.isArray(content.keyFindings) || content.keyFindings.length === 0) {
      problems.push(`Publication "${row.id}" (${row.slug}) has no key findings.`);
    } else {
      for (const finding of content.keyFindings) {
        if (typeof finding.numerator !== "number" || typeof finding.denominator !== "number") {
          problems.push(
            `Publication "${row.id}" (${row.slug}) has a finding with a non-numeric numerator/denominator.`,
          );
          continue;
        }
        if (finding.numerator > finding.denominator) {
          problems.push(
            `Publication "${row.id}" (${row.slug}) has a finding where numerator (${finding.numerator}) exceeds denominator (${finding.denominator}).`,
          );
        }
        if (finding.numerator < 0 || finding.denominator < 0) {
          problems.push(
            `Publication "${row.id}" (${row.slug}) has a negative numerator/denominator.`,
          );
        }
      }
    }

    if (!Array.isArray(content.limitations) || content.limitations.length === 0) {
      problems.push(`Publication "${row.id}" (${row.slug}) has no limitations section.`);
    }
    if (!content.methodologyVersion) {
      problems.push(`Publication "${row.id}" (${row.slug}) has no methodology version.`);
    }
    if (!content.registryVersionId) {
      problems.push(`Publication "${row.id}" (${row.slug}) has no pinned registry version.`);
    }

    const scanText = [
      content.title,
      content.summary,
      ...(content.keyFindings ?? []).map((f) => f.label),
      ...(content.sections ?? []).map((s) => s.body),
    ].join("\n");
    for (const pattern of BANNED_CLAIM_PATTERNS) {
      if (pattern.test(scanText)) {
        problems.push(
          `Publication "${row.id}" (${row.slug}) contains unsupported-claim language matching ${pattern}.`,
        );
      }
    }
  }

  if (problems.length > 0) {
    console.error(`research-tools validate: found ${problems.length} issue(s):\n`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exitCode = 1;
    return;
  }
  console.log(`research-tools validate: no issues found (${rows.length} publication(s) checked).`);
}

// A published/corrected publication's stored checksum must match a fresh
// recomputation from its own (frozen) content_json — a mismatch would mean
// the "immutable once published" guarantee has silently broken.
function integrityVerify() {
  const rows = query(
    "SELECT id, slug, status, content_json, checksum FROM research_publications WHERE status IN ('published', 'corrected', 'withdrawn');",
  );
  if (rows.length === 0) {
    console.log("research-tools integrity:verify: no published publications to check.");
    return;
  }
  const mismatches = [];
  for (const row of rows) {
    let content;
    try {
      content = JSON.parse(row.content_json);
    } catch {
      mismatches.push(`Publication "${row.id}" (${row.slug}): unparseable content_json.`);
      continue;
    }
    const computed = computeChecksum(content);
    if (computed !== row.checksum) {
      mismatches.push(
        `Publication "${row.id}" (${row.slug}, status=${row.status}): stored=${row.checksum} computed=${computed}`,
      );
    }
  }
  if (mismatches.length > 0) {
    console.error(`research-tools integrity:verify: ${mismatches.length} mismatch(es):\n`);
    for (const m of mismatches) console.error(`  - ${m}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `research-tools integrity:verify: all ${rows.length} published publication(s) matched their stored checksum.`,
  );
}

const [command] = process.argv.slice(2);

switch (command) {
  case "validate":
    validate();
    break;
  case "integrity:verify":
    integrityVerify();
    break;
  default:
    console.error("Usage: node scripts/research-tools.mjs <validate|integrity:verify>");
    process.exitCode = 1;
}
