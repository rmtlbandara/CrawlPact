import { describe, expect, it } from "vitest";
import { normalizeTarget } from "./normalize";

describe("normalizeTarget", () => {
  it("accepts a bare domain and defaults to https", () => {
    const result = normalizeTarget("example.com");
    expect(result).toEqual({
      ok: true,
      originalInput: "example.com",
      normalizedOrigin: "https://example.com",
      hostname: "example.com",
    });
  });

  it("lowercases the hostname", () => {
    const result = normalizeTarget("Example.COM");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.hostname).toBe("example.com");
  });

  it("preserves an explicit http scheme", () => {
    const result = normalizeTarget("http://example.com");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.normalizedOrigin).toBe("http://example.com");
  });

  it("strips a default https port", () => {
    const result = normalizeTarget("https://example.com:443/path");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.normalizedOrigin).toBe("https://example.com");
  });

  it("keeps a non-default port", () => {
    const result = normalizeTarget("https://example.com:8443");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.normalizedOrigin).toBe("https://example.com:8443");
  });

  it("strips a trailing dot from the hostname", () => {
    const result = normalizeTarget("example.com.");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.hostname).toBe("example.com");
  });

  it("rejects empty input", () => {
    const result = normalizeTarget("   ");
    expect(result).toMatchObject({ ok: false, reason: "empty" });
  });

  it.each([
    "file:///etc/passwd",
    "ftp://example.com",
    "javascript:alert(1)",
    "mailto:a@b.com",
    "data:text/plain,hi",
    "ws://example.com",
    "wss://example.com",
  ])("rejects unsupported scheme: %s", (input) => {
    const result = normalizeTarget(input);
    expect(result).toMatchObject({ ok: false, reason: "unsupported_scheme" });
  });

  it("rejects a literal IPv4 target", () => {
    const result = normalizeTarget("http://192.168.1.1");
    expect(result).toMatchObject({ ok: false, reason: "literal_ip" });
  });

  it("rejects a literal IPv6 target", () => {
    const result = normalizeTarget("http://[::1]");
    expect(result).toMatchObject({ ok: false, reason: "literal_ip" });
  });

  it("accepts a URL with a path and query", () => {
    const result = normalizeTarget("example.com/path?query=1");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.normalizedOrigin).toBe("https://example.com");
  });

  it("handles internationalised domain names via punycode", () => {
    const result = normalizeTarget("münchen.example");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.hostname).toBe("xn--mnchen-3ya.example");
  });
});
