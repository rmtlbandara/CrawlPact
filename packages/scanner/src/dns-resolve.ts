/**
 * DNS-over-HTTPS resolution for the safe-fetch pipeline (ADR-0005 step 5).
 * Uses Cloudflare's own DoH endpoint — a fixed, trusted destination, not the
 * customer-supplied target — so this module itself never violates the
 * "only safe-fetch touches customer-supplied URLs" rule; it resolves a
 * *hostname* via a resolver CrawlPact chose, not by fetching the target.
 *
 * IMPORTANT: see ADR-0005 "DNS rebinding: honest treatment" — resolving and
 * checking addresses here does not guarantee the later `fetch()` call in
 * safe-fetch.ts connects to the same address. This is one layer of
 * defence-in-depth, not a complete guarantee.
 */

export type DnsResolutionResult =
  { ok: true; addresses: string[] } | { ok: false; reason: "no_records" | "resolver_error" };

export type DnsResolver = (hostname: string) => Promise<DnsResolutionResult>;

const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";
const RESOLVE_TIMEOUT_MS = 5000;

async function queryRecordType(hostname: string, type: "A" | "AAAA"): Promise<string[]> {
  const url = `${DOH_ENDPOINT}?name=${encodeURIComponent(hostname)}&type=${type}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RESOLVE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/dns-json" },
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const body = (await response.json()) as { Answer?: Array<{ type: number; data: string }> };
    const expectedType = type === "A" ? 1 : 28;
    return (body.Answer ?? [])
      .filter((answer) => answer.type === expectedType)
      .map((answer) => answer.data);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/** Default resolver: real DNS-over-HTTPS lookups via Cloudflare's resolver. */
export const resolveHostname: DnsResolver = async (hostname) => {
  try {
    const [ipv4, ipv6] = await Promise.all([
      queryRecordType(hostname, "A"),
      queryRecordType(hostname, "AAAA"),
    ]);
    const addresses = [...ipv4, ...ipv6];
    if (addresses.length === 0) return { ok: false, reason: "no_records" };
    return { ok: true, addresses };
  } catch {
    return { ok: false, reason: "resolver_error" };
  }
};
