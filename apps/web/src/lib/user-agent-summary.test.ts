import { describe, expect, it } from "vitest";
import { summarizeUserAgent } from "./user-agent-summary";

describe("summarizeUserAgent", () => {
  it("returns a friendly label for a real Chrome-on-macOS UA (the exact test fixture string used by tests/e2e/helpers)", () => {
    expect(
      summarizeUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.7922.34 Safari/537.36",
      ),
    ).toBe("Chrome on macOS");
  });

  it("distinguishes Edge from the Chrome it's built on", () => {
    expect(
      summarizeUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
      ),
    ).toBe("Edge on Windows");
  });

  it("identifies Firefox on Linux", () => {
    expect(
      summarizeUserAgent("Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0"),
    ).toBe("Firefox on Linux");
  });

  it("identifies mobile Safari on iOS", () => {
    expect(
      summarizeUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("Safari on iOS");
  });

  it("falls back to 'Unknown device' for a missing user agent", () => {
    expect(summarizeUserAgent(null)).toBe("Unknown device");
  });

  it("truncates an unrecognised string rather than rendering it in full", () => {
    const weird = "x".repeat(200);
    const result = summarizeUserAgent(weird);
    expect(result.length).toBeLessThan(70);
    expect(result.endsWith("…")).toBe(true);
  });
});
