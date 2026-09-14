import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse as parseJsonc } from "jsonc-parser";
import { describe, expect, it } from "vitest";

/**
 * Phase 4 Stage A (2026-09-14, controlled production cutover): Preview's
 * two-host topology now mirrors Production's exactly —
 * `preview.crawlpact.com` (public) + `app.preview.crawlpact.com`
 * (application), both real Cloudflare Custom Domains attached to
 * `crawlpact-web-preview`. This guards the *source* config (`routes`) that
 * makes that topology real against silent drift — Wrangler is the source of
 * truth here, not the dashboard alone (same convention this repo already
 * uses for `assets`/`observability`, see those blocks' own doc comments).
 *
 * Does not replace live verification (the actual Cloudflare Custom Domain
 * attachment, DNS/TLS health, and real HTTP routing) — see
 * docs/baseline/2026-09-14-app-subdomain-phase4/PREVIEW_VALIDATION.md for
 * that evidence. This test only proves the *committed config* declares the
 * intended topology and that Production's own routing is untouched.
 */
describe("wrangler.jsonc Preview two-host Custom Domain topology", () => {
  const configPath = fileURLToPath(new URL("../wrangler.jsonc", import.meta.url));
  const config = parseJsonc(readFileSync(configPath, "utf-8")) as {
    routes?: unknown;
    vars?: { PUBLIC_SITE_URL?: string; PUBLIC_APP_URL?: string };
    env?: {
      preview?: {
        routes?: Array<{ pattern?: string; custom_domain?: boolean }>;
        vars?: { PUBLIC_SITE_URL?: string; PUBLIC_APP_URL?: string; WEBAUTHN_RP_ID?: string };
      };
    };
  };

  it("declares both Preview Custom Domains", () => {
    const patterns = config.env?.preview?.routes?.map((r) => r.pattern);
    expect(patterns).toContain("preview.crawlpact.com");
    expect(patterns).toContain("app.preview.crawlpact.com");
  });

  it("marks both Preview routes as real Custom Domains, not plain Worker Routes", () => {
    for (const route of config.env?.preview?.routes ?? []) {
      expect(route.custom_domain).toBe(true);
    }
  });

  it("does not add a wildcard or path-scoped route (whole-hostname Custom Domains only)", () => {
    for (const route of config.env?.preview?.routes ?? []) {
      expect(route.pattern).not.toMatch(/[*/]/);
    }
  });

  it("Preview's PUBLIC_APP_URL matches the newly-attached Custom Domain exactly", () => {
    expect(config.env?.preview?.vars?.PUBLIC_APP_URL).toBe("https://app.preview.crawlpact.com");
  });

  it("Preview's WEBAUTHN_RP_ID remains a valid registrable-domain-suffix of the app origin (unchanged)", () => {
    expect(config.env?.preview?.vars?.WEBAUTHN_RP_ID).toBe("preview.crawlpact.com");
  });

  it("Production declares no top-level routes key at all (this change is Preview-only)", () => {
    expect(config.routes).toBeUndefined();
  });

  it("Production's vars are completely unaffected by the Preview topology change", () => {
    expect(config.vars?.PUBLIC_SITE_URL).toBe("https://crawlpact.com");
  });
});
