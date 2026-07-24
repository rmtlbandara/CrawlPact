/**
 * Domain input normalisation (SRS §13, FR-DOM-001 through FR-DOM-007).
 *
 * This module only normalises and validates the *shape* of user input. It
 * does not resolve DNS or classify IP ranges — that is the safe-fetch
 * chokepoint's job (ADR-0005, packages/scanner). Rejecting literal IP
 * targets here is purely syntactic (FR-FET-003) and is duplicated at the
 * fetch layer deliberately, since the two checks protect different stages.
 */

const UNSUPPORTED_SCHEMES = new Set(["file", "ftp", "data", "javascript", "mailto", "ws", "wss"]);

export type NormalizeResult =
  | {
      ok: true;
      originalInput: string;
      normalizedOrigin: string;
      hostname: string;
    }
  | {
      ok: false;
      originalInput: string;
      reason: "empty" | "unsupported_scheme" | "invalid_url" | "literal_ip" | "invalid_hostname";
    };

function isLiteralIpAddress(hostname: string): boolean {
  const bare =
    hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;

  const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipv4Match = ipv4Pattern.exec(bare);
  if (ipv4Match) {
    return ipv4Match.slice(1, 5).every((octet) => Number(octet) <= 255);
  }

  // Anything containing a colon and hex digits that isn't a hostname is
  // treated as a literal IPv6 address for the purposes of this rejection.
  if (bare.includes(":") && /^[0-9a-fA-F:]+$/.test(bare)) {
    return true;
  }

  return false;
}

export function normalizeTarget(input: string): NormalizeResult {
  const originalInput = input;
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return { ok: false, originalInput, reason: "empty" };
  }

  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//.exec(trimmed);
  if (schemeMatch && UNSUPPORTED_SCHEMES.has(schemeMatch[1]!.toLowerCase())) {
    return { ok: false, originalInput, reason: "unsupported_scheme" };
  }

  // A bare colon-prefixed scheme with no "//" (e.g. "javascript:alert(1)")
  // must also be rejected even though it never reaches the URL parser as a
  // valid absolute URL below.
  const bareSchemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(trimmed);
  if (
    !schemeMatch &&
    bareSchemeMatch &&
    UNSUPPORTED_SCHEMES.has(bareSchemeMatch[1]!.toLowerCase())
  ) {
    return { ok: false, originalInput, reason: "unsupported_scheme" };
  }

  const candidate = schemeMatch ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, originalInput, reason: "invalid_url" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, originalInput, reason: "unsupported_scheme" };
  }

  let hostname = url.hostname.toLowerCase();
  if (hostname.endsWith(".")) {
    hostname = hostname.slice(0, -1);
  }

  if (hostname.length === 0) {
    return { ok: false, originalInput, reason: "invalid_hostname" };
  }

  if (isLiteralIpAddress(hostname)) {
    return { ok: false, originalInput, reason: "literal_ip" };
  }

  const isDefaultPort =
    url.port === "" ||
    (url.protocol === "http:" && url.port === "80") ||
    (url.protocol === "https:" && url.port === "443");
  const portSuffix = isDefaultPort ? "" : `:${url.port}`;

  const normalizedOrigin = `${url.protocol}//${hostname}${portSuffix}`;

  return { ok: true, originalInput, normalizedOrigin, hostname };
}
