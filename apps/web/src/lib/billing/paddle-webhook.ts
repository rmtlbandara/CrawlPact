/**
 * Paddle Billing webhook signature verification (SRS §27, Part 2 Step 17).
 *
 * Paddle signs each webhook with a `Paddle-Signature` header shaped like
 * `ts=<unix_seconds>;h1=<hex hmac>`, where the HMAC-SHA256 is computed over
 * `${ts}:${rawRequestBody}` using the notification destination's secret.
 * This MUST run against the raw, unparsed request body — re-serialising
 * JSON before verifying would silently break on any whitespace/key-order
 * difference and is a common way to accidentally defeat this check.
 *
 * Verified against Paddle's publicly documented signing scheme, the
 * self-generated-HMAC tests in `paddle-webhook.test.ts`, and — as of
 * 2026-07-28 — real signatures on real Paddle-originated webhook traffic
 * delivered to production via Paddle's webhook simulator (see
 * docs/status/PADDLE_WEBHOOK_LIVE_DELIVERY_VERIFICATION.md).
 */

const MAX_SIGNATURE_AGE_SECONDS = 5 * 60;

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function parseSignatureHeader(header: string): { ts: string; h1: string } | null {
  const parts = Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim().split("="))
      .filter((pair): pair is [string, string] => pair.length === 2),
  );
  if (!parts.ts || !parts.h1) return null;
  return { ts: parts.ts, h1: parts.h1 };
}

export type VerifyWebhookResult =
  | { valid: true }
  | {
      valid: false;
      reason: "missing_header" | "malformed_header" | "signature_mismatch" | "stale_timestamp";
    };

export async function verifyPaddleWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  now: Date = new Date(),
): Promise<VerifyWebhookResult> {
  if (!signatureHeader) return { valid: false, reason: "missing_header" };

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return { valid: false, reason: "malformed_header" };

  const tsSeconds = Number(parsed.ts);
  if (!Number.isFinite(tsSeconds)) return { valid: false, reason: "malformed_header" };
  if (Math.abs(now.getTime() / 1000 - tsSeconds) > MAX_SIGNATURE_AGE_SECONDS) {
    return { valid: false, reason: "stale_timestamp" };
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${parsed.ts}:${rawBody}`),
  );
  const computedHex = Array.from(new Uint8Array(signatureBytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");

  if (!timingSafeEqualHex(computedHex, parsed.h1))
    return { valid: false, reason: "signature_mismatch" };
  return { valid: true };
}
