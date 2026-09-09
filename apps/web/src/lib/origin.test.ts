import { describe, expect, it, vi } from "vitest";

let mockEnv: Partial<Cloudflare.Env>;
vi.mock("./env", () => ({ getEnv: () => mockEnv }));

const {
  getPublicOrigin,
  getAppOrigin,
  getTrustedOrigins,
  isTrustedOrigin,
  classifyOrigin,
  classifyRequestOrigin,
  getValidatedRequestOrigin,
  toPublicUrl,
} = await import("./origin");

describe("lib/origin.ts — trusted CrawlPact origin registry (Phase 2, ADR-0010)", () => {
  describe("getPublicOrigin / getAppOrigin", () => {
    it("returns the public origin derived from PUBLIC_SITE_URL", () => {
      mockEnv = { PUBLIC_SITE_URL: "https://crawlpact.com" };
      expect(getPublicOrigin()).toBe("https://crawlpact.com");
    });

    it("returns null for the app origin when PUBLIC_APP_URL is not configured", () => {
      mockEnv = { PUBLIC_SITE_URL: "https://crawlpact.com" };
      expect(getAppOrigin()).toBeNull();
    });

    it("returns the app origin when PUBLIC_APP_URL is configured", () => {
      mockEnv = {
        PUBLIC_SITE_URL: "https://crawlpact.com",
        PUBLIC_APP_URL: "https://app.crawlpact.com",
      };
      expect(getAppOrigin()).toBe("https://app.crawlpact.com");
    });
  });

  describe("getTrustedOrigins / isTrustedOrigin", () => {
    it("includes only the public origin when no app origin is configured", () => {
      mockEnv = { PUBLIC_SITE_URL: "https://crawlpact.com" };
      expect(getTrustedOrigins()).toEqual(["https://crawlpact.com"]);
      expect(isTrustedOrigin("https://crawlpact.com")).toBe(true);
      expect(isTrustedOrigin("https://app.crawlpact.com")).toBe(false);
    });

    it("includes both origins once PUBLIC_APP_URL is configured", () => {
      mockEnv = {
        PUBLIC_SITE_URL: "https://crawlpact.com",
        PUBLIC_APP_URL: "https://app.crawlpact.com",
      };
      expect(getTrustedOrigins()).toEqual(["https://crawlpact.com", "https://app.crawlpact.com"]);
      expect(isTrustedOrigin("https://app.crawlpact.com")).toBe(true);
    });

    it("never trusts a subdomain suffix or prefix match", () => {
      mockEnv = { PUBLIC_SITE_URL: "https://crawlpact.com" };
      expect(isTrustedOrigin("https://evil.crawlpact.com")).toBe(false);
      expect(isTrustedOrigin("https://crawlpact.com.evil.example")).toBe(false);
      expect(isTrustedOrigin("https://notcrawlpact.com")).toBe(false);
    });

    it("rejects null/undefined/empty", () => {
      mockEnv = { PUBLIC_SITE_URL: "https://crawlpact.com" };
      expect(isTrustedOrigin(null)).toBe(false);
      expect(isTrustedOrigin(undefined)).toBe(false);
      expect(isTrustedOrigin("")).toBe(false);
    });
  });

  describe("classifyOrigin / classifyRequestOrigin", () => {
    const withBothOrigins = () => {
      mockEnv = {
        PUBLIC_SITE_URL: "https://crawlpact.com",
        PUBLIC_APP_URL: "https://app.crawlpact.com",
      };
    };

    it("classifies the public origin", () => {
      withBothOrigins();
      expect(classifyOrigin("https://crawlpact.com")).toBe("public");
    });

    it("classifies the app origin", () => {
      withBothOrigins();
      expect(classifyOrigin("https://app.crawlpact.com")).toBe("app");
    });

    it("classifies an unrecognized origin (e.g. a workers.dev fallback) as unknown", () => {
      withBothOrigins();
      expect(classifyOrigin("https://crawlpact-web.rmtlbandara.workers.dev")).toBe("unknown");
    });

    it("classifies an attacker-controlled origin as unknown", () => {
      withBothOrigins();
      expect(classifyOrigin("https://attacker.example")).toBe("unknown");
    });

    it("classifyRequestOrigin reads the request's Host header, ignoring the unrelated Origin request header", () => {
      withBothOrigins();
      const request = new Request("https://app.crawlpact.com/domains", {
        headers: { Origin: "https://crawlpact.com" },
      });
      expect(classifyRequestOrigin(request)).toBe("app");
    });

    it("classifyRequestOrigin trusts the Host header even when request.url's own host differs (astro dev's local Node server can resolve request.url to a socket address like [::1]:4321 instead of the literal Host the client sent)", () => {
      withBothOrigins();
      const request = new Request("https://[::1]:4321/sign-in", {
        headers: { host: "app.crawlpact.com" },
      });
      expect(classifyRequestOrigin(request)).toBe("app");
    });

    it("classifyRequestOrigin falls back to request.url's own origin when Host is absent", () => {
      withBothOrigins();
      const request = new Request("https://app.crawlpact.com/domains");
      expect(classifyRequestOrigin(request)).toBe("app");
    });
  });

  describe("getValidatedRequestOrigin", () => {
    it("returns the request's own origin when it is trusted", () => {
      mockEnv = {
        PUBLIC_SITE_URL: "https://crawlpact.com",
        PUBLIC_APP_URL: "https://app.crawlpact.com",
      };
      const request = new Request("https://app.crawlpact.com/api/domains", { method: "POST" });
      expect(getValidatedRequestOrigin(request)).toBe("https://app.crawlpact.com");
    });

    it("returns null when the request's own origin is not trusted", () => {
      mockEnv = { PUBLIC_SITE_URL: "https://crawlpact.com" };
      const request = new Request("https://crawlpact-web.rmtlbandara.workers.dev/sign-in", {
        method: "POST",
      });
      expect(getValidatedRequestOrigin(request)).toBeNull();
    });

    it("resolves from the Host header when request.url's own host is a local socket address (astro dev)", () => {
      mockEnv = { PUBLIC_SITE_URL: "https://crawlpact.com" };
      const request = new Request("https://[::1]:4321/sign-in", {
        method: "POST",
        headers: { host: "crawlpact.com" },
      });
      expect(getValidatedRequestOrigin(request)).toBe("https://crawlpact.com");
    });
  });

  describe("toPublicUrl", () => {
    it("builds an absolute URL on the public origin, preserving path and query", () => {
      mockEnv = { PUBLIC_SITE_URL: "https://crawlpact.com" };
      expect(toPublicUrl("/about/", "?x=1")).toBe("https://crawlpact.com/about/?x=1");
    });

    it("defaults to no query string", () => {
      mockEnv = { PUBLIC_SITE_URL: "https://crawlpact.com" };
      expect(toPublicUrl("/")).toBe("https://crawlpact.com/");
    });
  });
});
