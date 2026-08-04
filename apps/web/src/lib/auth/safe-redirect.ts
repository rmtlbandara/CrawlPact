/**
 * Validates a post-authentication redirect destination is a safe, internal, relative path
 * (Phase 5, Anonymous Audit Result and Account-Conversion Flow — the first place this repo ever
 * accepts a client-influenced redirect target; see
 * docs/product/PHASE_05_EXISTING_CONVERSION_FLOW_BASELINE.md §2, "genuinely greenfield").
 *
 * Deliberately conservative: only a same-origin-implied relative path starting with a single `/`
 * is ever accepted. Rejects absolute URLs (any scheme), protocol-relative URLs (`//evil.com`),
 * backslash tricks some browsers normalise to forward slashes (`/\evil.com`), and `javascript:`/
 * other non-navigation schemes. There is no allowlist of specific paths — any well-formed
 * relative path is accepted, since the only realistic caller (the audit-continuation flow) needs
 * to redirect back to an audit report path it doesn't control the exact shape of in advance.
 */
export function isSafeRelativeRedirect(target: string | null | undefined): target is string {
  if (!target) return false;
  if (target.length > 512) return false; // Defensive cap — not a legitimate path length.
  if (!target.startsWith("/")) return false;
  if (target.startsWith("//")) return false; // Protocol-relative.
  if (target.startsWith("/\\")) return false; // Backslash-as-slash browser normalisation trick.
  // Reject any embedded scheme delimiter or control character that could be used to smuggle a
  // second, browser-interpreted URL inside what looks like a path (e.g. "/\t/evil.com",
  // "/%09/evil.com" after decoding). `URL` parsing against a fixed, trusted base origin is the
  // most reliable way to catch this class of trick — if parsing against that base doesn't
  // reproduce the same-origin, same-path result, reject.
  try {
    const base = "https://safe-redirect.internal";
    const parsed = new URL(target, base);
    if (parsed.origin !== base) return false;
    return true;
  } catch {
    return false;
  }
}
