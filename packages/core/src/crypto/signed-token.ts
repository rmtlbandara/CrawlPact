/**
 * Generic signed, expiring token — HMAC-SHA256 over a JSON payload using
 * the Web Crypto API (available in both Node 20+ and the Cloudflare
 * Workers runtime, so this has zero extra dependencies and runs
 * identically in tests and production).
 *
 * Used for two distinct purposes that both need "prove this value round-
 * tripped through the client unmodified within a short window, without a
 * database lookup": WebAuthn ceremony challenges (ADR-0004) and, in
 * principle, other short-lived stateless exchanges. Session cookies are
 * NOT built on this — sessions are deliberately DB-backed for revocation
 * (ADR-0004), this is only for ephemeral round-trip values.
 */

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of array) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function signToken(
  payload: unknown,
  secret: string,
  ttlSeconds: number,
): Promise<string> {
  const body = { payload, expiresAt: Date.now() + ttlSeconds * 1000 };
  const bodyJson = JSON.stringify(body);
  const bodyEncoded = toBase64Url(new TextEncoder().encode(bodyJson));
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(bodyEncoded));
  return `${bodyEncoded}.${toBase64Url(signature)}`;
}

export type VerifyTokenResult<T> =
  | { valid: true; payload: T }
  | { valid: false; reason: "malformed" | "signature_mismatch" | "expired" };

export async function verifyToken<T>(token: string, secret: string): Promise<VerifyTokenResult<T>> {
  const parts = token.split(".");
  if (parts.length !== 2) return { valid: false, reason: "malformed" };
  const [bodyEncoded, signatureEncoded] = parts as [string, string];

  const key = await hmacKey(secret);
  const signatureValid = await crypto.subtle.verify(
    "HMAC",
    key,
    fromBase64Url(signatureEncoded),
    new TextEncoder().encode(bodyEncoded),
  );
  if (!signatureValid) return { valid: false, reason: "signature_mismatch" };

  let body: { payload: T; expiresAt: number };
  try {
    body = JSON.parse(new TextDecoder().decode(fromBase64Url(bodyEncoded)));
  } catch {
    return { valid: false, reason: "malformed" };
  }

  if (Date.now() > body.expiresAt) return { valid: false, reason: "expired" };
  return { valid: true, payload: body.payload };
}
