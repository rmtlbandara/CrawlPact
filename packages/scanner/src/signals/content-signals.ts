/**
 * Content Signals parsing (SRS §19.3). Content Signals is an emerging,
 * evolving convention for expressing machine-readable permissions (e.g. a
 * `Content-Signal` robots.txt directive or HTTP response header with
 * comma-separated `key=value` pairs such as `search=yes, ai-train=no`).
 *
 * BEST-EFFORT NOTICE: because this is an emerging, still-evolving spec, this
 * parser recognises a small set of currently-documented keys and preserves
 * everything else verbatim rather than discarding it — re-verify the known
 * key list against the current specification before treating this as
 * authoritative (see docs/registry/SOURCE_VERIFICATION_POLICY.md).
 */
export type ContentSignalValue = "yes" | "no" | "unknown";

export type ContentSignalsResult = {
  recognised: Partial<Record<"search" | "ai-train" | "ai-input", ContentSignalValue>>;
  unknownFields: Record<string, string>;
  raw: string;
};

const KNOWN_KEYS = new Set(["search", "ai-train", "ai-input"]);

export function parseContentSignals(rawValue: string): ContentSignalsResult {
  const recognised: ContentSignalsResult["recognised"] = {};
  const unknownFields: Record<string, string> = {};

  const pairs = rawValue
    .split(",")
    .map((pair) => pair.trim())
    .filter((pair) => pair.length > 0);

  for (const pair of pairs) {
    const [rawKey, rawVal] = pair.split("=").map((part) => part?.trim());
    if (!rawKey) continue;
    const key = rawKey.toLowerCase();
    const value = (rawVal ?? "").toLowerCase();

    if (KNOWN_KEYS.has(key)) {
      const normalizedValue: ContentSignalValue =
        value === "yes" || value === "no" ? value : "unknown";
      recognised[key as "search" | "ai-train" | "ai-input"] = normalizedValue;
    } else {
      unknownFields[rawKey] = rawVal ?? "";
    }
  }

  return { recognised, unknownFields, raw: rawValue };
}
