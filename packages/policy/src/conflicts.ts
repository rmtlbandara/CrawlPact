import { evaluateAlignment } from "./presets";
import type { PolicyEvaluationInput, CrawlerEvaluation } from "./types";

export type ConflictCode =
  | "SEARCH_VISIBILITY_CONFLICT"
  | "TRAINING_RESTRICTION_CONFLICT"
  | "BROAD_WILDCARD_OVERRIDE"
  | "DEPRECATED_TOKEN_IN_USE"
  | "REPLACEMENT_TOKEN_MISSING"
  | "PAGE_DIRECTIVE_UNREACHABLE"
  | "RSL_CONTENT_SIGNALS_DISAGREEMENT"
  | "HEADER_SITE_DISAGREEMENT"
  | "DUPLICATE_GROUP_UNEXPECTED_MATCH"
  | "UNKNOWN_PURPOSE_REQUIRES_REVIEW";

export type Confidence = "high" | "medium" | "low";

export type Conflict = {
  code: ConflictCode;
  signalsInvolved: string[];
  evidence: string;
  likelyBusinessEffect: string;
  recommendedAction: string;
  confidence: Confidence;
  affectedCrawlerId: string | null;
};

/**
 * Deterministic conflict detection across preset alignment, robots.txt
 * evaluation, and additional signals (SRS §20). Every conflict is
 * reproducible from the same input — no randomness, no AI model.
 */
export function detectConflicts(input: PolicyEvaluationInput): Conflict[] {
  const conflicts: Conflict[] = [];
  const { preset, crawlerEvaluations, signals } = input;

  for (const crawler of crawlerEvaluations) {
    const alignment = evaluateAlignment(preset, crawler.purpose, crawler.result);

    if (
      alignment === "misaligned" &&
      crawler.purpose === "search" &&
      crawler.result === "blocked"
    ) {
      conflicts.push({
        code: "SEARCH_VISIBILITY_CONFLICT",
        signalsInvolved: ["robots.txt"],
        evidence: crawler.matchedRule
          ? `Line ${crawler.matchedLineNumber}: "${crawler.matchedRule}" blocks ${crawler.userAgentToken}.`
          : `${crawler.userAgentToken} is blocked.`,
        likelyBusinessEffect: `${crawler.crawlerName} (search) is blocked, which can reduce AI-assisted search visibility — the opposite of what the selected preset expects.`,
        recommendedAction: `Review whether blocking ${crawler.userAgentToken} is intentional; if not, allow it.`,
        confidence: "high",
        affectedCrawlerId: crawler.crawlerId,
      });
    }

    if (
      alignment === "misaligned" &&
      crawler.purpose === "training" &&
      crawler.result === "allowed"
    ) {
      conflicts.push({
        code: "TRAINING_RESTRICTION_CONFLICT",
        signalsInvolved: ["robots.txt"],
        evidence: `${crawler.userAgentToken} has no blocking rule and is therefore allowed.`,
        likelyBusinessEffect: `${crawler.crawlerName} (training) can access this content, which conflicts with the selected preset's intent to restrict training crawlers.`,
        recommendedAction: `Add a Disallow rule for ${crawler.userAgentToken} if training use should be restricted.`,
        confidence: "high",
        affectedCrawlerId: crawler.crawlerId,
      });
    }

    if (crawler.lifecycleStatus === "deprecated" || crawler.lifecycleStatus === "replaced") {
      conflicts.push({
        code: "DEPRECATED_TOKEN_IN_USE",
        signalsInvolved: ["robots.txt", "registry"],
        evidence: `robots.txt references "${crawler.userAgentToken}", a ${crawler.lifecycleStatus} token in the crawler registry.`,
        likelyBusinessEffect:
          "Rules targeting a deprecated token may no longer affect real crawler traffic.",
        recommendedAction: crawler.replacementCrawlerId
          ? "Add an equivalent rule for the replacement crawler token."
          : "Verify whether this operator has published a replacement token.",
        confidence: "medium",
        affectedCrawlerId: crawler.crawlerId,
      });

      if (crawler.lifecycleStatus === "replaced" && crawler.replacementCrawlerId) {
        const replacementCovered = crawlerEvaluations.some(
          (other) =>
            other.crawlerId === crawler.replacementCrawlerId && other.result !== "no_explicit_rule",
        );
        if (!replacementCovered) {
          conflicts.push({
            code: "REPLACEMENT_TOKEN_MISSING",
            signalsInvolved: ["robots.txt", "registry"],
            evidence: `"${crawler.userAgentToken}" was replaced, but no explicit rule exists for its replacement.`,
            likelyBusinessEffect:
              "The original policy intent may no longer be enforced against the crawler operator's current token.",
            recommendedAction: "Add an equivalent rule for the replacement crawler.",
            confidence: "medium",
            affectedCrawlerId: crawler.crawlerId,
          });
        }
      }
    }

    if (
      (crawler.purpose === "unknown" || crawler.purpose === "mixed") &&
      (crawler.result === "allowed" || crawler.result === "blocked")
    ) {
      conflicts.push({
        code: "UNKNOWN_PURPOSE_REQUIRES_REVIEW",
        signalsInvolved: ["robots.txt", "registry"],
        evidence: `${crawler.userAgentToken}'s purpose is classified as "${crawler.purpose}".`,
        likelyBusinessEffect:
          "The business impact of this rule cannot be fully determined until the crawler's purpose is verified.",
        recommendedAction:
          "No action required immediately; the registry will reclassify this crawler once verified.",
        confidence: "low",
        affectedCrawlerId: crawler.crawlerId,
      });
    }

    if (
      crawler.result === "blocked" &&
      signals.html?.metaRobots &&
      !signals.robots.hasBroadWildcardBlock // avoid double-flagging when the whole site is intentionally blocked
    ) {
      conflicts.push({
        code: "PAGE_DIRECTIVE_UNREACHABLE",
        signalsInvolved: ["robots.txt", "html_meta"],
        evidence: `The page declares a meta robots directive ("${signals.html.metaRobots}"), but ${crawler.userAgentToken} is blocked by robots.txt from ever fetching this page.`,
        likelyBusinessEffect:
          "The page-level directive has no effect for this crawler, since it cannot reach the page to read it.",
        recommendedAction:
          "This is informational unless the meta directive was meant to be the primary control for this crawler.",
        confidence: "medium",
        affectedCrawlerId: crawler.crawlerId,
      });
    }
  }

  if (signals.robots.hasBroadWildcardBlock) {
    conflicts.push({
      code: "BROAD_WILDCARD_OVERRIDE",
      signalsInvolved: ["robots.txt"],
      evidence:
        'The wildcard (*) group disallows "/", overriding any more specific intended rule for unlisted crawlers.',
      likelyBusinessEffect:
        "Any crawler without its own explicit group is blocked entirely, which may be broader than intended.",
      recommendedAction:
        "Add specific groups for crawlers that should be treated differently than the wildcard default.",
      confidence: "high",
      affectedCrawlerId: null,
    });
  }

  if (signals.robots.hasDuplicateGroups) {
    conflicts.push({
      code: "DUPLICATE_GROUP_UNEXPECTED_MATCH",
      signalsInvolved: ["robots.txt"],
      evidence: "The same crawler token appears in more than one User-agent group.",
      likelyBusinessEffect:
        "Rules from both groups are combined, which can produce a result different from what either group alone suggests.",
      recommendedAction: "Consolidate the token into a single group to avoid ambiguity.",
      confidence: "medium",
      affectedCrawlerId: null,
    });
  }

  if (signals.rsl?.discovered && signals.contentSignals) {
    const rslProhibitsTraining = signals.rsl.prohibits.some((p) => /train/i.test(p));
    const contentSignalsAllowTraining = signals.contentSignals.recognised["ai-train"] === "yes";
    if (rslProhibitsTraining && contentSignalsAllowTraining) {
      conflicts.push({
        code: "RSL_CONTENT_SIGNALS_DISAGREEMENT",
        signalsInvolved: ["rsl", "content_signals"],
        evidence: 'RSL prohibits training use, but Content Signals declares "ai-train=yes".',
        likelyBusinessEffect:
          "Crawlers reading only one of these two signals may reach opposite conclusions about permitted use.",
        recommendedAction:
          "Align the RSL declaration and Content Signals value for AI training use.",
        confidence: "medium",
        affectedCrawlerId: null,
      });
    }
  }

  if (signals.xRobotsTag.includes("noindex") && !signals.robots.hasBroadWildcardBlock) {
    const anyCrawlerAllowed = crawlerEvaluations.some((c) => c.result === "allowed");
    if (anyCrawlerAllowed) {
      conflicts.push({
        code: "HEADER_SITE_DISAGREEMENT",
        signalsInvolved: ["http_headers", "robots.txt"],
        evidence:
          'The X-Robots-Tag header declares "noindex" for this resource, while robots.txt allows crawling.',
        likelyBusinessEffect:
          "Crawling is permitted but indexing is discouraged — a nuance that is easy to overlook.",
        recommendedAction: "Confirm this combination (crawlable but not indexable) is intentional.",
        confidence: "low",
        affectedCrawlerId: null,
      });
    }
  }

  return conflicts;
}

export type { CrawlerEvaluation };
