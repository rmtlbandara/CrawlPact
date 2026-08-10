#!/usr/bin/env node
// Repository privacy validator (Phase 13, docs/governance/REPOSITORY_CONFIDENTIALITY_POLICY.md).
// Read-only, no network access. Checks that CrawlPact's private/proprietary repository posture
// hasn't regressed: no accidentally-publishable workspace packages, no public-repository/
// open-source claims in customer-facing copy, no public links to inaccessible internal GitHub
// documentation, no production source maps under public assets, no server secret exposed via a
// PUBLIC_* env var name.
//
// Semantic, not a blind search/replace — the word "public" is never itself prohibited (see
// docs/governance/PUBLIC_PRIVATE_INFORMATION_CLASSIFICATION.md Class A). Only phrases that
// incorrectly describe repository/source availability are flagged.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const errors = [];
const warnings = [];

// --- 1. Workspace packages must all be private, with no publish config ---

const WORKSPACE_PACKAGE_JSONS = [
  "package.json",
  "apps/web/package.json",
  "apps/e2e-fixture/package.json",
  "packages/core/package.json",
  "packages/database/package.json",
  "packages/scanner/package.json",
  "packages/policy/package.json",
  "packages/registry/package.json",
  "packages/robots/package.json",
  "packages/ui/package.json",
  "packages/config/package.json",
];

for (const rel of WORKSPACE_PACKAGE_JSONS) {
  const full = path.join(REPO_ROOT, rel);
  if (!existsSync(full)) {
    errors.push(`Expected workspace package.json not found: ${rel}`);
    continue;
  }
  const pkg = JSON.parse(readFileSync(full, "utf8"));
  if (pkg.private !== true) {
    errors.push(`${rel}: missing "private": true — this package could be accidentally published.`);
  }
  if (pkg.publishConfig) {
    errors.push(`${rel}: has a "publishConfig" field — remove it unless publishing is deliberate.`);
  }
}

// --- 2. No accidental publish-config/publish-script strings anywhere ---

const PUBLISH_PATTERNS = [
  /publishConfig/,
  /\bnpm publish\b/,
  /\bpnpm publish\b/,
  /access:\s*["']?public["']?/,
];
const SCAN_DIRS_FOR_PUBLISH = ["apps", "packages", "scripts", ".github"];
const EXCLUDE = [
  /\/node_modules\//,
  /\/dist\//,
  /\/\.astro\//,
  /\/test-results\//,
  /\/playwright-report\//,
];

function walk(dir, extensions) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (EXCLUDE.some((re) => re.test(full))) continue;
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walk(full, extensions));
    } else if (extensions.some((ext) => full.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

const publishScanFiles = SCAN_DIRS_FOR_PUBLISH.flatMap((d) =>
  walk(path.join(REPO_ROOT, d), [".json", ".yml", ".yaml", ".mjs", ".ts"]),
).filter((f) => !f.endsWith("repo-privacy-validate.mjs") && !f.endsWith("analytics-validate.mjs"));
for (const file of publishScanFiles) {
  const content = readFileSync(file, "utf8");
  for (const pattern of PUBLISH_PATTERNS) {
    if (pattern.test(content)) {
      const rel = path.relative(REPO_ROOT, file);
      // package.json files were already exhaustively checked above with full context;
      // avoid double-reporting the same "private": true files unless they genuinely
      // contain a publish string (already covered by the loop above for known packages).
      if (!rel.endsWith("package.json") && !rel.endsWith(".github/dependabot.yml")) {
        warnings.push(
          `${rel}: contains a string matching "${pattern}" — verify this isn't accidental publish config.`,
        );
      }
    }
  }
}

// --- 3. No public-repository/open-source claims in customer-facing copy (semantic) ---

const PROHIBITED_REPO_PHRASES = [
  /public repository/i,
  /public github repository/i,
  /open-source crawlpact/i,
  /crawlpact is open source/i,
  /view the source on github/i,
  /public source code/i,
  /public implementation documentation/i,
  /star this repository/i,
];

const CUSTOMER_FACING_DIRS = [
  "apps/web/src/pages",
  "apps/web/src/components",
  "apps/web/src/layouts",
];
const customerFacingFiles = CUSTOMER_FACING_DIRS.flatMap((d) =>
  walk(path.join(REPO_ROOT, d), [".astro", ".tsx", ".ts"]),
);

for (const file of customerFacingFiles) {
  const content = readFileSync(file, "utf8");
  for (const pattern of PROHIBITED_REPO_PHRASES) {
    if (pattern.test(content)) {
      errors.push(
        `${path.relative(REPO_ROOT, file)}: contains a phrase matching ${pattern} — this repository is private; remove or correct this claim.`,
      );
    }
  }
  // A public page must never point a customer at "public documentation" for something
  // that only exists inside this private repo — see the Phase 13 finding this check
  // encodes (apps/web/src/pages/privacy.astro was found doing exactly this).
  if (/see (the )?project'?s? public documentation/i.test(content)) {
    errors.push(
      `${path.relative(REPO_ROOT, file)}: references "public documentation" for something that may only exist in this private repository — verify the referenced content is actually publicly reachable, or reword.`,
    );
  }
}

// --- 4. No internal docs copied into apps/web/public/ static assets ---

const PUBLIC_ASSETS_DIR = path.join(REPO_ROOT, "apps/web/public");
if (existsSync(PUBLIC_ASSETS_DIR)) {
  const publicFiles = walk(PUBLIC_ASSETS_DIR, [".md"]);
  for (const file of publicFiles) {
    errors.push(
      `${path.relative(REPO_ROOT, file)}: a Markdown file exists under apps/web/public/ — internal documentation must never be copied into browser-accessible static assets.`,
    );
  }
}

// --- 5. No production source maps under the built public client output ---

const CLIENT_DIST = path.join(REPO_ROOT, "apps/web/dist/client");
if (existsSync(CLIENT_DIST)) {
  const mapFiles = walk(CLIENT_DIST, [".map"]);
  for (const file of mapFiles) {
    errors.push(
      `${path.relative(REPO_ROOT, file)}: a source map is present in the publicly-served build output — see docs/security/PRODUCTION_SOURCE_MAP_POLICY.md.`,
    );
  }
  const jsFiles = walk(CLIENT_DIST, [".js"]);
  for (const file of jsFiles) {
    const content = readFileSync(file, "utf8");
    if (content.includes("sourceMappingURL")) {
      errors.push(`${path.relative(REPO_ROOT, file)}: contains a sourceMappingURL comment.`);
    }
  }
} else {
  warnings.push("apps/web/dist/client not found — run `pnpm build` first to check source maps.");
}

// --- 6. No server secret exposed via a PUBLIC_* env var name ---

const envDtsPath = path.join(REPO_ROOT, "apps/web/src/env.d.ts");
if (existsSync(envDtsPath)) {
  const content = readFileSync(envDtsPath, "utf8");
  const publicVarMatches = [...content.matchAll(/PUBLIC_([A-Z0-9_]+):/g)];
  const KNOWN_SAFE_PUBLIC_VARS = new Set([
    "APP_ENV",
    "SITE_URL",
    "PADDLE_CLIENT_TOKEN", // deliberately public — see docs/analytics/GOOGLE_ANALYTICS_SCOPE_POLICY.md
  ]);
  for (const match of publicVarMatches) {
    const name = match[1];
    if (!KNOWN_SAFE_PUBLIC_VARS.has(name)) {
      warnings.push(
        `apps/web/src/env.d.ts: PUBLIC_${name} is not in the known-safe allowlist — verify it isn't a secret exposed to the client.`,
      );
    }
  }
}

// --- Report ---

if (warnings.length > 0) {
  console.warn(`\n${warnings.length} warning(s):`);
  for (const w of warnings) console.warn(`  - ${w}`);
}
if (errors.length > 0) {
  console.error(`\n${errors.length} error(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  console.error("\nrepo-privacy:validate: FAILED");
  process.exit(1);
}

console.log(
  `repo-privacy:validate: PASSED (${WORKSPACE_PACKAGE_JSONS.length} packages, ${customerFacingFiles.length} customer-facing files, ${publishScanFiles.length} config/script files checked)`,
);
