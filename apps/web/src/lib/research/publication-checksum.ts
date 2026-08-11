import { sha256Hex } from "../persist-scan";

/**
 * Deep, key-sorted canonicalisation for arbitrary JSON-serialisable
 * publication content (unlike `registry-checksum.ts`'s `canonicalJson`,
 * which only needs a shallow sort since `CanonicalCrawlerSnapshot`'s values
 * are already deterministic — publication content has nested objects/arrays
 * built from `Record<string, number>` purpose maps and finding lists, so
 * every level must be sorted for the checksum to be insertion-order-proof).
 */
export function canonicalizeForChecksum(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeForChecksum);
  if (value !== null && typeof value === "object") {
    const sortedKeys = Object.keys(value as Record<string, unknown>).sort();
    const ordered: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      ordered[key] = canonicalizeForChecksum((value as Record<string, unknown>)[key]);
    }
    return ordered;
  }
  return value;
}

/** SHA-256 over the canonicalised publication content — the reproducibility
 * manifest's integrity value (§50/§51). Not a signature, an equality check. */
export function computePublicationChecksum(content: unknown): Promise<string> {
  return sha256Hex(JSON.stringify(canonicalizeForChecksum(content)));
}
