#!/usr/bin/env node
// Lighthouse lab-measurement gate, run against the real deployed preview
// Worker after every deploy (see .github/workflows/deploy-preview.yml).
// Lab measurements only — not a substitute for field Core Web Vitals
// (see docs/design/EVIDENCE_OBSERVATORY_REDESIGN_SPEC.md §12/§15).
//
// Usage: node scripts/lighthouse-check.mjs <base-url>

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const baseUrl = process.argv[2];
if (!baseUrl) {
  console.error("Usage: node scripts/lighthouse-check.mjs <base-url>");
  process.exit(2);
}

// One representative page per distinct template archetype — matches the
// set this project's a11y suite already treats as representative.
const PAGES = ["/", "/pricing", "/crawlers/amazonbot"];

// Thresholds intentionally below this session's actual measured scores
// (98-99 performance, 100 accessibility, ~2.0-2.3s LCP against a local
// build) to leave headroom for real network variance against the live
// preview Worker, while still catching a genuine regression.
const THRESHOLDS = {
  performance: 85,
  accessibility: 95,
  "best-practices": 85,
  seo: 90,
  lcpMs: 3000,
  cls: 0.1,
};

let failed = false;
const rows = [];

for (const path of PAGES) {
  const url = new URL(path, baseUrl).toString();
  const outDir = mkdtempSync(join(tmpdir(), "lighthouse-"));
  const outFile = join(outDir, "report.json");
  try {
    execFileSync(
      "npx",
      [
        "lighthouse",
        url,
        "--output=json",
        `--output-path=${outFile}`,
        "--chrome-flags=--headless=new --no-sandbox",
        "--only-categories=performance,accessibility,best-practices,seo",
        "--quiet",
      ],
      { stdio: ["ignore", "ignore", "inherit"] },
    );
  } catch (err) {
    console.error(`Lighthouse failed to run against ${url}: ${err.message}`);
    failed = true;
    continue;
  }

  const report = JSON.parse(readFileSync(outFile, "utf-8"));
  rmSync(outDir, { recursive: true, force: true });

  const scores = {
    performance: Math.round(report.categories.performance.score * 100),
    accessibility: Math.round(report.categories.accessibility.score * 100),
    "best-practices": Math.round(report.categories["best-practices"].score * 100),
    seo: Math.round(report.categories.seo.score * 100),
  };
  const lcpMs = report.audits["largest-contentful-paint"]?.numericValue ?? null;
  const cls = report.audits["cumulative-layout-shift"]?.numericValue ?? null;

  rows.push({ path, ...scores, lcpMs, cls });

  for (const [key, threshold] of Object.entries({
    performance: THRESHOLDS.performance,
    accessibility: THRESHOLDS.accessibility,
    "best-practices": THRESHOLDS["best-practices"],
    seo: THRESHOLDS.seo,
  })) {
    if (scores[key] < threshold) {
      console.error(`FAIL ${path}: ${key} score ${scores[key]} is below threshold ${threshold}`);
      failed = true;
    }
  }
  if (lcpMs !== null && lcpMs > THRESHOLDS.lcpMs) {
    console.error(
      `FAIL ${path}: LCP ${Math.round(lcpMs)}ms exceeds threshold ${THRESHOLDS.lcpMs}ms`,
    );
    failed = true;
  }
  if (cls !== null && cls > THRESHOLDS.cls) {
    console.error(`FAIL ${path}: CLS ${cls} exceeds threshold ${THRESHOLDS.cls}`);
    failed = true;
  }
}

console.table(rows);

if (failed) {
  console.error("Lighthouse check failed — see FAIL lines above.");
  process.exit(1);
}
console.log("Lighthouse check passed for all pages.");
