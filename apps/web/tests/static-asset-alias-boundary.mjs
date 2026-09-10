#!/usr/bin/env node
// Regression test for the app-host Static Assets alias boundary gap (found
// live, 2026-09-09, validating the real `app.crawlpact.com` Custom Domain
// attachment: `/about/index.html` and other literal alias forms of a
// prerendered public page bypassed the Worker's app-host boundary entirely
// and served real public HTML directly).
//
// Deliberately NOT a Vitest file under `apps/web/tests/integration/` (that
// project's tests are fast, in-process, D1-Miniflare-only — see
// `vitest.config.ts` — and this needs a real `astro build` plus a real
// `wrangler dev` process against the generated Worker + Assets binding,
// exactly the two things a mocked-`handle()` unit test cannot exercise).
// `worker.host-boundary.test.ts` already covers the same cases with a
// mocked `handle()`, fast, for the routing *decision logic*; this script
// is the one place that proves the decision holds against Cloudflare's
// actual `run_worker_first`/`html_handling` Static Assets behavior, not a
// simulation of it.
//
// Usage: node apps/web/tests/static-asset-alias-boundary.mjs
// (run from anywhere; resolves paths relative to this file). Builds for
// production first — refuses if a `.dev.vars` is present anywhere in the
// checkout, same rule as `scripts/build.sh`, for the same reason.

import { execFile, execFileSync, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const webDir = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(webDir, "../..");
const PORT = 9787;
const BASE = `http://localhost:${PORT}`;

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

for (const p of [path.join(repoRoot, ".dev.vars"), path.join(webDir, ".dev.vars")]) {
  if (existsSync(p)) {
    console.error(
      `refusing to run — ${p} exists (see scripts/build.sh's own check: building with local dev vars present bakes them into the output).`,
    );
    process.exit(1);
  }
}

console.log("Building for production...");
execFileSync("pnpm", ["build:production"], { cwd: repoRoot, stdio: "inherit" });

const configPath = path.join(webDir, "dist/server/wrangler.json");
if (!existsSync(configPath)) {
  console.error(`build did not produce ${configPath}`);
  process.exit(1);
}

console.log("Starting wrangler dev against the real built Worker + Assets binding...");
const wrangler = spawn(
  "npx",
  [
    "wrangler",
    "dev",
    "--config",
    configPath,
    "--port",
    String(PORT),
    // Local test transport is plain HTTP; override the baked-in https://
    // values to match, or origin classification would see a scheme
    // mismatch and treat every request as an unrecognized host — a purely
    // local-test artifact, not a production concern (production is always
    // real HTTPS end to end).
    "--var",
    "PUBLIC_SITE_URL:http://crawlpact.com",
    "--var",
    "PUBLIC_APP_URL:http://app.crawlpact.com",
  ],
  { cwd: webDir, stdio: ["ignore", "pipe", "pipe"] },
);

const readyPromise = new Promise((resolve, reject) => {
  const timeout = setTimeout(
    () => reject(new Error("wrangler dev did not become ready within 30s")),
    30_000,
  );
  const onData = (data) => {
    if (data.toString().includes("Ready on")) {
      clearTimeout(timeout);
      resolve();
    }
  };
  wrangler.stdout.on("data", onData);
  wrangler.stderr.on("data", onData);
});

// Node's `fetch` (undici) silently ignores/overrides a script-set `Host`
// header — a deliberate fetch-spec restriction, same as in a browser — so
// it cannot be used to simulate a request arriving on a different hostname
// against this single local server. `curl -H "Host: ..."` has no such
// restriction and is what every manual verification of this exact fix used
// (both the app-host bypass discovery and its fix), so this script shells
// out to it directly for a faithful, identical result.
async function curlStatusAndLocation(host, pathname, method) {
  const { stdout } = await execFileAsync("curl", [
    "-s",
    "-H",
    `Host: ${host}`,
    "-X",
    method,
    "-o",
    "/dev/null",
    "-D",
    "-",
    `${BASE}${pathname}`,
  ]);
  const statusLine = stdout.match(/^HTTP\/[\d.]+ (\d+)/m);
  const locationLine = stdout.match(/^location: (.+)$/im);
  return {
    status: statusLine ? Number(statusLine[1]) : 0,
    location: locationLine ? locationLine[1].trim() : null,
  };
}

async function waitUntilUp() {
  for (let i = 0; i < 30; i++) {
    try {
      const { status } = await curlStatusAndLocation("crawlpact.com", "/", "GET");
      if (status > 0) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("server never accepted a connection");
}

try {
  await Promise.race([readyPromise, waitUntilUp()]);
} catch (err) {
  wrangler.kill();
  console.error(err.message);
  process.exit(1);
}
await waitUntilUp();

async function check(host, pathname, expected) {
  const { status, location } = await curlStatusAndLocation(
    host,
    pathname,
    expected.method ?? "GET",
  );
  const label = `${host}${pathname}`;
  if (status !== expected.status) {
    fail(`${label} -> expected status ${expected.status}, got ${status}`);
    return;
  }
  if (expected.location !== undefined && location !== expected.location) {
    fail(`${label} -> expected Location "${expected.location}", got "${location}"`);
    return;
  }
  console.log(`OK: ${label} -> ${status}${location ? ` -> ${location}` : ""}`);
}

const APP = "app.crawlpact.com";
const APEX = "crawlpact.com";

console.log(
  "\n--- App-host: literal Static Assets aliases must redirect to the public apex, single hop ---",
);
await check(APP, "/index.html", { status: 308, location: "http://crawlpact.com/" });
await check(APP, "/index", { status: 308, location: "http://crawlpact.com/" });
await check(APP, "/about/index.html", { status: 308, location: "http://crawlpact.com/about/" });
await check(APP, "/about/index", { status: 308, location: "http://crawlpact.com/about/" });
await check(APP, "/about.html", { status: 308, location: "http://crawlpact.com/about/" });
await check(APP, "/security/index.html", {
  status: 308,
  location: "http://crawlpact.com/security/",
});
await check(APP, "/crawlers/index.html", {
  status: 308,
  location: "http://crawlpact.com/crawlers/",
});
await check(APP, "/crawlers/gptbot/index.html", {
  status: 308,
  location: "http://crawlpact.com/crawlers/gptbot/",
});
await check(APP, "/crawlers/gptbot.html", {
  status: 308,
  location: "http://crawlpact.com/crawlers/gptbot/",
});
await check(APP, "/about/index.html?ref=xyz", {
  status: 308,
  location: "http://crawlpact.com/about/?ref=xyz",
});
await check(APP, "/about/index.html", { status: 404, method: "POST" });

console.log("\n--- App-host: sensitive/private paths must stay unaffected by the alias fix ---");
await check(APP, "/app/index.html", { status: 404 });
await check(APP, "/admin.html", { status: 404 });
await check(APP, "/sign-in/index", { status: 404 });
await check(APP, "/api/domains.html", { status: 404 });
await check(APP, "/sign-in", { status: 200 });
await check(APP, "/app", { status: 302 });
await check(APP, "/admin", { status: 302 });

console.log(
  "\n--- Apex: the same aliases must canonicalize using the existing Phase-20 contract (301, one hop) ---",
);
await check(APEX, "/index.html", { status: 301, location: "http://crawlpact.com/" });
await check(APEX, "/about/index.html", { status: 301, location: "http://crawlpact.com/about/" });
await check(APEX, "/about.html", { status: 301, location: "http://crawlpact.com/about/" });
await check(APEX, "/crawlers/index.html", {
  status: 301,
  location: "http://crawlpact.com/crawlers/",
});
await check(APEX, "/crawlers/gptbot/index.html", {
  status: 301,
  location: "http://crawlpact.com/crawlers/gptbot/",
});
await check(APEX, "/crawlers/gptbot.html", {
  status: 301,
  location: "http://crawlpact.com/crawlers/gptbot/",
});
await check(APEX, "/about", { status: 301, location: "http://crawlpact.com/about/" });
await check(APEX, "/about/", { status: 200 });

console.log("\n--- Apex: static/asset exclusions from run_worker_first remain unaffected ---");
await check(APEX, "/favicon.png", { status: 200 });
await check(APEX, "/og-image.svg", { status: 200 });

wrangler.kill();
if (process.exitCode) {
  console.error("\nSome checks FAILED — see above.");
} else {
  console.log("\nAll static-asset-alias boundary checks passed.");
}
