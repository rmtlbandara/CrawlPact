import type { Conflict } from "./conflicts";
import type { CrawlerEvaluation } from "./types";

export type Recommendation = {
  /** Lines to append to the existing robots.txt — never a mutation of existing lines (FR-REC-004, FR-REC-006). */
  proposedAdditions: string[];
  warnings: string[];
};

/**
 * Deterministic recommendation generation (SRS §21). Always appends new,
 * dedicated `User-agent` groups rather than editing existing lines:
 * per RFC 9309 §2.2.1 (implemented in `@crawlpact/robots`'s evaluator),
 * groups for the same exact token are combined and same-length Allow/Disallow
 * ties resolve to Allow — so an appended `Allow: /` group reliably carves
 * out an exception to an existing wildcard or same-token block, and an
 * appended `Disallow: /` group reliably restricts a token that was
 * previously unrestricted, without ever touching a pre-existing line.
 */
export function generateRecommendations(
  conflicts: Conflict[],
  crawlerEvaluations: CrawlerEvaluation[],
): Recommendation {
  const additions: string[] = [];
  const warnings: string[] = [];
  const handled = new Set<string>();

  for (const conflict of conflicts) {
    if (!conflict.affectedCrawlerId) continue;
    const key = `${conflict.affectedCrawlerId}:${conflict.code}`;
    if (handled.has(key)) continue;

    const crawler = crawlerEvaluations.find((c) => c.crawlerId === conflict.affectedCrawlerId);
    if (!crawler) continue;

    if (conflict.code === "SEARCH_VISIBILITY_CONFLICT") {
      additions.push(`User-agent: ${crawler.userAgentToken}`, "Allow: /");
      handled.add(key);
    }

    if (conflict.code === "TRAINING_RESTRICTION_CONFLICT") {
      additions.push(`User-agent: ${crawler.userAgentToken}`, "Disallow: /");
      warnings.push(
        `Disallowing ${crawler.userAgentToken} may reduce this content's visibility in ${crawler.operatorName}'s AI products that depend on this crawler.`,
      );
      handled.add(key);
    }
  }

  return { proposedAdditions: additions, warnings };
}
