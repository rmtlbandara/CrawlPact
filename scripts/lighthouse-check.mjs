#!/usr/bin/env node
// Lighthouse lab-measurement gate, run against the real deployed preview
// Worker after every deploy (see .github/workflows/deploy-preview.yml).
// Lab measurements only — not a substitute for field Core Web Vitals
// (see docs/design/EVIDENCE_OBSERVATORY_REDESIGN_SPEC.md §12/§15).
//
// Usage: node scripts/lighthouse-check.mjs <base-url>
//
// Phase 11 (Stage 11G) hardening: runs each page RUNS_PER_PAGE times and
// gates on the *median*, not a single run. This is a direct response to a
// real finding from this phase's own manual measurement session
// (docs/performance/PHASE_11_PAGE_PERFORMANCE_RESULTS.md): a single
// Lighthouse run can look dramatically better or worse than reality purely
// from test-machine/network variance (one run scored a page 99, an
// adjacent run on the same unchanged page scored it 71) — gating CI on one
// run risks both false failures (blocking a good deploy on noise) and
// false passes (a real regression landing on a lucky run). The median
// across 3 runs is far more resistant to either failure mode. Every run's
// full report is written to LIGHTHOUSE_ARTIFACT_DIR (or a temp dir) as a
// JSON artifact the CI workflow uploads, so a failure — or a suspicious
// pass — can be inspected after the fact instead of only ever seeing the
// console.table summary.

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const baseUrl = process.argv[2];
if (!baseUrl) {
  console.error("Usage: node scripts/lighthouse-check.mjs <base-url>");
  process.exit(2);
}

// One representative page per distinct template archetype — matches the set this project's a11y
// suite already treats as representative. /for/agencies and /platforms/cloudflare added Phase 7
// (Vertical Landing Pages and Platform SEO Architecture) — the first SSR content-collection
// template and the first platform-guide template. /sample-report added Phase 11 (Stage 11G) — the
// one prerendered template archetype (the free-tool report preview) that had no representative
// page in this list before, despite being a primary conversion surface (SRS §30, Phase 4).
const PAGES = [
  "/",
  "/pricing",
  "/sample-report",
  "/crawlers/amazonbot",
  "/for/agencies",
  "/platforms/cloudflare",
];

const RUNS_PER_PAGE = 3;

// Thresholds intentionally below this session's actual measured scores
// (94-99 performance, 100 accessibility, ~1.6-2.9s LCP against real
// production — see PHASE_11_PAGE_PERFORMANCE_RESULTS.md) to leave headroom
// for real network variance against the live preview Worker, while still
// catching a genuine regression.
const THRESHOLDS = {
  performance: 85,
  accessibility: 95,
  "best-practices": 85,
  seo: 90,
  lcpMs: 3000,
  cls: 0.1,
};

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function runLighthouseOnce(url) {
  const outDir = mkdtempSync(join(tmpdir(), "lighthouse-"));
  const outFile = join(outDir, "report.json");
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
  const report = JSON.parse(readFileSync(outFile, "utf-8"));
  rmSync(outDir, { recursive: true, force: true });

  return {
    performance: Math.round(report.categories.performance.score * 100),
    accessibility: Math.round(report.categories.accessibility.score * 100),
    "best-practices": Math.round(report.categories["best-practices"].score * 100),
    seo: Math.round(report.categories.seo.score * 100),
    lcpMs: report.audits["largest-contentful-paint"]?.numericValue ?? null,
    cls: report.audits["cumulative-layout-shift"]?.numericValue ?? null,
  };
}

const artifactDir =
  process.env.LIGHTHOUSE_ARTIFACT_DIR ?? mkdtempSync(join(tmpdir(), "lh-artifact-"));
mkdirSync(artifactDir, { recursive: true });

let failed = false;
const rows = [];
const artifact = { baseUrl, runsPerPage: RUNS_PER_PAGE, thresholds: THRESHOLDS, pages: [] };

for (const path of PAGES) {
  const url = new URL(path, baseUrl).toString();
  const runs = [];
  for (let i = 0; i < RUNS_PER_PAGE; i++) {
    try {
      runs.push(runLighthouseOnce(url));
    } catch (err) {
      console.error(`Lighthouse failed to run against ${url} (run ${i + 1}): ${err.message}`);
      failed = true;
    }
  }

  if (runs.length === 0) {
    artifact.pages.push({ path, runs: [], median: null });
    continue;
  }

  const medianResult = {
    performance: median(runs.map((r) => r.performance)),
    accessibility: median(runs.map((r) => r.accessibility)),
    "best-practices": median(runs.map((r) => r["best-practices"])),
    seo: median(runs.map((r) => r.seo)),
    lcpMs: median(runs.map((r) => r.lcpMs).filter((v) => v !== null)),
    cls: median(runs.map((r) => r.cls).filter((v) => v !== null)),
  };
  artifact.pages.push({ path, runs, median: medianResult });
  rows.push({ path, runs: runs.length, ...medianResult });

  for (const [key, threshold] of Object.entries({
    performance: THRESHOLDS.performance,
    accessibility: THRESHOLDS.accessibility,
    "best-practices": THRESHOLDS["best-practices"],
    seo: THRESHOLDS.seo,
  })) {
    if (medianResult[key] < threshold) {
      console.error(
        `FAIL ${path}: median ${key} score ${medianResult[key]} (of ${runs.length} runs) is below threshold ${threshold}`,
      );
      failed = true;
    }
  }
  if (medianResult.lcpMs !== null && medianResult.lcpMs > THRESHOLDS.lcpMs) {
    console.error(
      `FAIL ${path}: median LCP ${Math.round(medianResult.lcpMs)}ms (of ${runs.length} runs) exceeds threshold ${THRESHOLDS.lcpMs}ms`,
    );
    failed = true;
  }
  if (medianResult.cls !== null && medianResult.cls > THRESHOLDS.cls) {
    console.error(
      `FAIL ${path}: median CLS ${medianResult.cls} (of ${runs.length} runs) exceeds threshold ${THRESHOLDS.cls}`,
    );
    failed = true;
  }
}

console.table(rows);

const artifactPath = join(artifactDir, "lighthouse-results.json");
writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
console.log(`Full results (all runs, not just medians) written to ${artifactPath}`);

if (failed) {
  console.error("Lighthouse check failed — see FAIL lines above.");
  process.exit(1);
}
console.log("Lighthouse check passed for all pages (median of " + RUNS_PER_PAGE + " runs each).");
