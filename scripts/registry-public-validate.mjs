#!/usr/bin/env node
// Phase 15 §164 — public registry/changelog validator. Compares the static
// crawler content collection (apps/web/src/content/crawlers/*.md) against
// the authoritative D1 registry (queried via `wrangler d1 execute --local`,
// same mechanism as scripts/registry-tools.mjs) to catch public-page drift:
// a content page claiming a token/purpose/lifecycle that no longer matches
// what the registry actually says, or a content page for a token that was
// never registered at all. Read-only, no network access beyond the local
// D1 CLI call — safe for every PR per §161 ("network-independent
// validation should remain suitable for normal CI").
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const rootDir = path.resolve(fileURLToPath(import.meta.url), "../..");
const wranglerConfig = path.join(rootDir, "apps/web/wrangler.jsonc");
const crawlersContentDir = path.join(rootDir, "apps/web/src/content/crawlers");

function query(sql) {
  const output = execFileSync(
    "npx",
    [
      "--yes",
      "wrangler",
      "d1",
      "execute",
      "crawlpact-db",
      "--local",
      "--config",
      wranglerConfig,
      "--json",
      "--command",
      sql,
    ],
    { encoding: "utf8", cwd: rootDir },
  );
  return JSON.parse(output)[0]?.results ?? [];
}

function loadContentCrawlers() {
  const entries = [];
  for (const filename of readdirSync(crawlersContentDir)) {
    if (!filename.endsWith(".md")) continue;
    const raw = readFileSync(path.join(crawlersContentDir, filename), "utf8");
    const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
    if (!match) {
      throw new Error(`crawlers/${filename}: missing or malformed frontmatter block`);
    }
    entries.push({ file: `apps/web/src/content/crawlers/${filename}`, data: parseYaml(match[1]) });
  }
  return entries;
}

function main() {
  const errors = [];
  const warnings = [];

  const contentCrawlers = loadContentCrawlers();
  const dbCrawlers = query(
    "SELECT user_agent_token, purpose, lifecycle_status, official_source_url FROM crawlers;",
  );
  const dbByToken = new Map(dbCrawlers.map((c) => [c.user_agent_token.toLowerCase(), c]));

  for (const { file, data } of contentCrawlers) {
    if (!data.officialSourceUrl) {
      errors.push(`${file}: missing officialSourceUrl in frontmatter.`);
    }
    // §182: public registry pages must never carry country/jurisdiction/
    // address/tax-ID/phone fields.
    const forbiddenKeys = ["country", "jurisdiction", "address", "taxId", "phone"];
    for (const key of forbiddenKeys) {
      if (key in data) errors.push(`${file}: contains prohibited public field "${key}".`);
    }
    // §89/§106: no internal review fields should ever leak into a public
    // content file.
    const internalKeys = ["approvedByUserId", "notes", "internalReviewNotes", "adminId"];
    for (const key of internalKeys) {
      if (key in data)
        errors.push(`${file}: contains internal-only field "${key}" in public content.`);
    }

    const dbMatch = dbByToken.get((data.userAgentToken ?? "").toLowerCase());
    if (!dbMatch) {
      errors.push(
        `${file}: userAgentToken "${data.userAgentToken}" has no corresponding registry record — a public page must not describe an unregistered crawler.`,
      );
      continue;
    }
    if (dbMatch.lifecycle_status === "unverified") {
      errors.push(
        `${file}: describes crawler "${data.userAgentToken}", but its registry record is still "unverified" — a public page must never present an unverified crawler as confirmed.`,
      );
    }
    if (data.purpose !== dbMatch.purpose) {
      warnings.push(
        `${file}: frontmatter purpose "${data.purpose}" does not match the registry's current purpose "${dbMatch.purpose}" for "${data.userAgentToken}" — page content may be stale.`,
      );
    }
    if (data.lifecycleStatus !== dbMatch.lifecycle_status) {
      warnings.push(
        `${file}: frontmatter lifecycleStatus "${data.lifecycleStatus}" does not match the registry's current lifecycle_status "${dbMatch.lifecycle_status}" for "${data.userAgentToken}" — page content may be stale.`,
      );
    }
  }

  if (errors.length > 0) {
    console.error(`registry:public:validate: ${errors.length} error(s):\n`);
    for (const e of errors) console.error(`  - ${e}`);
    if (warnings.length > 0) {
      console.error(`\n${warnings.length} warning(s):`);
      for (const w of warnings) console.error(`  - ${w}`);
    }
    process.exitCode = 1;
    return;
  }
  if (warnings.length > 0) {
    console.log(`registry:public:validate: PASSED with ${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`  - ${w}`);
    return;
  }
  console.log(
    `registry:public:validate: PASSED (${contentCrawlers.length} content pages checked against ${dbCrawlers.length} registry records)`,
  );
}

main();
