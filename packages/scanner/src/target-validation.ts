import { isSafePublicAddress } from "./ip-classification";
import { resolveHostname } from "./dns-resolve";
import type { DnsResolver } from "./dns-resolve";

export type TargetRejectionReason =
  | "embedded_credentials"
  | "unsupported_port"
  | "blocked_target"
  | "dns_resolution_failed"
  | "unsafe_resolved_address";

export type TargetValidationResult =
  | { safe: true; hostname: string; resolvedAddresses: string[] }
  | { safe: false; reason: TargetRejectionReason; detail: string };

export type TargetValidationOptions = {
  /** Injectable for tests; defaults to the real DNS-over-HTTPS resolver. */
  resolver?: DnsResolver;
  /** Hostname suffixes an administrator has blocked (SRS §28.8, `blocked_targets`). */
  blocklist?: string[];
};

const DEFAULT_PORTS: Record<string, string> = { "http:": "80", "https:": "443" };

function isBlocked(hostname: string, blocklist: string[]): boolean {
  const lower = hostname.toLowerCase();
  return blocklist.some((pattern) => {
    const normalizedPattern = pattern.toLowerCase();
    return lower === normalizedPattern || lower.endsWith(`.${normalizedPattern}`);
  });
}

/**
 * Full target-safety validation (ADR-0005 steps 2-5, 10): embedded
 * credentials, port restriction, admin blocklist, DNS resolution, and
 * IP-range classification of every resolved address. Called once for the
 * initial target and again for every redirect destination in safe-fetch.ts.
 *
 * Takes an already syntactically-normalised origin (from
 * `@crawlpact/core`'s `normalizeTarget`, which already rejected literal IPs
 * and unsupported schemes) — this function adds the checks that need
 * network access or an admin-managed list, which normalizeTarget cannot do.
 */
export async function validateTarget(
  normalizedOrigin: string,
  options: TargetValidationOptions = {},
): Promise<TargetValidationResult> {
  const resolver = options.resolver ?? resolveHostname;
  const blocklist = options.blocklist ?? [];

  const url = new URL(normalizedOrigin);

  if (url.username.length > 0 || url.password.length > 0) {
    return {
      safe: false,
      reason: "embedded_credentials",
      detail: "The target URL contains embedded credentials, which are never permitted.",
    };
  }

  const port = url.port || DEFAULT_PORTS[url.protocol];
  if (port !== DEFAULT_PORTS[url.protocol]) {
    return {
      safe: false,
      reason: "unsupported_port",
      detail: `Port ${port} is not a supported public port for ${url.protocol.replace(":", "")}.`,
    };
  }

  const hostname = url.hostname;

  if (isBlocked(hostname, blocklist)) {
    return {
      safe: false,
      reason: "blocked_target",
      detail: "This target cannot be audited.",
    };
  }

  const resolution = await resolver(hostname);
  if (!resolution.ok) {
    return {
      safe: false,
      reason: "dns_resolution_failed",
      detail: `The hostname "${hostname}" could not be resolved.`,
    };
  }

  const unsafeAddress = resolution.addresses.find((address) => !isSafePublicAddress(address));
  if (unsafeAddress) {
    return {
      safe: false,
      reason: "unsafe_resolved_address",
      detail: `"${hostname}" resolves to a non-public address (${unsafeAddress}), which cannot be scanned.`,
    };
  }

  return { safe: true, hostname, resolvedAddresses: resolution.addresses };
}
