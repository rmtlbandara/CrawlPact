/**
 * A short, human-readable label for a session's raw User-Agent string (SRS §24's
 * "Sessions" list on /app/account). Previously the raw UA string was rendered
 * verbatim — e.g. "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)
 * AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.7922.34
 * Safari/537.36" — which wraps across 5+ lines on a narrow viewport and gives a
 * non-technical user nothing scannable. This is a best-effort summary, not a
 * full UA-parsing library: unrecognised strings fall back to a short, safely
 * truncated form rather than guessing.
 */

const BROWSER_PATTERNS: { label: string; pattern: RegExp }[] = [
  // Order matters: Edge and OPR embed "Chrome" in their own UA string, and
  // most other Chromium-based browsers embed "Safari" — the more specific
  // token must be checked first.
  { label: "Edge", pattern: /Edg\// },
  { label: "Opera", pattern: /OPR\// },
  { label: "Chrome", pattern: /Chrome\/|HeadlessChrome\// },
  { label: "Firefox", pattern: /Firefox\// },
  { label: "Safari", pattern: /Safari\// },
];

const OS_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: "iOS", pattern: /iPhone|iPad|iPod/ },
  { label: "Android", pattern: /Android/ },
  { label: "macOS", pattern: /Mac OS X|Macintosh/ },
  { label: "Windows", pattern: /Windows/ },
  { label: "Linux", pattern: /Linux/ },
  { label: "Chrome OS", pattern: /CrOS/ },
];

const FALLBACK_MAX_LENGTH = 60;

export function summarizeUserAgent(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";

  const browser = BROWSER_PATTERNS.find((entry) => entry.pattern.test(userAgent))?.label;
  const os = OS_PATTERNS.find((entry) => entry.pattern.test(userAgent))?.label;

  if (browser && os) return `${browser} on ${os}`;
  if (browser) return browser;
  if (os) return `Unknown browser on ${os}`;

  return userAgent.length > FALLBACK_MAX_LENGTH
    ? `${userAgent.slice(0, FALLBACK_MAX_LENGTH)}…`
    : userAgent;
}
