#!/usr/bin/env node
// Read-only brand/messaging validator (Phase 2). No production/runtime import path, no network
// access — only checks current public/product-facing source files for prohibited claims, the
// stale tagline, product-naming inconsistencies, and canonical-value presence.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");

// Directories to scan for current, live copy. Deliberately excludes docs/archive/ (historical,
// expected to contain superseded wording), node_modules, dist/build output, and test fixtures
// that intentionally exercise prohibited-claim detection.
const SCAN_DIRS = ["apps/web/src", "packages", "docs/brand", "docs/product", "README.md"];

const EXCLUDE_PATTERNS = [
  /\/node_modules\//,
  /\/dist\//,
  /\/\.astro\//,
  /docs\/archive\//,
  /\/test-results\//,
  /\/playwright-report\//,
];

const SCAN_EXTENSIONS = [".astro", ".ts", ".tsx", ".md", ".json", ".mjs"];

// Small, reviewed allowlist: [filePathSuffix, phrase-or-pattern-name, reason, owner, reviewDate].
// Keep narrow — do not use this to broadly suppress real findings.
const ALLOWLIST = [
  {
    file: "docs/product/CRAWLPACT_FINAL_SRS.md",
    pattern: "stale-tagline",
    reason:
      "The SRS's own §2.3 states this as its canonical tagline — a real, tracked documentation conflict with the new Phase 2 brand system, not a live-copy violation. See docs/reports/PHASE_02_BRAND_POSITIONING_MESSAGING_COMPLETION_REPORT.md.",
    owner: "Product owner",
    reviewDate: "2026-09-01",
  },
  {
    file: "docs/brand/BRAND_POSITIONING_AND_MESSAGING_SYSTEM.md",
    pattern: "stale-tagline",
    reason:
      "Quoted deliberately as the OLD wording being replaced, in the same sentence that corrects it.",
    owner: "Product owner",
    reviewDate: "2026-09-01",
  },
  {
    file: "docs/brand/MESSAGING_SURFACE_INVENTORY.md",
    pattern: "stale-tagline",
    reason:
      "Quotes the SRS's own stale tagline while describing the SRS-vs-brand-system documentation conflict (row E1) — not live copy.",
    owner: "Product owner",
    reviewDate: "2026-09-01",
  },
  {
    file: "docs/brand/MESSAGING_SURFACE_INVENTORY.md",
    pattern: "naming",
    reason:
      'Quotes the SRS\'s own "Crawl Pact" (two words) avoid-example while describing it (row E2) — not a live naming mistake.',
    owner: "Product owner",
    reviewDate: "2026-09-01",
  },
  {
    file: "docs/brand/CLAIMS_AND_MESSAGING_GUIDE.md",
    pattern: "prohibited-claims-list",
    reason:
      "This document's entire purpose is listing the prohibited claims verbatim so they can be recognised and avoided.",
    owner: "Product owner",
    reviewDate: "2026-09-01",
  },
  {
    file: "docs/brand/VOICE_AND_STYLE_GUIDE.md",
    pattern: "prohibited-claims-list",
    reason: "Quotes prohibited/discouraged phrasing as negative examples ('Avoid: ...').",
    owner: "Product owner",
    reviewDate: "2026-09-01",
  },
  {
    file: "scripts/brand-validate.mjs",
    pattern: "prohibited-claims-list",
    reason: "This validator's own pattern definitions necessarily contain the prohibited phrases.",
    owner: "Engineering owner",
    reviewDate: "2026-09-01",
  },
  {
    file: "apps/web/src/config/brand.test.ts",
    pattern: "stale-tagline",
    reason:
      "Asserts the stale tagline is NOT present in BRAND — the phrase appears only inside a negative assertion string, not as live copy.",
    owner: "Engineering owner",
    reviewDate: "2026-09-01",
  },
  {
    file: "apps/web/src/config/brand.test.ts",
    pattern: "prohibited-claims-list",
    reason:
      "Asserts these prohibited phrases are NOT present in BRAND — a negative test, not live copy.",
    owner: "Engineering owner",
    reviewDate: "2026-09-01",
  },
  {
    file: "docs/product/CRAWLPACT_FINAL_SRS.md",
    pattern: "prohibited-claims-list",
    reason:
      'SRS §branding-requirements quotes these verbatim as examples of claims the product must never make (e.g. "Stop all AI scraping", "Complete AI compliance", "Guarantee AI visibility") — not live copy.',
    owner: "Product owner",
    reviewDate: "2026-09-01",
  },
  {
    file: "apps/web/src/pages/terms.astro",
    pattern: "prohibited-claims-list",
    reason:
      'Phase 3 product-boundaries section states these as honest negations ("is not a legal compliance certification", "does not replace a WAF, CDN, or bot-management service") — not a claim the product makes.',
    owner: "Product owner",
    reviewDate: "2026-09-01",
  },
  {
    file: "docs/product/CRAWLPACT_FINAL_SRS.md",
    pattern: "naming",
    reason:
      'SRS §39 Branding Requirements lists "Crawl Pact" (two words) verbatim as an explicit example of what to avoid — not a live naming mistake.',
    owner: "Product owner",
    reviewDate: "2026-09-01",
  },
  {
    file: "docs/product/PRODUCT_SCOPE.md",
    pattern: "prohibited-claims-list",
    reason:
      'Lists the same prohibited phrases verbatim as explicitly out-of-scope claims, and separately lists "Legal compliance certification" as an explicit non-goal — not live copy.',
    owner: "Product owner",
    reviewDate: "2026-09-01",
  },
];

const STALE_TAGLINE = /know what ai crawlers can access/i;

const PROHIBITED_PHRASES = [
  /stops? all ai scraping/i,
  /makes? crawlers obey/i,
  /guarantees? ai visibility/i,
  /guarantees? search inclusion/i,
  /guarantees? training exclusion/i,
  /protects? all website content/i,
  /proves? what every crawler accessed/i,
  /legal compliance certification/i,
  /complete ai compliance/i,
  /replaces? a waf,? cdn,? or bot-management/i,
  /monitors? actual traffic without log access/i,
  /supports? every crawler\b/i,
  /supports? every hosting provider perfectly/i,
  /universal measure of good or bad policy/i,
  /every website should block training crawlers/i,
  /every website should allow search crawlers/i,
  /llms\.txt is universally adopted or required/i,
  /robots\.txt guarantees crawler compliance/i,
];

const UNSUPPORTED_PROOF_PHRASES = [
  /trusted by thousands/i,
  /industry-leading/i,
  /\bbest in class\b/i,
  /\bnumber one\b/i,
  /\bguaranteed\b/i,
  /complete protection/i,
  /fully compliant/i,
  /100% compliant/i,
];

const NAMING_PATTERNS = [
  { name: "Crawl Pact (two words)", pattern: /\bCrawl Pact\b/ },
  { name: "ClawPact typo", pattern: /\bClawPact\b/ },
  { name: "CRAWLPACT wrong caps in prose", pattern: /\bCRAWLPACT\b(?!_)/ },
];

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

function isAllowlisted(rel, patternName) {
  return ALLOWLIST.some((entry) => rel.endsWith(entry.file) && entry.pattern === patternName);
}

function main() {
  const errors = [];
  const warnings = [];

  const allFiles = SCAN_DIRS.flatMap((d) => listFiles(d));

  for (const rel of allFiles) {
    const content = readFileSync(path.join(REPO_ROOT, rel), "utf8");

    if (STALE_TAGLINE.test(content) && !isAllowlisted(rel, "stale-tagline")) {
      errors.push(`${rel}: contains the stale tagline "Know what AI crawlers can access"`);
    }

    for (const phrase of PROHIBITED_PHRASES) {
      if (phrase.test(content) && !isAllowlisted(rel, "prohibited-claims-list")) {
        errors.push(`${rel}: contains a prohibited claim pattern (${phrase})`);
      }
    }

    for (const phrase of UNSUPPORTED_PROOF_PHRASES) {
      if (phrase.test(content) && !isAllowlisted(rel, "prohibited-claims-list")) {
        warnings.push(`${rel}: contains unsupported-proof-style language (${phrase})`);
      }
    }

    for (const { name, pattern } of NAMING_PATTERNS) {
      if (pattern.test(content) && !isAllowlisted(rel, "naming")) {
        errors.push(`${rel}: possible product-naming inconsistency (${name})`);
      }
    }
  }

  // Canonical wording presence check: the central brand config must exist and export the
  // required canonical values.
  const brandConfigPath = "apps/web/src/config/brand.ts";
  if (!existsSync(path.join(REPO_ROOT, brandConfigPath))) {
    errors.push(`Missing central brand configuration: ${brandConfigPath}`);
  } else {
    const brandConfig = readFileSync(path.join(REPO_ROOT, brandConfigPath), "utf8");
    const requiredKeys = [
      "productName",
      "tagline",
      "brandPromise",
      "publicCategory",
      "strategicCategory",
      "approvedBoundaryStatement",
      "standardReportDisclaimer",
    ];
    for (const key of requiredKeys) {
      if (!brandConfig.includes(key)) {
        errors.push(`${brandConfigPath} is missing required canonical key: ${key}`);
      }
    }
  }

  // Category consistency: public category phrase should appear somewhere in current-authoritative
  // brand/product docs.
  const positioningDoc = "docs/brand/BRAND_POSITIONING_AND_MESSAGING_SYSTEM.md";
  if (existsSync(path.join(REPO_ROOT, positioningDoc))) {
    const content = readFileSync(path.join(REPO_ROOT, positioningDoc), "utf8");
    if (!content.includes("AI crawler policy audit and monitoring")) {
      errors.push(`${positioningDoc} does not contain the approved public category phrase`);
    }
  } else {
    errors.push(`Missing ${positioningDoc}`);
  }

  if (warnings.length > 0) {
    console.warn(`\n${warnings.length} warning(s):`);
    for (const w of warnings) console.warn(`  - ${w}`);
  }
  if (errors.length > 0) {
    console.error(`\n${errors.length} error(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    console.error("\nbrand:validate: FAILED");
    process.exit(1);
  }

  console.log(
    `brand:validate: PASSED (${allFiles.length} files scanned for prohibited claims/stale tagline/naming issues)`,
  );
}

main();
