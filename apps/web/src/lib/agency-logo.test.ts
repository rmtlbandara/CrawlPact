import { describe, expect, it } from "vitest";
import {
  buildLogoObjectKey,
  buildLogoServingPath,
  detectImageType,
  logoPathBelongsToUser,
  toLogoDisplayUrl,
} from "./agency-logo";

describe("detectImageType", () => {
  it("detects a real PNG by its magic bytes", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    expect(detectImageType(png)).toEqual({ ext: "png", contentType: "image/png" });
  });

  it("detects a real JPEG by its magic bytes", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
    expect(detectImageType(jpeg)).toEqual({ ext: "jpg", contentType: "image/jpeg" });
  });

  it("detects a real GIF87a/GIF89a by its magic bytes", () => {
    const gif89a = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 2]);
    expect(detectImageType(gif89a)).toEqual({ ext: "gif", contentType: "image/gif" });
  });

  it("detects a real WebP (RIFF....WEBP) by its magic bytes", () => {
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 1, 2]);
    expect(detectImageType(webp)).toEqual({ ext: "webp", contentType: "image/webp" });
  });

  it("rejects an SVG (no binary magic bytes, an XSS risk if accepted)", () => {
    const svg = new TextEncoder().encode('<svg onload="alert(1)"></svg>');
    expect(detectImageType(svg)).toBeNull();
  });

  it("rejects a file whose bytes don't match any known image format", () => {
    expect(detectImageType(new Uint8Array([1, 2, 3, 4, 5]))).toBeNull();
  });

  it("rejects a spoofed Content-Type with no matching real bytes", () => {
    // A client could claim `Content-Type: image/png` on any payload — this
    // function must never trust that header, only the real bytes.
    const notActuallyPng = new TextEncoder().encode("<script>alert(1)</script>");
    expect(detectImageType(notActuallyPng)).toBeNull();
  });

  it("rejects a truncated file too short to contain a full magic-byte signature", () => {
    expect(detectImageType(new Uint8Array([0x89, 0x50]))).toBeNull();
  });
});

describe("buildLogoObjectKey / buildLogoServingPath", () => {
  it("scopes the object key under the given user id and produces a distinct id each call", () => {
    const keyA = buildLogoObjectKey("user-1", "png");
    const keyB = buildLogoObjectKey("user-1", "png");
    expect(keyA).toMatch(/^user-1\/[0-9a-f-]+\.png$/);
    expect(keyA).not.toBe(keyB);
  });

  it("builds a serving path that matches the shared AGENCY_LOGO_PATH_PATTERN shape", () => {
    const key = buildLogoObjectKey("user-1", "webp");
    expect(buildLogoServingPath(key)).toBe(`/api/agency-branding/logo/${key}`);
  });
});

describe("logoPathBelongsToUser", () => {
  it("accepts a path whose user-id segment matches the caller", () => {
    const path = buildLogoServingPath(buildLogoObjectKey("user-1", "png"));
    expect(logoPathBelongsToUser(path, "user-1")).toBe(true);
  });

  it("rejects a path belonging to a different user", () => {
    const path = buildLogoServingPath(buildLogoObjectKey("user-1", "png"));
    expect(logoPathBelongsToUser(path, "user-2")).toBe(false);
  });

  it("rejects a malformed path that doesn't match the pattern at all", () => {
    expect(logoPathBelongsToUser("/api/agency-branding/logo/not-a-real-path", "user-1")).toBe(
      false,
    );
  });
});

describe("toLogoDisplayUrl — Phase 4 fix: PUBLIC_ONLY asset display from APP_ONLY UI", () => {
  it("builds an absolute public-origin URL from the stored relative path", () => {
    const stored = buildLogoServingPath(buildLogoObjectKey("user-1", "png"));
    expect(toLogoDisplayUrl("https://crawlpact.com", stored)).toBe(
      `https://crawlpact.com${stored}`,
    );
  });

  it("does not alter the stored path's own shape (still validates against the same pattern helpers)", () => {
    const stored = buildLogoServingPath(buildLogoObjectKey("user-1", "png"));
    const displayUrl = toLogoDisplayUrl("https://crawlpact.com", stored);
    // The display URL is for <img src> only — anything that validates or
    // parses the *stored* value must keep using the original relative
    // path, never the absolute display URL.
    expect(logoPathBelongsToUser(stored, "user-1")).toBe(true);
    expect(displayUrl).not.toBe(stored);
    expect(displayUrl.endsWith(stored)).toBe(true);
  });

  it("works identically regardless of which environment's public origin is passed", () => {
    const stored = "/api/agency-branding/logo/user-1/abc123.png";
    expect(toLogoDisplayUrl("https://preview.crawlpact.com", stored)).toBe(
      "https://preview.crawlpact.com/api/agency-branding/logo/user-1/abc123.png",
    );
    expect(toLogoDisplayUrl("http://localhost:4321", stored)).toBe(
      "http://localhost:4321/api/agency-branding/logo/user-1/abc123.png",
    );
  });
});
