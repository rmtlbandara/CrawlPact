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

  // Phase 15 §160: invalid replacement reference — a crawler marked
  // `replaced` should point at a real, existing crawler.
  const brokenReplacement = query(
    `SELECT c.id, c.name, c.replacement_crawler_id FROM crawlers c
     WHERE c.replacement_crawler_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM crawlers r WHERE r.id = c.replacement_crawler_id);`,
  );
  for (const row of brokenReplacement) {
    problems.push(
      `Crawler "${row.name}" (${row.id}) has replacement_crawler_id "${row.replacement_crawler_id}", which does not exist.`,
    );
  }

  // Phase 15 §160: duplicate version labels / duplicate release entries —
  // both already enforced by DB-level UNIQUE constraints (migration 0004),
  // checked here too as defense-in-depth in case that ever regresses.
  const duplicateVersionLabels = query(
    "SELECT version_label, COUNT(*) as count FROM registry_versions GROUP BY version_label HAVING count > 1;",
  );
  for (const row of duplicateVersionLabels) {
    problems.push(`Duplicate registry_versions.version_label: "${row.version_label}".`);
  }
  const duplicateReleaseEntries = query(
    "SELECT registry_version_id, crawler_id, COUNT(*) as count FROM registry_version_entries GROUP BY registry_version_id, crawler_id HAVING count > 1;",
  );
  for (const row of duplicateReleaseEntries) {
    problems.push(
      `Duplicate registry_version_entries row for release "${row.registry_version_id}" / crawler "${row.crawler_id}".`,
    );
  }

  // Phase 15 §160: malformed snapshots in the active release.
  const activeEntries = query(
    `SELECT rve.snapshot FROM registry_version_entries rve
     JOIN registry_versions rv ON rv.id = rve.registry_version_id
     WHERE rv.is_active = 1;`,
  );
  let malformedCount = 0;
  for (const row of activeEntries) {
    try {
      JSON.parse(row.snapshot);
    } catch {
      malformedCount += 1;
    }
  }
  if (malformedCount > 0) {
    problems.push(
      `${malformedCount} entr(y/ies) in the active release have unparseable snapshot JSON.`,
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

// Mirrors apps/web/src/lib/registry-checksum.ts's canonicalJson() exactly —
// sorted object keys so the checksum never depends on JSON key-insertion
// order. Phase 15 §33/35: the CLI and the runtime/admin checksum logic
// must agree, or "registry:checksum:verify" would be meaningless.
function canonicalJson(value) {
  const sortedKeys = Object.keys(value).sort();
  const ordered = {};
  for (const key of sortedKeys) ordered[key] = value[key];
  return JSON.stringify(ordered);
}

function computeChecksum(versionId) {
  const rows = query(
    `SELECT crawler_id, snapshot FROM registry_version_entries WHERE registry_version_id = '${versionId}' ORDER BY crawler_id;`,
  );
  if (rows.length === 0) return null;
  const canonical = rows
    .map((row) => `${row.crawler_id}:${canonicalJson(JSON.parse(row.snapshot))}`)
    .join("\n");
  return { hash: createHash("sha256").update(canonical).digest("hex"), count: rows.length };
}

function checksum(versionId) {
  if (!versionId) {
    console.error("Usage: node scripts/registry-tools.mjs checksum <registryVersionId>");
    process.exitCode = 1;
    return;
  }
  const result = computeChecksum(versionId);
  if (!result) {
    console.error(`No entries found for registry version "${versionId}".`);
    process.exitCode = 1;
    return;
  }
  console.log(`Release checksum for ${versionId} (${result.count} entries): ${result.hash}`);
}

// Phase 15 §35: independently re-verifies every *published* release's
// stored checksum still matches a fresh recomputation from its (immutable)
// entries. A mismatch means either the checksum algorithm changed
// incompatibly, or — far more seriously — a published release's entries
// were altered after publication, which should never be possible.
function checksumVerify() {
  const releases = query(
    "SELECT id, version_label, checksum FROM registry_versions WHERE published_at IS NOT NULL;",
  );
  if (releases.length === 0) {
    console.log("registry-tools checksum:verify: no published releases to check.");
    return;
  }
  const mismatches = [];
  for (const release of releases) {
    const result = computeChecksum(release.id);
    const computed = result?.hash ?? null;
    if (!release.checksum) {
      // Pre-Phase-15 published releases have no stored checksum at all —
      // not a mismatch, just never computed. Reported, not failed.
      console.log(
        `  ${release.version_label} (${release.id}): no stored checksum (published before Phase 15) — computed now: ${computed ?? "n/a"}`,
      );
      continue;
    }
    if (release.checksum !== computed) {
      mismatches.push(
        `${release.version_label} (${release.id}): stored=${release.checksum} computed=${computed}`,
      );
    }
  }
  if (mismatches.length > 0) {
    console.error(`registry-tools checksum:verify: ${mismatches.length} mismatch(es):\n`);
    for (const m of mismatches) console.error(`  - ${m}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `registry-tools checksum:verify: all ${releases.length} published release(s) with a stored checksum matched.`,
  );
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

// Phase 15 §124 — "Runtime Active Release Verification": a read-only check
// of the currently-active release's structural integrity. Same checks as
// `apps/web/src/lib/admin/registry-health.ts`'s `getRegistryHealth`, run
// here against local D1 via the CLI rather than a live Worker binding, so
// it's usable in CI/dev without a real deployment.
function integrityVerify() {
  const problems = [];

  const activeReleases = query(
    "SELECT id, version_label, published_at, checksum FROM registry_versions WHERE is_active = 1;",
  );
  if (activeReleases.length !== 1) {
    problems.push(`Expected exactly 1 active registry release, found ${activeReleases.length}.`);
  }
  const activeRulesets = query("SELECT id FROM ruleset_versions WHERE is_active = 1;");
  if (activeRulesets.length === 0) {
    problems.push("No active ruleset version exists.");
  }

  if (activeReleases.length === 1) {
    const active = activeReleases[0];
    if (!active.published_at) {
      problems.push(`Active release "${active.version_label}" has no published_at timestamp.`);
    }
    if (active.checksum) {
      const result = computeChecksum(active.id);
      if (result?.hash !== active.checksum) {
        problems.push(
          `Active release "${active.version_label}" checksum mismatch: stored=${active.checksum} computed=${result?.hash ?? "n/a"}.`,
        );
      }
    }

    const entries = query(
      `SELECT crawler_id, snapshot FROM registry_version_entries WHERE registry_version_id = '${active.id}';`,
    );
    const evaluationLifecycles = new Set(["active", "deprecated", "replaced"]);
    const seenTokens = new Map();
    for (const entry of entries) {
      let parsed;
      try {
        parsed = JSON.parse(entry.snapshot);
      } catch {
        problems.push(
          `Active release entry for crawler "${entry.crawler_id}" has unparseable snapshot JSON.`,
        );
        continue;
      }
      if (!evaluationLifecycles.has(parsed.lifecycleStatus)) continue;
      if (parsed.lifecycleStatus === "unverified") {
        problems.push(
          `Active release includes an "unverified" crawler as an evaluation entry: "${entry.crawler_id}".`,
        );
      }
      const key = (parsed.userAgentToken ?? "").toLowerCase();
      seenTokens.set(key, [...(seenTokens.get(key) ?? []), entry.crawler_id]);
    }
    for (const [token, ids] of seenTokens) {
      if (ids.length > 1) {
        problems.push(
          `Duplicate evaluation-eligible token "${token}" across crawlers: ${ids.join(", ")}.`,
        );
      }
    }
  }

  if (problems.length > 0) {
    console.error(`registry-tools integrity:verify: ${problems.length} issue(s):\n`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exitCode = 1;
    return;
  }
  console.log("registry-tools integrity:verify: active release is structurally valid.");
}

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case "validate":
    validate();
    break;
  case "checksum":
    checksum(args[0]);
    break;
  case "checksum:verify":
    checksumVerify();
    break;
  case "integrity:verify":
    integrityVerify();
    break;
  case "changelog":
    changelog(args[0], args[1]);
    break;
  default:
    console.error(
      "Usage: node scripts/registry-tools.mjs <validate|checksum|checksum:verify|integrity:verify|changelog> [args]",
    );
    process.exitCode = 1;
}
