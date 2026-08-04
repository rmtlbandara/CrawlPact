#!/usr/bin/env node
// Live link check for every officialSources URL cited in the platforms content collection
// (Phase 7). Unlike content-validate.mjs, this makes real outbound network requests — it exists
// to catch a source page that has moved or gone offline since docs/seo/
// PLATFORM_CLAIM_SOURCE_REGISTER.md was last verified, per docs/seo/CONTENT_FRESHNESS_AND_REVIEW_
// POLICY.md's "broken-source handling" rule. Not part of `pnpm quality` (which must stay
// network-independent) — run manually or on a schedule.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const PLATFORMS_DIR = path.join(REPO_ROOT, "apps/web/src/content/platforms");
const TIMEOUT_MS = 10_000;

// help.shopify.com returns HTTP 403 to automated/datacenter-origin requests (confirmed via curl
// with a real browser User-Agent — still 403) regardless of whether the page exists; this is
// Shopify's own bot-blocking, not a broken source. Manually re-verified reachable and current via
// a full browser-rendered fetch on 2026-08-04 (see docs/seo/PLATFORM_CLAIM_SOURCE_REGISTER.md,
// claims SH-*). Narrow, reviewed allowlist — do not widen without the same manual re-check.
const KNOWN_BOT_BLOCKED_HOSTS = ["help.shopify.com"];

function loadOfficialSources() {
  const sources = [];
  for (const filename of readdirSync(PLATFORMS_DIR)) {
    if (!filename.endsWith(".md")) continue;
    const raw = readFileSync(path.join(PLATFORMS_DIR, filename), "utf8");
    const match = /^---\n([\s\S]*?)\n---\n/.exec(raw);
    const data = parseYaml(match[1]);
    for (const source of data.officialSources ?? []) {
      sources.push({ file: filename, title: source.title, url: source.url });
    }
  }
  return sources;
}

async function checkUrl(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
    });
    // Some official-docs hosts reject HEAD (405/501) but serve GET fine — retry before failing.
    if (response.status === 405 || response.status === 501) {
      response = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
    }
    return { ok: response.ok, status: response.status };
  } catch (err) {
    return { ok: false, status: null, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const sources = loadOfficialSources();
  const failures = [];

  for (const source of sources) {
    const result = await checkUrl(source.url);
    const label = `${source.file} — "${source.title}" (${source.url})`;
    const host = new URL(source.url).host;
    if (result.ok) {
      console.log(`[OK  ] ${label} — HTTP ${result.status}`);
    } else if (KNOWN_BOT_BLOCKED_HOSTS.includes(host)) {
      console.warn(
        `[SKIP] ${label} — HTTP ${result.status ?? result.error} (known bot-blocked host, manually verified — see KNOWN_BOT_BLOCKED_HOSTS)`,
      );
    } else {
      const detail = result.status ? `HTTP ${result.status}` : result.error;
      console.error(`[FAIL] ${label} — ${detail}`);
      failures.push(`${label}: ${detail}`);
    }
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} broken official source link(s):`);
    for (const f of failures) console.error(`  - ${f}`);
    console.error(
      "\ncontent:links:check: FAILED — see docs/seo/CONTENT_FRESHNESS_AND_REVIEW_POLICY.md for broken-source handling",
    );
    process.exit(1);
  }

  console.log(`\ncontent:links:check: PASSED (${sources.length} official source links checked)`);
}

main();
