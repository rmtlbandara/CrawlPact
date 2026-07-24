import { safeFetch } from "./safe-fetch";
import type { SafeFetchOptions, SafeFetchResult } from "./safe-fetch";
import { parseRobotsTxt } from "@crawlpact/robots";
import type { ParsedRobots } from "@crawlpact/robots";
import { parseLlmsTxt } from "./signals/llms-txt";
import type { LlmsTxtResult } from "./signals/llms-txt";
import { validateSitemap } from "./signals/sitemap";
import type { SitemapValidation } from "./signals/sitemap";
import { parseHtmlSignals, parseXRobotsTag } from "./signals/html-signals";
import type { HtmlSignals } from "./signals/html-signals";
import { parseRsl } from "./signals/rsl";
import type { RslDeclaration } from "./signals/rsl";
import { parseContentSignals } from "./signals/content-signals";
import type { ContentSignalsResult } from "./signals/content-signals";

export type ResourceOutcome<T> = {
  attempted: boolean;
  fetch: SafeFetchResult | null;
  parsed: T | null;
};

export type ScanSignals = {
  canonicalOrigin: string;
  robotsTxt: ResourceOutcome<ParsedRobots>;
  llmsTxt: ResourceOutcome<LlmsTxtResult>;
  llmsFullTxt: ResourceOutcome<LlmsTxtResult>;
  sitemap: ResourceOutcome<SitemapValidation>;
  homepage: ResourceOutcome<HtmlSignals>;
  rsl: ResourceOutcome<RslDeclaration>;
  contentSignals: ContentSignalsResult | null;
  xRobotsTag: string[];
  externalRequestCount: number;
};

const MAX_EXTERNAL_REQUESTS = 12;

/** FR-FET-007's "total-scan timeout" — bounds the whole sequence of resource
 * fetches, not just each one individually. Without this, five sequential
 * per-resource timeouts (20s default each) can compound to ~100s for a scan
 * against a slow target, which is both a poor synchronous-request experience
 * and defeats the purpose of a bounded scan. */
const DEFAULT_TOTAL_SCAN_TIMEOUT_MS = 30_000;

export type RunScanOptions = SafeFetchOptions & {
  totalTimeoutMs?: number;
};

/**
 * The scan orchestrator (SRS §14, FR-AUD-002): fetches and parses every
 * bounded resource type for a domain, via the safe-fetch chokepoint only.
 * This module has no knowledge of crawler purposes, presets, or scoring —
 * that evaluation happens in the caller (apps/web) using
 * @crawlpact/robots + @crawlpact/registry + @crawlpact/policy, keeping this
 * package's only job "fetch and parse," per ADR-0005's single-chokepoint
 * design and the project's modularity rule.
 */
export async function runScan(
  canonicalOrigin: string,
  options: RunScanOptions = {},
): Promise<ScanSignals> {
  let externalRequestCount = 0;
  const budgetRemaining = () => externalRequestCount < MAX_EXTERNAL_REQUESTS;

  const totalTimeoutMs = options.totalTimeoutMs ?? DEFAULT_TOTAL_SCAN_TIMEOUT_MS;
  const deadline = Date.now() + totalTimeoutMs;

  async function attempt(url: string): Promise<SafeFetchResult | null> {
    if (!budgetRemaining()) return null;
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) return null;
    externalRequestCount += 1;
    const perFetchTimeoutMs = Math.min(options.timeoutMs ?? remainingMs, remainingMs);
    return safeFetch(url, { ...options, timeoutMs: perFetchTimeoutMs });
  }

  const robotsFetch = await attempt(new URL("/robots.txt", canonicalOrigin).toString());
  const robotsParsed = robotsFetch?.ok ? parseRobotsTxt(robotsFetch.body) : null;

  const robotsTxt: ResourceOutcome<ParsedRobots> = {
    attempted: robotsFetch !== null,
    fetch: robotsFetch,
    parsed: robotsParsed,
  };

  const sitemapUrlFromRobots = robotsParsed?.sitemaps.find((s) => s.valid)?.value ?? null;
  const sitemapUrl = sitemapUrlFromRobots ?? new URL("/sitemap.xml", canonicalOrigin).toString();
  const sitemapFetch = await attempt(sitemapUrl);
  const sitemap: ResourceOutcome<SitemapValidation> = {
    attempted: sitemapFetch !== null,
    fetch: sitemapFetch,
    parsed: sitemapFetch?.ok ? validateSitemap(sitemapFetch.body) : null,
  };

  const llmsFetch = await attempt(new URL("/llms.txt", canonicalOrigin).toString());
  const llmsTxt: ResourceOutcome<LlmsTxtResult> = {
    attempted: llmsFetch !== null,
    fetch: llmsFetch,
    parsed: llmsFetch?.ok ? parseLlmsTxt(llmsFetch.body) : null,
  };

  const llmsFullFetch = await attempt(new URL("/llms-full.txt", canonicalOrigin).toString());
  const llmsFullTxt: ResourceOutcome<LlmsTxtResult> = {
    attempted: llmsFullFetch !== null,
    fetch: llmsFullFetch,
    parsed: llmsFullFetch?.ok ? parseLlmsTxt(llmsFullFetch.body) : null,
  };

  const homepageFetch = await attempt(canonicalOrigin);
  const homepage: ResourceOutcome<HtmlSignals> = {
    attempted: homepageFetch !== null,
    fetch: homepageFetch,
    parsed: homepageFetch?.ok ? parseHtmlSignals(homepageFetch.body) : null,
  };

  const xRobotsTag = homepageFetch?.ok
    ? parseXRobotsTag(homepageFetch.headers["x-robots-tag"] ?? null)
    : [];
  const contentSignalsHeader = homepageFetch?.ok
    ? (homepageFetch.headers["content-signal"] ?? null)
    : null;
  const contentSignals = contentSignalsHeader ? parseContentSignals(contentSignalsHeader) : null;

  const rslUrl = new URL("/.well-known/rsl.xml", canonicalOrigin).toString();
  const rslFetch = await attempt(rslUrl);
  const rsl: ResourceOutcome<RslDeclaration> = {
    attempted: rslFetch !== null,
    fetch: rslFetch,
    parsed: rslFetch?.ok ? parseRsl(rslFetch.body) : null,
  };

  return {
    canonicalOrigin,
    robotsTxt,
    llmsTxt,
    llmsFullTxt,
    sitemap,
    homepage,
    rsl,
    contentSignals,
    xRobotsTag,
    externalRequestCount,
  };
}
