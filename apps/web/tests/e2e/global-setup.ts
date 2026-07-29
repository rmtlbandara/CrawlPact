import type { FullConfig } from "@playwright/test";

/**
 * Routes not listed in /sitemap.xml (noindex: sign-in, the authenticated
 * app shell, the Paddle payment-link host, admin) but which still pull in
 * heavy client-only dependencies (@simplewebauthn/browser, @paddle/paddle-js)
 * the SSR dev server has never resolved before.
 */
const EXTRA_ROUTES = ["/sign-in", "/pay", "/app", "/app/billing", "/app/account", "/admin"];

/**
 * API routes with their own separate server-side import graph that a page
 * fetch never touches — `@simplewebauthn/server` is imported only inside
 * `lib/auth/webauthn.ts`, which no page component ever loads (that module is
 * reached exclusively through these API route handlers). A real ubuntu-latest
 * CI run confirmed `register/begin` returning a real 500 here — the exact
 * same SSR dependency-optimizer race as `/pay`'s `@paddle/paddle-js`
 * (see the class comment below), just in a spot the page-route warmup above
 * never reaches. One warm hit is enough: all of these share the same
 * underlying module, so `@simplewebauthn/server`'s dependency discovery only
 * has to happen once for all of them to be safe.
 */
const API_WARMUP_REQUESTS: { path: string; body: unknown }[] = [
  { path: "/api/auth/register/begin", body: { displayName: "warmup" } },
  { path: "/api/auth/login/begin", body: {} },
  { path: "/api/auth/recovery-codes/redeem", body: { code: "WARMUP-WARMUP-WARMUP" } },
];

/**
 * Warms every real route, serially, before Playwright's fullyParallel suite
 * starts. Astro's dev server (Vite) discovers and pre-bundles each new
 * SSR-side dependency the first time a route that imports it is requested —
 * a real, one-time re-optimization pass that invalidates the SSR dep cache.
 * When many Playwright workers hit different never-before-seen routes
 * concurrently (their normal mode), that invalidation can race an in-flight
 * request on a *different* route, which then 404s against a dep-cache file
 * Vite just replaced ("...which is in the optimize deps directory. The
 * dependency might be incompatible with the dep optimizer") and gets stuck
 * behind Vite's error overlay, which intercepts every subsequent click for
 * the rest of that test's timeout — this is the confirmed root cause of the
 * CI e2e instability documented in docs/status/KNOWN_RISKS.md. Hitting every
 * route once here, one at a time, before any parallel worker starts forces
 * that one-time discovery to happen outside the race window.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  // This entire warmup exists solely to work around Astro dev's (Vite's)
  // SSR dependency-optimizer race under *concurrent* Playwright workers —
  // see the class comment above. Required CI (ci.yml's browser-smoke job,
  // and scripts/verify-push.sh) now runs against a genuinely built,
  // pre-bundled Worker (wrangler dev --local against
  // apps/web/dist/server/wrangler.json, no Vite dev-server involved at all)
  // with a single worker (playwright.config.ts's workers: 1 in CI) — neither
  // condition this warmup exists for is present. Confirmed empirically this
  // warmup is not just unnecessary but actively harmful against that target:
  // its `/api/auth/login/begin` warmup POST reproducibly crashed
  // `wrangler dev --local` outright (see docs/status/KNOWN_RISKS.md).
  // Skipped whenever CI is set; still runs for local ad hoc `pnpm test:e2e`
  // against astro dev, where it remains genuinely needed.
  if (process.env.CI) return;

  const baseURL =
    process.env.PLAYWRIGHT_BASE_URL ?? config.projects[0]?.use?.baseURL ?? "http://localhost:4321";

  let sitemapRoutes: string[] = [];
  try {
    const response = await fetch(new URL("/sitemap.xml", baseURL));
    if (response.ok) {
      const xml = await response.text();
      sitemapRoutes = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
        (match) => new URL(match[1]!).pathname,
      );
    }
  } catch {
    // The real readiness check (webServer/wait-on) already guarantees the
    // server is up before this runs; a missing sitemap here just means
    // fewer routes get pre-warmed, not a hard failure of the test run.
  }

  const routes = [...new Set([...sitemapRoutes, ...EXTRA_ROUTES])];
  for (const route of routes) {
    try {
      await fetch(new URL(route, baseURL));
    } catch {
      // Best-effort warmup — see comment above.
    }
  }

  for (const { path, body } of API_WARMUP_REQUESTS) {
    try {
      await fetch(new URL(path, baseURL), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      // Best-effort warmup — see comment above. A 4xx/5xx response here is
      // fine and expected (the body is deliberately not a real ceremony);
      // what matters is that the route's module graph gets loaded once,
      // serially, before any parallel worker starts.
    }
  }
}
