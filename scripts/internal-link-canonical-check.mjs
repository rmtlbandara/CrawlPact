#!/usr/bin/env node
// Sitewide internal-link canonicalization check (Phase 20 contract: trailing slash for every
// indexable page except "/"). scripts/content-validate.mjs already checks Markdown content
// collections for this; this script covers the rest of the source tree (.astro/.tsx/.ts under
// apps/web/src) — found live: several .astro pages linked to "/methodology#corrections" and
// "/methodology#registry-verification" / "/pricing#agency" (a hash-fragment suffix after a bare
// canonical page name), which content-validate.mjs's own regex never matched because it expected
// the link to end exactly at the page name, not continue into a "#fragment" or "?query" suffix.
// Harmless in practice (public/_redirects 301s the bare form), but exactly the noncanonical
// internal-link pattern Phase 20 prohibits reintroducing.

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const SRC_ROOT = path.join(REPO_ROOT, "apps/web/src");

const CANONICAL_BARE_PAGES = [
  "about",
  "contact",
  "audit",
  "sample-report",
  "crawlers",
  "tools",
  "tools/ai-crawler-checker",
  "tools/robots-txt-ai-validator",
  "tools/rsl-validator",
  "tools/llms-txt-validator",
  "tools/content-signals-checker",
  "guides",
  "platforms",
  "methodology",
  "scoring",
  "observatory/methodology",
  "security",
  "privacy",
  "terms",
  "acceptable-use",
  "limitations",
  "pricing",
  "status",
  "changelog",
  "scanner",
  "observatory",
  "observatory/registry",
];

// `href={` before the quote/backtick handles JSX expression containers
// (`href={\`/pricing#${id}\`}`) — found live: the original pattern required the quote to follow
// `href=` immediately, which matches a plain string attribute (`href="/x"`) but not a JSX
// template-literal expression, missing two real `href={\`/pricing#${id}\`}`-shaped bugs.
const barePagePattern = new RegExp(
  `(?:href|to)=\\{?["'\`]/(?:${CANONICAL_BARE_PAGES.map((p) => p.replace(/\//g, "\\/")).join("|")})(["'\`#?])`,
);
const bareCollectionPattern =
  /(?:href|to)=\{?["'`]\/(?:crawlers|guides|platforms)\/[a-z0-9-]+(["'`#?])/;

function walk(dir, files) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "node_modules") continue;
      walk(full, files);
    } else if (/\.(astro|tsx|ts)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

const files = walk(SRC_ROOT, []);
const errors = [];

for (const file of files) {
  const text = readFileSync(file, "utf8");
  const relative = path.relative(REPO_ROOT, file);
  if (barePagePattern.test(text)) {
    errors.push(
      `${relative}: contains a link to a canonical page missing its trailing slash (e.g. "/methodology#corrections" instead of "/methodology/#corrections")`,
    );
  }
  if (bareCollectionPattern.test(text)) {
    errors.push(
      `${relative}: contains a link to a crawler/guide/platform page missing its trailing slash`,
    );
  }
}

if (errors.length > 0) {
  console.error(`\n${errors.length} error(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  console.error("\ninternal-link-canonical-check: FAILED");
  process.exit(1);
}

console.log(`internal-link-canonical-check: PASSED (${files.length} files scanned)`);
