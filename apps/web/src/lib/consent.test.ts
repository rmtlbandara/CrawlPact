import { describe, expect, it } from "vitest";
import {
  ANALYTICS_CONSENT_VERSION,
  encodeConsentCookieValue,
  isGaEligibleRoute,
  parseConsentCookieValue,
} from "./consent";

describe("encodeConsentCookieValue / parseConsentCookieValue", () => {
  it("round-trips granted and denied through the current version", () => {
    expect(parseConsentCookieValue(encodeConsentCookieValue("granted"))).toBe("granted");
    expect(parseConsentCookieValue(encodeConsentCookieValue("denied"))).toBe("denied");
  });

  it("treats a missing cookie as no decision", () => {
    expect(parseConsentCookieValue(undefined)).toBeNull();
    expect(parseConsentCookieValue(null)).toBeNull();
    expect(parseConsentCookieValue("")).toBeNull();
  });

  it("treats a malformed value as no decision", () => {
    expect(parseConsentCookieValue("granted")).toBeNull();
    expect(parseConsentCookieValue("maybe.v1")).toBeNull();
    expect(parseConsentCookieValue("granted.v")).toBeNull();
  });

  it("treats a stale version as no decision, re-prompting rather than carrying forward an old value", () => {
    const staleVersion = ANALYTICS_CONSENT_VERSION + 1;
    expect(parseConsentCookieValue(`granted.v${staleVersion}`)).toBeNull();
    const oldVersion = ANALYTICS_CONSENT_VERSION - 1;
    if (oldVersion >= 0) {
      expect(parseConsentCookieValue(`granted.v${oldVersion}`)).toBeNull();
    }
  });
});

describe("isGaEligibleRoute", () => {
  it("allows the exact-match public marketing pages", () => {
    for (const path of [
      "/",
      "/pricing",
      "/about",
      "/methodology",
      "/limitations",
      "/scoring",
      "/changelog",
      "/scanner",
      "/sample-report",
      "/audit",
    ]) {
      expect(isGaEligibleRoute(path)).toBe(true);
    }
  });

  it("allows a trailing-slash form of an allowed exact route", () => {
    expect(isGaEligibleRoute("/pricing/")).toBe(true);
    expect(isGaEligibleRoute("/")).toBe(true);
  });

  it("allows the prefixed content families", () => {
    expect(isGaEligibleRoute("/for/agencies")).toBe(true);
    expect(isGaEligibleRoute("/platforms/cloudflare")).toBe(true);
    expect(isGaEligibleRoute("/crawlers/amazonbot")).toBe(true);
    expect(isGaEligibleRoute("/guides/robots-txt")).toBe(true);
    expect(isGaEligibleRoute("/tools/robots-checker")).toBe(true);
  });

  it("excludes private/low-value routes even though they render inside MarketingLayout", () => {
    for (const path of [
      "/pay",
      "/sign-in",
      "/shared/abc123token",
      "/audit/a1b2c3",
      "/privacy",
      "/terms",
      "/security",
      "/contact",
      "/status",
      "/acceptable-use",
    ]) {
      expect(isGaEligibleRoute(path)).toBe(false);
    }
  });

  it("excludes authenticated/admin routes", () => {
    expect(isGaEligibleRoute("/app/dashboard")).toBe(false);
    expect(isGaEligibleRoute("/admin/analytics")).toBe(false);
  });

  it("excludes an unknown route (allowlist, not a denylist)", () => {
    expect(isGaEligibleRoute("/some/future/page")).toBe(false);
  });
});
