import { validateTarget } from "./target-validation";
import type { TargetValidationOptions } from "./target-validation";

export const SCANNER_USER_AGENT = "CrawlPactAuditBot/1.0 (+https://crawlpact.com/scanner)";

export type FetchFailureCategory =
  | "unsafe_target"
  | "dns"
  | "connection_failed"
  | "timeout"
  | "too_many_redirects"
  | "redirect_loop"
  | "unsafe_redirect_target"
  | "size_limit_exceeded"
  | "unknown";

export type SafeFetchSuccess = {
  ok: true;
  requestedUrl: string;
  finalUrl: string;
  statusCode: number;
  contentType: string | null;
  headers: Record<string, string>;
  body: string;
  contentSizeBytes: number;
  redirectCount: number;
  durationMs: number;
  truncated: boolean;
};

export type SafeFetchFailure = {
  ok: false;
  requestedUrl: string;
  finalUrl: string | null;
  errorCategory: FetchFailureCategory;
  message: string;
  redirectCount: number;
  durationMs: number;
};

export type SafeFetchResult = SafeFetchSuccess | SafeFetchFailure;

export type SafeFetchOptions = TargetValidationOptions & {
  maxRedirects?: number;
  maxBodyBytes?: number;
  maxHeaderBytes?: number;
  timeoutMs?: number;
};

const DEFAULTS = {
  maxRedirects: 5,
  maxBodyBytes: 2_097_152, // 2 MiB, matches the seeded runtime_configuration default
  maxHeaderBytes: 32_768,
  timeoutMs: 20_000,
};

function categoriseThrown(error: unknown): FetchFailureCategory {
  if (error instanceof DOMException && error.name === "AbortError") return "timeout";
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (
    message.includes("dns") ||
    message.includes("enotfound") ||
    message.includes("could not resolve")
  ) {
    return "dns";
  }
  return "connection_failed";
}

async function readBoundedBody(
  response: Response,
  maxBodyBytes: number,
): Promise<{ text: string; sizeBytes: number; truncated: boolean }> {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    const bytes = new TextEncoder().encode(text);
    const truncated = bytes.byteLength > maxBodyBytes;
    return {
      text: truncated ? new TextDecoder().decode(bytes.slice(0, maxBodyBytes)) : text,
      sizeBytes: Math.min(bytes.byteLength, maxBodyBytes),
      truncated,
    };
  }

  const chunks: Uint8Array[] = [];
  let received = 0;
  let truncated = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      received += value.byteLength;
      if (received > maxBodyBytes) {
        const allowed = maxBodyBytes - (received - value.byteLength);
        if (allowed > 0) chunks.push(value.slice(0, allowed));
        truncated = true;
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
  }

  const combined = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return {
    text: new TextDecoder("utf-8", { fatal: false }).decode(combined),
    sizeBytes: combined.byteLength,
    truncated,
  };
}

function headersToBoundedRecord(headers: Headers, maxBytes: number): Record<string, string> {
  const result: Record<string, string> = {};
  let used = 0;
  for (const [key, value] of headers.entries()) {
    used += key.length + value.length;
    if (used > maxBytes) break;
    result[key] = value;
  }
  return result;
}

/**
 * The single chokepoint for fetching a customer-supplied target (ADR-0005).
 * Every hop (initial request and each redirect) is independently validated
 * via `validateTarget` before a request is issued. Never call the platform
 * `fetch()` on a customer-supplied URL anywhere else in the codebase.
 */
export async function safeFetch(
  targetUrl: string,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const maxRedirects = options.maxRedirects ?? DEFAULTS.maxRedirects;
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULTS.maxBodyBytes;
  const maxHeaderBytes = options.maxHeaderBytes ?? DEFAULTS.maxHeaderBytes;
  const timeoutMs = options.timeoutMs ?? DEFAULTS.timeoutMs;

  const startedAt = Date.now();
  const visited = new Set<string>();
  let currentUrl = targetUrl;
  let redirectCount = 0;

  while (true) {
    const validation = await validateTarget(currentUrl, options);
    if (!validation.safe) {
      return {
        ok: false,
        requestedUrl: targetUrl,
        finalUrl: redirectCount > 0 ? currentUrl : null,
        errorCategory: redirectCount > 0 ? "unsafe_redirect_target" : "unsafe_target",
        message: validation.detail,
        redirectCount,
        durationMs: Date.now() - startedAt,
      };
    }

    if (visited.has(currentUrl)) {
      return {
        ok: false,
        requestedUrl: targetUrl,
        finalUrl: currentUrl,
        errorCategory: "redirect_loop",
        message: `Redirect loop detected at "${currentUrl}".`,
        redirectCount,
        durationMs: Date.now() - startedAt,
      };
    }
    visited.add(currentUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        headers: { "User-Agent": SCANNER_USER_AGENT, Accept: "text/plain, text/html, */*" },
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeout);
      return {
        ok: false,
        requestedUrl: targetUrl,
        finalUrl: currentUrl,
        errorCategory: categoriseThrown(error),
        message: error instanceof Error ? error.message : "The request failed.",
        redirectCount,
        durationMs: Date.now() - startedAt,
      };
    }
    clearTimeout(timeout);

    const isRedirect =
      response.status >= 300 && response.status < 400 && response.headers.has("location");
    if (isRedirect) {
      redirectCount += 1;
      if (redirectCount > maxRedirects) {
        return {
          ok: false,
          requestedUrl: targetUrl,
          finalUrl: currentUrl,
          errorCategory: "too_many_redirects",
          message: `Exceeded the maximum of ${maxRedirects} redirects.`,
          redirectCount,
          durationMs: Date.now() - startedAt,
        };
      }
      const location = response.headers.get("location")!;
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    const { text, sizeBytes, truncated } = await readBoundedBody(response, maxBodyBytes);

    return {
      ok: true,
      requestedUrl: targetUrl,
      finalUrl: currentUrl,
      statusCode: response.status,
      contentType: response.headers.get("content-type"),
      headers: headersToBoundedRecord(response.headers, maxHeaderBytes),
      body: text,
      contentSizeBytes: sizeBytes,
      redirectCount,
      durationMs: Date.now() - startedAt,
      truncated,
    };
  }
}
