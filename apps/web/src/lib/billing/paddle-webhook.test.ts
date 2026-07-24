import { describe, expect, it } from "vitest";
import { verifyPaddleWebhookSignature } from "./paddle-webhook";

const secret = "whsec_test_secret_value";

async function signBody(body: string, secretValue: string, ts: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretValue),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${ts}:${body}`),
  );
  const hex = Array.from(new Uint8Array(signatureBytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  return `ts=${ts};h1=${hex}`;
}

describe("verifyPaddleWebhookSignature", () => {
  it("accepts a correctly signed payload", async () => {
    const body = JSON.stringify({ event_type: "subscription.created" });
    const now = new Date("2026-01-01T00:00:00Z");
    const header = await signBody(body, secret, Math.floor(now.getTime() / 1000));
    const result = await verifyPaddleWebhookSignature(body, header, secret, now);
    expect(result).toEqual({ valid: true });
  });

  it("rejects a signature computed with the wrong secret", async () => {
    const body = JSON.stringify({ event_type: "subscription.created" });
    const now = new Date("2026-01-01T00:00:00Z");
    const header = await signBody(body, "a-different-secret", Math.floor(now.getTime() / 1000));
    const result = await verifyPaddleWebhookSignature(body, header, secret, now);
    expect(result).toEqual({ valid: false, reason: "signature_mismatch" });
  });

  it("rejects a body that was tampered with after signing", async () => {
    const originalBody = JSON.stringify({ event_type: "subscription.created" });
    const now = new Date("2026-01-01T00:00:00Z");
    const header = await signBody(originalBody, secret, Math.floor(now.getTime() / 1000));
    const tamperedBody = JSON.stringify({ event_type: "subscription.canceled" });
    const result = await verifyPaddleWebhookSignature(tamperedBody, header, secret, now);
    expect(result).toEqual({ valid: false, reason: "signature_mismatch" });
  });

  it("rejects a missing signature header", async () => {
    const result = await verifyPaddleWebhookSignature("{}", null, secret);
    expect(result).toEqual({ valid: false, reason: "missing_header" });
  });

  it("rejects a malformed signature header", async () => {
    const result = await verifyPaddleWebhookSignature("{}", "not-the-right-shape", secret);
    expect(result).toEqual({ valid: false, reason: "malformed_header" });
  });

  it("rejects a stale timestamp outside the replay window", async () => {
    const body = "{}";
    const signedAt = new Date("2026-01-01T00:00:00Z");
    const header = await signBody(body, secret, Math.floor(signedAt.getTime() / 1000));
    const tenMinutesLater = new Date(signedAt.getTime() + 10 * 60 * 1000);
    const result = await verifyPaddleWebhookSignature(body, header, secret, tenMinutesLater);
    expect(result).toEqual({ valid: false, reason: "stale_timestamp" });
  });
});
