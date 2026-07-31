#!/usr/bin/env node
// Rasterizes scripts/og-image-sources/*.svg into apps/web/public/og/*.png.
//
// Social platforms (Facebook, X, LinkedIn, Slack, Discord, WhatsApp, iMessage)
// do not reliably render SVG for og:image/twitter:image — they expect a
// raster format (PNG/JPEG/WebP), typically 1200x630. The site previously
// served a single SVG for every page, which likely showed no preview image
// at all when shared on any of those platforms. Rather than an
// image-generation service, this uses Playwright (already a project
// dependency for e2e/a11y tests) to render each source SVG in a real browser
// at exact output dimensions and screenshot it — a deterministic, one-time
// asset build, not a runtime dependency. Re-run manually after editing a
// source SVG; the output PNGs are committed like any other static asset.
//
// Usage: node scripts/generate-og-images.mjs

import { chromium } from "@playwright/test";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const sourceDir = join(scriptDir, "og-image-sources");
const outDir = join(scriptDir, "..", "apps/web/public/og");

async function main() {
  mkdirSync(outDir, { recursive: true });
  const svgFiles = readdirSync(sourceDir).filter((f) => extname(f) === ".svg");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
    for (const file of svgFiles) {
      const svg = readFileSync(join(sourceDir, file), "utf-8");
      await page.setContent(`<!doctype html><html><body style="margin:0">${svg}</body></html>`);
      const name = basename(file, ".svg");
      const outPath = join(outDir, `${name}.png`);
      await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: 1200, height: 630 } });
      console.error(`Wrote ${outPath}`);
    }
  } finally {
    await browser.close();
  }
}

main();
