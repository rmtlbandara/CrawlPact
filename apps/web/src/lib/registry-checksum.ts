import { eq } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { sha256Hex } from "./persist-scan";
import { getRegistryVersionSnapshotMap, type CanonicalCrawlerSnapshot } from "./registry-snapshot";

/**
 * Deterministically serialises a canonical snapshot with sorted object keys
 * so the checksum never changes merely because a field was added in a
 * different order or a JS engine's key-insertion order differed (Section
 * 33, "Snapshot Canonicalisation"). Not a digital signature — an integrity
 * comparison identifier only (Section 34/115).
 */
function canonicalJson(value: CanonicalCrawlerSnapshot): string {
  const sortedKeys = Object.keys(value).sort() as (keyof CanonicalCrawlerSnapshot)[];
  const ordered: Record<string, unknown> = {};
  for (const key of sortedKeys) ordered[key] = value[key];
  return JSON.stringify(ordered);
}

/**
 * SHA-256 over every crawler snapshot in a release, ordered by crawler ID
 * (stable regardless of insertion order) and canonicalised before hashing.
 * Used both to compute a release's checksum at publish time and to
 * independently re-verify it later (`pnpm registry:checksum:verify`, and
 * the "mandatory reproducibility test").
 */
export async function computeRegistryChecksum(
  db: Database,
  registryVersionId: string,
): Promise<string> {
  const snapshotMap = await getRegistryVersionSnapshotMap(db, registryVersionId);
  const canonical = [...snapshotMap.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([crawlerId, snapshot]) => `${crawlerId}:${canonicalJson(snapshot)}`)
    .join("\n");
  return sha256Hex(canonical);
}

/** Re-verifies a published release's stored checksum still matches its
 * (immutable) entries. A mismatch means either the checksum algorithm
 * changed incompatibly or — far more seriously — the entries themselves
 * were altered after publication, which should never happen. */
export async function verifyRegistryChecksum(
  db: Database,
  registryVersionId: string,
): Promise<{ storedChecksum: string | null; computedChecksum: string; matches: boolean }> {
  const [version] = await db
    .select({ checksum: schema.registryVersions.checksum })
    .from(schema.registryVersions)
    .where(eq(schema.registryVersions.id, registryVersionId))
    .limit(1);

  const computedChecksum = await computeRegistryChecksum(db, registryVersionId);
  const storedChecksum = version?.checksum ?? null;
  return { storedChecksum, computedChecksum, matches: storedChecksum === computedChecksum };
}
