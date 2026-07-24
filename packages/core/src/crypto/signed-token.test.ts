import { describe, expect, it } from "vitest";
import { signToken, verifyToken } from "./signed-token";

const secret = "test-secret-value-at-least-16-bytes-long";

describe("signed-token", () => {
  it("round-trips a payload", async () => {
    const token = await signToken({ challenge: "abc123" }, secret, 60);
    const result = await verifyToken<{ challenge: string }>(token, secret);
    expect(result).toEqual({ valid: true, payload: { challenge: "abc123" } });
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signToken({ challenge: "abc123" }, secret, 60);
    const result = await verifyToken(token, "a-completely-different-secret-value");
    expect(result).toEqual({ valid: false, reason: "signature_mismatch" });
  });

  it("rejects a tampered payload", async () => {
    const token = await signToken({ challenge: "abc123" }, secret, 60);
    const [body, signature] = token.split(".");
    const tampered = `${body}x.${signature}`;
    const result = await verifyToken(tampered, secret);
    expect(result.valid).toBe(false);
  });

  it("rejects a malformed token", async () => {
    const result = await verifyToken("not-a-real-token", secret);
    expect(result).toEqual({ valid: false, reason: "malformed" });
  });

  it("rejects an expired token", async () => {
    const token = await signToken({ challenge: "abc123" }, secret, -1);
    const result = await verifyToken(token, secret);
    expect(result).toEqual({ valid: false, reason: "expired" });
  });

  it("produces a URL-safe token (no +, /, or = characters)", async () => {
    const token = await signToken(
      { challenge: "abc123", extra: "data-with-slashes///" },
      secret,
      60,
    );
    expect(token).not.toMatch(/[+/=]/);
  });
});
