import { getEnv } from "./env";

/**
 * Single authoritative source of trusted CrawlPact origins (ADR-0010, Phase 2
 * of the app-subdomain migration). Every place that needs to know "is this
 * origin actually us" — CSRF (`auth/same-origin.ts`), WebAuthn ceremony
 * pinning (`auth/webauthn.ts`), and the Worker-level host boundary
 * (`worker.ts`, `middleware.ts`) — reads through this module instead of
 * comparing hostname strings inline. Trust is always derived from validated
 * environment configuration (`PUBLIC_SITE_URL`, `PUBLIC_APP_URL`) compared
 * against the request's own arrival origin — never from a client-suppliable
 * hop-by-hop header like `X-Forwarded-Host`, which a proxy in front of the
 * real edge could set to anything.
 *
 * The arrival origin itself is read from the request's `Host` header, not
 * `new URL(request.url).origin`. In a real deployed Cloudflare Worker these
 * are equivalent — Cloudflare constructs `request.url` directly from the
 * actual Host the client requested. In `astro dev`'s local Node-based
 * request pipeline they are **not** reliably equivalent: `request.url`'s
 * host can reflect the resolved local socket address (e.g. `[::1]:4321`
 * when a client's "localhost" resolves to the IPv6 loopback) rather than
 * the literal host string the client sent, which silently misclassified
 * every request as "unknown" during Phase 2 development and made
 * `/sign-in`, `/app`, and `/admin` 404 outright — found and root-caused via
 * `docs/baseline/2026-09-09-app-subdomain-phase3/` CI investigation. `Host`
 * is exactly what a real Cloudflare Custom Domain match is keyed on in the
 * first place, so reading it directly here is not a weaker trust boundary —
 * it is the more accurate one, in every environment.
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

/**
 * The origin a request actually arrived on: `Host` header + the request
 * URL's own scheme. See this module's doc comment for why `Host` is used
 * instead of `new URL(request.url).origin` directly. Falls back to the
 * request URL's own origin only if `Host` is somehow absent (malformed
 * request) — a degraded-but-non-throwing default, not a trust decision.
 */
function requestArrivalOrigin(request: Request): string {
  const requestUrl = new URL(request.url);
  const host = request.headers.get("host");
  if (!host) return requestUrl.origin;
  try {
    return new URL(`${requestUrl.protocol}//${host}`).origin;
  } catch {
    return requestUrl.origin;
  }
}

/** Classifies the origin a request itself arrived on. */
export function classifyRequestOrigin(request: Request): HostSurface {
  return classifyOrigin(requestArrivalOrigin(request));
}

/**
 * The origin a request "speaks for," for CSRF/WebAuthn trust decisions: its
 * own arrival origin, but only if that origin is currently trusted. Returns
 * `null` for a request arriving on an origin we don't recognize (an unknown
 * hostname must never silently become a trusted origin — see
 * `docs/baseline/2026-09-09-app-subdomain-phase1/CLOUDFLARE_HOST_BOUNDARY_DESIGN.md`).
 */
export function getValidatedRequestOrigin(request: Request): string | null {
  const origin = requestArrivalOrigin(request);
  return isTrustedOrigin(origin) ? origin : null;
}

/** Builds an absolute URL on the public origin, preserving the given path and query. */
export function toPublicUrl(pathname: string, search = ""): string {
  const url = new URL(pathname, getPublicOrigin());
  url.search = search;
  return url.toString();
}
