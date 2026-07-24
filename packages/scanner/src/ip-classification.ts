/**
 * IP address range classification for SSRF defence-in-depth (ADR-0005,
 * SRS FR-FET-002). This module is pure and network-free by design: it is
 * the piece of the safe-fetch chokepoint that is fully implementable and
 * testable in Part 1, ahead of the actual DNS resolution + fetch
 * orchestration that Part 2 builds around it (see
 * docs/security/SSRF_SECURITY_MODEL.md for the full pipeline and what
 * remains to be wired up).
 */
export type IpClassification =
  | "public"
  | "loopback"
  | "private"
  | "link_local"
  | "multicast"
  | "reserved"
  | "cloud_metadata"
  | "invalid";

function parseIpv4(address: string): number[] | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address);
  if (!match) return null;
  const octets = match.slice(1, 5).map(Number);
  if (octets.some((octet) => octet > 255)) return null;
  return octets;
}

function classifyIpv4(address: string): IpClassification {
  const octets = parseIpv4(address);
  if (!octets) return "invalid";
  const [a, b] = octets as [number, number, number, number];

  if (a === 127) return "loopback";
  if (a === 10) return "private";
  if (a === 172 && b >= 16 && b <= 31) return "private";
  if (a === 192 && b === 168) return "private";
  if (a === 169 && b === 254) {
    // 169.254.169.254 is the AWS/GCP/Azure/Cloudflare metadata address;
    // the whole /16 is link-local and is rejected either way, but this is
    // called out explicitly because it is the single most important
    // address in this table to never allow through.
    return "cloud_metadata";
  }
  if (a === 100 && b >= 64 && b <= 127) return "private"; // RFC 6598 shared address space
  if (a === 0) return "reserved";
  if (a >= 224 && a <= 239) return "multicast";
  if (a >= 240) return "reserved";

  return "public";
}

function classifyIpv6(address: string): IpClassification {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");

  if (normalized === "::1") return "loopback";
  if (normalized === "::") return "reserved";
  if (normalized.startsWith("fe80:")) return "link_local";
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return "private"; // fc00::/7 unique local
  if (normalized.startsWith("ff")) return "multicast";

  // IPv4-mapped IPv6 addresses (::ffff:a.b.c.d) must be unwrapped and
  // classified using the IPv4 rules, since they can otherwise smuggle a
  // private IPv4 target past a naive "is this IPv6" check.
  const mappedMatch = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(normalized);
  if (mappedMatch) return classifyIpv4(mappedMatch[1]!);

  return "public";
}

/**
 * Classifies a literal IP address string. Callers in the future fetch
 * orchestrator should reject any target where the classification is not
 * "public" for every resolved address (SRS FR-FET-002), and separately
 * reject literal IP targets in the input itself (FR-FET-003), handled by
 * `normalizeTarget` in `@crawlpact/core`.
 */
export function classifyIpAddress(address: string): IpClassification {
  if (address.includes(":")) {
    return classifyIpv6(address);
  }
  return classifyIpv4(address);
}

export function isSafePublicAddress(address: string): boolean {
  return classifyIpAddress(address) === "public";
}
