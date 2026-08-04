import { describe, expect, it } from "vitest";
import { isSafeRelativeRedirect } from "./safe-redirect";

describe("isSafeRelativeRedirect", () => {
  it("accepts a plain internal relative path", () => {
    expect(isSafeRelativeRedirect("/app/continue")).toBe(true);
    expect(isSafeRelativeRedirect("/app/continue?continuation=abc-123")).toBe(true);
    expect(isSafeRelativeRedirect("/audit/some-uuid")).toBe(true);
  });

  it("rejects null/undefined/empty", () => {
    expect(isSafeRelativeRedirect(null)).toBe(false);
    expect(isSafeRelativeRedirect(undefined)).toBe(false);
    expect(isSafeRelativeRedirect("")).toBe(false);
  });

  it("rejects an absolute external URL", () => {
    expect(isSafeRelativeRedirect("https://evil.example/")).toBe(false);
    expect(isSafeRelativeRedirect("http://evil.example/")).toBe(false);
  });

  it("rejects a protocol-relative URL", () => {
    expect(isSafeRelativeRedirect("//evil.example/")).toBe(false);
  });

  it("rejects a backslash-based scheme trick", () => {
    expect(isSafeRelativeRedirect("/\\evil.example")).toBe(false);
    expect(isSafeRelativeRedirect("\\\\evil.example")).toBe(false);
  });

  it("rejects a javascript: URL", () => {
    expect(isSafeRelativeRedirect("javascript:alert(1)")).toBe(false);
  });

  it("rejects a path not starting with a single slash", () => {
    expect(isSafeRelativeRedirect("app/continue")).toBe(false);
    expect(isSafeRelativeRedirect("evil.example/app")).toBe(false);
  });

  it("rejects an excessively long value", () => {
    expect(isSafeRelativeRedirect("/" + "a".repeat(600))).toBe(false);
  });

  it("rejects an encoded external redirect attempt", () => {
    expect(isSafeRelativeRedirect("/%2F%2Fevil.example")).toBe(true); // decodes to a path segment, not a real redirect
    expect(isSafeRelativeRedirect("https:evil.example")).toBe(false);
  });
});
