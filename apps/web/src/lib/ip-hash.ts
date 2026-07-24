import { bytesToBase64Url } from "./base64url";
import { getEnv } from "./env";

/**
 * SRS security/privacy rules forbid storing raw client IPs (data
 * minimisation, see docs/security/SSRF_SECURITY_MODEL.md). Every place that
 * needs to correlate requests from "the same caller" (rate limiting,
 * security_events) stores only an HMAC of the IP, keyed by the same secret
 * used for session tokens' signing material — never the IP itself.
 */
export async function hashIp(request: Request): Promise<string | null> {
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip) return null;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getEnv().SESSION_SIGNING_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ip));
  return bytesToBase64Url(new Uint8Array(signature));
}
