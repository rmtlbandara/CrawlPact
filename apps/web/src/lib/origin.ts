import { getEnv } from "./env";

/**
 * Single authoritative source of trusted CrawlPact origins (ADR-0010, Phase 2
 * of the app-subdomain migration). Every place that needs to know "is this
 * origin actually us" — CSRF (`auth/same-origin.ts`), WebAuthn ceremony
 * pinning (`auth/webauthn.ts`), and the Worker-level host boundary
 * (`worker.ts`, `middleware.ts`) — reads through this module instead of
 * comparing hostname strings inline. Trust is always derived from validated
 * environment configuration (`PUBLIC_SITE_URL`, `PUBLIC_APP_URL`), never from
 * a request header — headers like `X-Forwarded-Host` are client-influenceable
 * and are never treated as an authorization source here.
 */

export type HostSurface = "public" | "app" | "unknown";

function parseOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/** The public marketing/search/trust origin for the current environment (e.g. `https://crawlpact.com`, `https://preview.crawlpact.com`, or the local dev origin). */
export function getPublicOrigin(): string {
  return new URL(getEnv().PUBLIC_SITE_URL).origin;
}

/**
 * The application origin for the current environment (e.g.
 * `https://app.crawlpact.com`), or `null` if `PUBLIC_APP_URL` isn't
 * configured. Phase 1 introduced `PUBLIC_APP_URL` as optional and unconsumed;
 * Phase 2 is the first code to read it. It remains optional here — an
 * environment without it configured simply has no second trusted surface,
 * degrading safely rather than throwing (this is what keeps every existing
 * test fixture that never set `PUBLIC_APP_URL` working unchanged).
 */
export function getAppOrigin(): string | null {
  return parseOrigin(getEnv().PUBLIC_APP_URL);
}

/** Every origin this Worker currently trusts as a first-party CrawlPact surface, for this environment. */
export function getTrustedOrigins(): string[] {
  const origins = [getPublicOrigin()];
  const appOrigin = getAppOrigin();
  if (appOrigin && appOrigin !== origins[0]) origins.push(appOrigin);
  return origins;
}

export function isTrustedOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  return getTrustedOrigins().includes(origin);
}

/**
 * Classifies an origin string against the currently configured trusted
 * origins. Exact match only (scheme + hostname + port) — never a suffix
 * check like `hostname.endsWith("crawlpact.com")`, which would extend trust
 * to any attacker-controlled subdomain.
 */
export function classifyOrigin(origin: string | null | undefined): HostSurface {
  if (!origin) return "unknown";
  if (origin === getPublicOrigin()) return "public";
  const appOrigin = getAppOrigin();
  if (appOrigin && origin === appOrigin) return "app";
  return "unknown";
}

/** Classifies the origin a request itself arrived on (from its own validated URL, never a spoofable header). */
export function classifyRequestOrigin(request: Request): HostSurface {
  return classifyOrigin(new URL(request.url).origin);
}

/**
 * The origin a request "speaks for," for CSRF/WebAuthn trust decisions: its
 * own arrival origin, but only if that origin is currently trusted. Returns
 * `null` for a request arriving on an origin we don't recognize (an unknown
 * hostname must never silently become a trusted origin — see
 * `docs/baseline/2026-09-09-app-subdomain-phase1/CLOUDFLARE_HOST_BOUNDARY_DESIGN.md`).
 */
export function getValidatedRequestOrigin(request: Request): string | null {
  const origin = new URL(request.url).origin;
  return isTrustedOrigin(origin) ? origin : null;
}

/** Builds an absolute URL on the public origin, preserving the given path and query. */
export function toPublicUrl(pathname: string, search = ""): string {
  const url = new URL(pathname, getPublicOrigin());
  url.search = search;
  return url.toString();
}
