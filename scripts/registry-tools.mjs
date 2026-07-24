#!/usr/bin/env node
/**
 * Crawler registry validation and release tooling (SRS §17, Part 2 Step 5).
 * Operates against the local D1 database via `wrangler d1 execute --local`
 * (never remote — this is a development/CI tool, not a production
 * migration path). Run via `pnpm registry:validate`, or directly:
 *
 *   node scripts/registry-tools.mjs validate
 *   node scripts/registry-tools.mjs checksum <registryVersionId>
 *   node scripts/registry-tools.mjs changelog <fromVersionId> <toVersionId>
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(import.meta.url), "../..");
const wranglerConfig = path.join(rootDir, "apps/web/wrangler.jsonc");

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
  const parsed = JSON.parse(output);
  return parsed[0]?.results ?? [];
}

function validate() {
  const problems = [];

  const duplicateTokens = query(
    "SELECT user_agent_token, COUNT(*) as count FROM crawlers GROUP BY LOWER(user_agent_token) HAVING count > 1;",
  );
  for (const row of duplicateTokens) {
    problems.push(
      `Duplicate user_agent_token across crawlers: "${row.user_agent_token}" (${row.count} rows).`,
    );
  }

  const missingSource = query(
    "SELECT id, name FROM crawlers WHERE official_source_url IS NULL OR TRIM(official_source_url) = '';",
  );
  for (const row of missingSource) {
    problems.push(`Crawler "${row.name}" (${row.id}) has no official_source_url.`);
  }

  const activeUnverified = query(
    "SELECT id, name FROM crawlers WHERE lifecycle_status = 'active' AND (last_verified_at IS NULL OR official_source_url IS NULL OR TRIM(official_source_url) = '');",
  );
  for (const row of activeUnverified) {
    problems.push(
      `Crawler "${row.name}" (${row.id}) is marked active but lacks a verification date or source (FR-REG-005).`,
    );
  }

  const stale = query(
    "SELECT id, name, last_verified_at FROM crawlers WHERE lifecycle_status = 'active' AND last_verified_at < date('now', '-180 days');",
  );
  for (const row of stale) {
    problems.push(
      `Crawler "${row.name}" (${row.id}) was last verified on ${row.last_verified_at}, more than 180 days ago — re-verify against its official source.`,
    );
  }

  const multipleActiveRegistry = query(
    "SELECT COUNT(*) as count FROM registry_versions WHERE is_active = 1;",
  );
  if (Number(multipleActiveRegistry[0]?.count ?? 0) > 1) {
    problems.push(
      "More than one registry_version is marked active — this should be impossible given the unique index; investigate immediately.",
    );
  }

  if (problems.length > 0) {
    console.error(`registry-tools validate: found ${problems.length} issue(s):\n`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exitCode = 1;
    return;
  }
  console.log("registry-tools validate: no issues found.");
}

function checksum(versionId) {
  if (!versionId) {
    console.error("Usage: node scripts/registry-tools.mjs checksum <registryVersionId>");
    process.exitCode = 1;
    return;
  }
  const rows = query(
    `SELECT crawler_id, snapshot FROM registry_version_entries WHERE registry_version_id = '${versionId}' ORDER BY crawler_id;`,
  );
  if (rows.length === 0) {
    console.error(`No entries found for registry version "${versionId}".`);
    process.exitCode = 1;
    return;
  }
  const canonical = rows.map((row) => `${row.crawler_id}:${row.snapshot}`).join("\n");
  const hash = createHash("sha256").update(canonical).digest("hex");
  console.log(`Release checksum for ${versionId} (${rows.length} entries): sha256:${hash}`);
}

function changelog(fromId, toId) {
  if (!fromId || !toId) {
    console.error("Usage: node scripts/registry-tools.mjs changelog <fromVersionId> <toVersionId>");
    process.exitCode = 1;
    return;
  }
  const fromRows = query(
    `SELECT crawler_id, snapshot FROM registry_version_entries WHERE registry_version_id = '${fromId}';`,
  );
  const toRows = query(
    `SELECT crawler_id, snapshot FROM registry_version_entries WHERE registry_version_id = '${toId}';`,
  );

  const fromMap = new Map(fromRows.map((r) => [r.crawler_id, r.snapshot]));
  const toMap = new Map(toRows.map((r) => [r.crawler_id, r.snapshot]));

  const added = [...toMap.keys()].filter((id) => !fromMap.has(id));
  const removed = [...fromMap.keys()].filter((id) => !toMap.has(id));
  const changed = [...toMap.keys()].filter(
    (id) => fromMap.has(id) && fromMap.get(id) !== toMap.get(id),
  );

  console.log(`Changelog ${fromId} -> ${toId}:`);
  console.log(`  Added (${added.length}): ${added.join(", ") || "none"}`);
  console.log(`  Removed (${removed.length}): ${removed.join(", ") || "none"}`);
  console.log(`  Changed (${changed.length}): ${changed.join(", ") || "none"}`);
}

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case "validate":
    validate();
    break;
  case "checksum":
    checksum(args[0]);
    break;
  case "changelog":
    changelog(args[0], args[1]);
    break;
  default:
    console.error("Usage: node scripts/registry-tools.mjs <validate|checksum|changelog> [args]");
    process.exitCode = 1;
}
