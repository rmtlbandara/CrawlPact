#!/usr/bin/env node
// Human-only UI review screenshots — NOT a CI gate, NOT a committed baseline.
// Renders the same representative routes the deleted pixel visual-regression
// suite used to compare pixel-for-pixel, into a git-ignored folder for a
// person to eyeball. See docs/architecture/adr/ADR-0008-remove-pixel-visual-regression.md.
//
// Usage: pnpm dev (in another terminal), then: pnpm ui:review [baseUrl]

import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const baseUrl = process.argv[2] ?? "http://localhost:4321";
const outDir = "artifacts/ui-review";

const ROUTES = ["/", "/about", "/pricing", "/crawlers/gptbot", "/guides", "/tools", "/changelog"];
const VIEWPORTS = [
  { name: "360", width: 360, height: 800 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 900 },
];

async function main(): Promise<void> {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();
      for (const route of ROUTES) {
        await page.goto(new URL(route, baseUrl).toString());
        await page.waitForLoadState("networkidle");
        const name = route === "/" ? "home" : route.replace(/\//g, "-").replace(/^-/, "");
        const file = `${outDir}/${name}-${viewport.name}.png`;
        await page.screenshot({ path: file, fullPage: true });
        console.error(`Saved ${file}`);
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.error(`\nDone. Review screenshots in ${outDir}/ — never committed, never a CI gate.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
