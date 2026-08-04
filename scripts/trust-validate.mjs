#!/usr/bin/env node
// Read-only legal/trust/contact validator (Phase 3). No network access — checks current public
// source files for contact/operator/jurisdiction consistency, prohibited identity fields,
// placeholders, and required routes/files.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");

const SCAN_DIRS = ["apps/web/src", "docs/trust", "docs/privacy", "docs/security", "SECURITY.md"];

const EXCLUDE_PATTERNS = [
  /\/node_modules\//,
  /\/dist\//,
  /\/\.astro\//,
  /docs\/archive\//,
  /\/test-results\//,
  /\/playwright-report\//,
];

const SCAN_EXTENSIONS = [".astro", ".ts", ".tsx", ".md", ".json", ".mjs"];

// Small, reviewed allowlist — keep narrow.
const ALLOWLIST = [
  {
    file: "apps/web/src/lib/trust-config.ts",
    pattern: "prohibited-identity",
    reason:
      "Defines the typed fields themselves (e.g. the string 'registeredAddress') and documents why they are null — not a published value.",
  },
  {
    file: "docs/release/LEGAL_INFORMATION_CHECKLIST.md",
    pattern: "prohibited-identity",
    reason:
      "Tracks which identity fields are still deliberately unresolved — not a published value.",
  },
  {
    file: "docs/trust/TRUST_AND_LEGAL_CONFIGURATION.md",
    pattern: "prohibited-identity",
    reason: "Records which identity fields are intentionally omitted — not a published value.",
  },
  {
    file: "docs/trust/LEGAL_AND_TRUST_SURFACE_INVENTORY.md",
    pattern: "prohibited-identity",
    reason: "Inventories which fields are absent/blocked — not a published value.",
  },
  {
    file: "apps/web/src/lib/trust-config.test.ts",
    pattern: "placeholder",
    reason:
      "Asserts these placeholder strings are NOT present in TRUST_CONFIG — a negative test, not a published placeholder.",
  },
  {
    file: "apps/web/src/lib/trust-config.test.ts",
    pattern: "country-reference",
    reason:
      "Asserts the string is NOT present in TRUST_CONFIG (negative regex assertion) — not a published value.",
  },
  {
    file: "docs/trust/TRUST_AND_LEGAL_CONFIGURATION.md",
    pattern: "country-reference",
    reason:
      "Historical record of the previously product-owner-approved jurisdiction and why/when it was removed — internal governance history, not public content (2026-08-04 Public Country Reference and Contact Messaging Correction).",
  },
];

function isAllowlisted(rel, patternName) {
  return ALLOWLIST.some((entry) => rel.endsWith(entry.file) && entry.pattern === patternName);
}

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

const APPROVED_CONTACTS = ["info@crawlpact.com", "support@crawlpact.com"];
const APPROVED_OPERATOR = "CrawlPact";

// Public Country Reference and Contact Messaging Correction (2026-08-04): no operating country
// or jurisdiction is published anywhere on the public site — see
// docs/trust/TRUST_AND_LEGAL_CONFIGURATION.md. These patterns catch the removed country and the
// negative support-channel wording it was paired with, wherever either might return.
const PROHIBITED_COUNTRY_PATTERNS = [{ name: "Sri Lanka reference", pattern: /sri\s*lanka/i }];

const PROHIBITED_SUPPORT_WORDING_PATTERNS = [
  { name: "no live chat", pattern: /no live chat/i },
  { name: "no phone support", pattern: /no phone support/i },
  { name: "no guaranteed response time", pattern: /no guaranteed response time/i },
  { name: "email-only support", pattern: /email-only support/i },
];

const UNSUPPORTED_SUFFIXES = [
  /CrawlPact[ \t]*\(Pvt\)[ \t]*Ltd\b\.?/i,
  /CrawlPact[ \t]+Pvt\.?[ \t]*Ltd\b\.?/i,
  /CrawlPact[ \t]+Private[ \t]+Limited\b/i,
  /CrawlPact,?[ \t]+LLC\b/i,
  /CrawlPact,?[ \t]+Inc\b\.?/i,
  /CrawlPact[ \t]+Ltd\b\.?/i,
  /CrawlPact[ \t]+Corporation\b/i,
];

const PROHIBITED_IDENTITY_PATTERNS = [
  {
    name: "registered address",
    pattern: /\bregistered\s+(business\s+)?address\b\s*[:=]\s*["'][^"']+["']/i,
  },
  {
    name: "registration number value",
    pattern: /\bregistration\s+number\b\s*[:=]\s*["'][^"']+["']/i,
  },
  { name: "VAT/tax number value", pattern: /\b(VAT|TIN|GST)\s+number\b\s*[:=]\s*["'][^"']+["']/i },
];

const PLACEHOLDER_PATTERNS = [
  /\[Company Name\]/i,
  /\[Address\]/i,
  /\[Registration Number\]/i,
  /\[Jurisdiction\]/i,
  /TODO\s*legal/i,
  /example@example\.com/i,
  /support@example\.com/i,
  /privacy@example\.com/i,
];

const REQUIRED_ROUTE_FILES = [
  "apps/web/src/pages/privacy.astro",
  "apps/web/src/pages/terms.astro",
  "apps/web/src/pages/contact.astro",
  "apps/web/src/pages/security.astro",
  "apps/web/src/pages/about.astro",
  "apps/web/src/pages/status.astro",
];

function main() {
  const errors = [];
  const warnings = [];

  // Required routes exist.
  for (const rel of REQUIRED_ROUTE_FILES) {
    if (!existsSync(path.join(REPO_ROOT, rel))) {
      errors.push(`Missing required trust route file: ${rel}`);
    }
  }

  // Contact page communicates the approved positive 24-hour response commitment.
  const contactPath = "apps/web/src/pages/contact.astro";
  if (existsSync(path.join(REPO_ROOT, contactPath))) {
    const content = readFileSync(path.join(REPO_ROOT, contactPath), "utf8");
    if (!/respond to enquiries within 24 hours/i.test(content)) {
      errors.push(
        `${contactPath}: missing the approved 24-hour response commitment ("we respond to enquiries within 24 hours" or equivalent)`,
      );
    }
  }

  // security.txt exists and has required fields.
  const securityTxtPath = "apps/web/src/pages/.well-known/security.txt.ts";
  if (!existsSync(path.join(REPO_ROOT, securityTxtPath))) {
    errors.push(`Missing ${securityTxtPath}`);
  } else {
    const content = readFileSync(path.join(REPO_ROOT, securityTxtPath), "utf8");
    for (const field of ["Contact:", "Canonical:", "Policy:", "Preferred-Languages:", "Expires:"]) {
      if (!content.includes(field)) {
        errors.push(`${securityTxtPath} is missing required security.txt field: ${field}`);
      }
    }
  }

  // Footer has required trust links.
  const footerPath = "apps/web/src/components/SiteFooter.astro";
  if (existsSync(path.join(REPO_ROOT, footerPath))) {
    const content = readFileSync(path.join(REPO_ROOT, footerPath), "utf8");
    for (const href of ["/about", "/contact", "/privacy", "/terms", "/security", "/status"]) {
      if (!content.includes(`href: "${href}"`)) {
        errors.push(`${footerPath} is missing required footer link: ${href}`);
      }
    }
  } else {
    errors.push(`Missing ${footerPath}`);
  }

  // trust-config.ts has the approved values, and does not have address/registration/tax set.
  const trustConfigPath = "apps/web/src/lib/trust-config.ts";
  if (!existsSync(path.join(REPO_ROOT, trustConfigPath))) {
    errors.push(`Missing ${trustConfigPath}`);
  } else {
    const content = readFileSync(path.join(REPO_ROOT, trustConfigPath), "utf8");
    if (!content.includes(`legalEntityName: "${APPROVED_OPERATOR}"`)) {
      errors.push(`${trustConfigPath}: legalEntityName is not exactly "${APPROVED_OPERATOR}"`);
    }
    if (/governingJurisdiction\s*:/.test(content)) {
      errors.push(
        `${trustConfigPath}: must not publish a governingJurisdiction field — no operating country or jurisdiction is approved for public display (2026-08-04 correction)`,
      );
    }
    if (!/registeredAddress:\s*null/.test(content)) {
      errors.push(
        `${trustConfigPath}: registeredAddress must remain null (not approved for publication)`,
      );
    }
    if (!/registrationNumber:\s*null/.test(content)) {
      errors.push(
        `${trustConfigPath}: registrationNumber must remain null (not approved for publication)`,
      );
    }
  }

  const allFiles = SCAN_DIRS.flatMap((d) => listFiles(d));

  for (const rel of allFiles) {
    const content = readFileSync(path.join(REPO_ROOT, rel), "utf8");

    // Operator consistency: unsupported corporate suffixes.
    for (const suffixPattern of UNSUPPORTED_SUFFIXES) {
      if (suffixPattern.test(content)) {
        errors.push(`${rel}: possible unsupported corporate suffix (matches ${suffixPattern})`);
      }
    }

    // Prohibited identity fields (actual published values, not the schema/tracking docs).
    for (const { name, pattern } of PROHIBITED_IDENTITY_PATTERNS) {
      if (pattern.test(content) && !isAllowlisted(rel, "prohibited-identity")) {
        errors.push(`${rel}: possible prohibited identity field published (${name})`);
      }
    }

    // Placeholders.
    for (const pattern of PLACEHOLDER_PATTERNS) {
      if (pattern.test(content) && !isAllowlisted(rel, "placeholder")) {
        errors.push(`${rel}: contains a placeholder pattern (${pattern})`);
      }
    }

    // No operating country/jurisdiction anywhere on the public site (2026-08-04 correction) —
    // narrow, reviewed allowlist only for internal governance history.
    for (const { name, pattern } of PROHIBITED_COUNTRY_PATTERNS) {
      if (pattern.test(content) && !isAllowlisted(rel, "country-reference")) {
        errors.push(`${rel}: contains a prohibited country/jurisdiction reference (${name})`);
      }
    }

    // No wording emphasising unavailable support channels (same correction).
    for (const { name, pattern } of PROHIBITED_SUPPORT_WORDING_PATTERNS) {
      if (pattern.test(content) && !isAllowlisted(rel, "negative-support-wording")) {
        errors.push(`${rel}: contains prohibited negative support wording (${name})`);
      }
    }

    // Contact addresses used, if any email-shaped string appears, must be one of the approved two
    // (excluding this validator's own allowlist/config files, which legitimately discuss the concept).
    const emailMatches = content.match(/\b[\w.+-]+@crawlpact\.com\b/gi) ?? [];
    for (const email of emailMatches) {
      if (!APPROVED_CONTACTS.includes(email.toLowerCase())) {
        errors.push(`${rel}: uses a non-approved @crawlpact.com address (${email})`);
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
    console.error("\ntrust:validate: FAILED");
    process.exit(1);
  }

  console.log(`trust:validate: PASSED (${allFiles.length} files scanned)`);
}

main();
