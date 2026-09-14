import { describe, expect, it, vi } from "vitest";

let mockEnv: { PUBLIC_SITE_URL: string; PUBLIC_APP_URL?: string };
vi.mock("./env", () => ({ getEnv: () => mockEnv }));

const { resolveLegacyAppRedirectTarget, LEGACY_REDIRECT_STATUS } =
  await import("./legacy-redirect");

describe("legacy-redirect.ts — Phase 4 apex→app redirect targets", () => {
  const withBothOrigins = () => {
    mockEnv = {
      PUBLIC_SITE_URL: "https://crawlpact.com",
      PUBLIC_APP_URL: "https://app.crawlpact.com",
    };
  };

  it("is Stage B (308 Permanent Redirect) — see legacy-redirect.ts's doc comment for the two-stage plan", () => {
    expect(LEGACY_REDIRECT_STATUS).toBe(308);
  });

  describe("/sign-in", () => {
    it("preserves a valid continuation parameter", () => {
      withBothOrigins();
      expect(resolveLegacyAppRedirectTarget("/sign-in", "?continuation=abc-123")).toBe(
        "https://app.crawlpact.com/sign-in?continuation=abc-123",
      );
    });

    it("drops an oversized continuation value rather than forwarding it", () => {
      withBothOrigins();
      const target = resolveLegacyAppRedirectTarget("/sign-in", `?continuation=${"x".repeat(200)}`);
      expect(target).toBe("https://app.crawlpact.com/sign-in");
    });

    it("preserves a valid plan+interval pair", () => {
      withBothOrigins();
      expect(resolveLegacyAppRedirectTarget("/sign-in", "?plan=pro&interval=year")).toBe(
        "https://app.crawlpact.com/sign-in?plan=pro&interval=year",
      );
    });

    it("drops an invalid plan value", () => {
      withBothOrigins();
      expect(resolveLegacyAppRedirectTarget("/sign-in", "?plan=not-a-real-plan")).toBe(
        "https://app.crawlpact.com/sign-in",
      );
    });

    it("drops interval when plan is missing or invalid, but keeps plan when interval is invalid", () => {
      withBothOrigins();
      expect(resolveLegacyAppRedirectTarget("/sign-in", "?interval=year")).toBe(
        "https://app.crawlpact.com/sign-in",
      );
      expect(resolveLegacyAppRedirectTarget("/sign-in", "?plan=pro&interval=decade")).toBe(
        "https://app.crawlpact.com/sign-in?plan=pro",
      );
    });

    it("never forwards an unrecognized query parameter", () => {
      withBothOrigins();
      expect(
        resolveLegacyAppRedirectTarget(
          "/sign-in",
          "?continuation=abc&redirect_uri=https://evil.example&access_token=x",
        ),
      ).toBe("https://app.crawlpact.com/sign-in?continuation=abc");
    });

    it("continuation takes priority over plan (never both at once, matching sign-in.astro's own precedence)", () => {
      withBothOrigins();
      // Both would validate individually, but only continuation should survive —
      // matching sign-in.astro's existing precedence (a live continuation always wins).
      const target = resolveLegacyAppRedirectTarget(
        "/sign-in",
        "?continuation=abc&plan=pro&interval=year",
      );
      const params = new URL(target).searchParams;
      expect(params.get("continuation")).toBe("abc");
    });

    it("produces no trailing '?' when nothing survives filtering", () => {
      withBothOrigins();
      expect(resolveLegacyAppRedirectTarget("/sign-in", "?utm_source=newsletter")).toBe(
        "https://app.crawlpact.com/sign-in",
      );
    });
  });

  describe("/app/** and /admin/**", () => {
    it("preserves the exact path with no de-prefixing", () => {
      withBothOrigins();
      expect(resolveLegacyAppRedirectTarget("/app", "")).toBe("https://app.crawlpact.com/app");
      expect(resolveLegacyAppRedirectTarget("/app/domains/abc123", "")).toBe(
        "https://app.crawlpact.com/app/domains/abc123",
      );
      expect(resolveLegacyAppRedirectTarget("/admin", "")).toBe("https://app.crawlpact.com/admin");
      expect(resolveLegacyAppRedirectTarget("/admin/users/abc123", "")).toBe(
        "https://app.crawlpact.com/admin/users/abc123",
      );
    });

    it("preserves the full query string unfiltered (source-reviewed: no sensitive param exists on these routes)", () => {
      withBothOrigins();
      expect(resolveLegacyAppRedirectTarget("/app/domains", "?page=2&sort=name")).toBe(
        "https://app.crawlpact.com/app/domains?page=2&sort=name",
      );
    });
  });
});
