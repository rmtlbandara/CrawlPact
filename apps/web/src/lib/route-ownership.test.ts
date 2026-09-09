import { describe, expect, it } from "vitest";
import { isPublicOnlyPath, isSensitivePath } from "./route-ownership";

describe("isPublicOnlyPath — Phase 2 executable form of the route ownership matrix", () => {
  it("classifies the root and marketing pages as public-only", () => {
    for (const path of ["/", "/about", "/about/", "/pricing", "/pricing/", "/contact"]) {
      expect(isPublicOnlyPath(path)).toBe(true);
    }
  });

  it("classifies content-collection prefixes as public-only", () => {
    for (const path of [
      "/crawlers/googlebot",
      "/guides/robots-txt-syntax-basics",
      "/platforms/wordpress",
      "/tools/ai-crawler-checker",
    ]) {
      expect(isPublicOnlyPath(path)).toBe(true);
    }
  });

  it("classifies the anonymous audit surface and /pay as public-only", () => {
    expect(isPublicOnlyPath("/audit")).toBe(true);
    expect(isPublicOnlyPath("/audit/some-audit-id")).toBe(true);
    expect(isPublicOnlyPath("/pay")).toBe(true);
  });

  it("classifies public capability-URL prefixes as public-only", () => {
    expect(isPublicOnlyPath("/shared/some-token")).toBe(true);
    expect(isPublicOnlyPath("/feed/some-token.xml")).toBe(true);
  });

  it("classifies SSR-indexable prefixes (/for/, /research/) as public-only", () => {
    expect(isPublicOnlyPath("/for/some-landing-page")).toBe(true);
    expect(isPublicOnlyPath("/research/some-publication")).toBe(true);
  });

  it("does NOT classify APP_ONLY routes as public-only", () => {
    for (const path of [
      "/sign-in",
      "/app",
      "/app/domains",
      "/app/billing",
      "/admin",
      "/admin/users",
    ]) {
      expect(isPublicOnlyPath(path)).toBe(false);
    }
  });

  it("does NOT classify API routes as public-only (they are handled by their own ownership, not this redirect mechanism)", () => {
    expect(isPublicOnlyPath("/api/audit")).toBe(false);
    expect(isPublicOnlyPath("/api/domains")).toBe(false);
  });

  it("does not confuse /api/audit/* with the public /audit/* page prefix", () => {
    // Regression guard: both start with "/audit"-ish text but only the
    // non-/api one is a public page prefix.
    expect(isPublicOnlyPath("/api/audit/continuation/abc123")).toBe(false);
    expect(isPublicOnlyPath("/audit/abc123")).toBe(true);
  });

  it("is trailing-slash insensitive", () => {
    expect(isPublicOnlyPath("/about")).toBe(isPublicOnlyPath("/about/"));
    expect(isPublicOnlyPath("/crawlers/googlebot")).toBe(isPublicOnlyPath("/crawlers/googlebot/"));
  });
});

describe("isSensitivePath — the narrow unknown-host fail-closed set", () => {
  it("flags admin, api, app, and sign-in", () => {
    expect(isSensitivePath("/admin")).toBe(true);
    expect(isSensitivePath("/admin/users")).toBe(true);
    expect(isSensitivePath("/api/domains")).toBe(true);
    expect(isSensitivePath("/app")).toBe(true);
    expect(isSensitivePath("/app/domains")).toBe(true);
    expect(isSensitivePath("/sign-in")).toBe(true);
  });

  it("does not flag genuinely public or low-stakes routes", () => {
    expect(isSensitivePath("/about")).toBe(false);
    expect(isSensitivePath("/audit/some-id")).toBe(false);
    expect(isSensitivePath("/shared/some-token")).toBe(false);
    expect(isSensitivePath("/dev/components")).toBe(false);
    expect(isSensitivePath("/")).toBe(false);
  });

  it("does not false-positive on a route that merely starts with a similar prefix", () => {
    expect(isSensitivePath("/apparently-fine")).toBe(false);
  });
});
