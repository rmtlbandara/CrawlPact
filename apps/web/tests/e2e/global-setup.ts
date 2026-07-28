import type { FullConfig } from "@playwright/test";

/**
 * Routes not listed in /sitemap.xml (noindex: sign-in, the authenticated
 * app shell, the Paddle payment-link host, admin) but which still pull in
 * heavy client-only dependencies (@simplewebauthn/browser, @paddle/paddle-js)
 * the SSR dev server has never resolved before.
 */
const EXTRA_ROUTES = ["/sign-in", "/pay", "/app", "/app/billing", "/app/account", "/admin"];

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
}
