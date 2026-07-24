import type { ParsedRobots, RobotsGroup, RobotsMatchTrace, RobotsRule } from "./types";

function escapeRegexExceptStar(pattern: string): string {
  return pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
}

function ruleMatches(rule: RobotsRule, path: string): boolean {
  const regex = new RegExp(`^${escapeRegexExceptStar(rule.pattern)}${rule.anchored ? "$" : ""}`);
  return regex.test(path);
}

/** Specificity heuristic: longer literal pattern wins, per common robots.txt implementations. */
function specificity(rule: RobotsRule): number {
  return rule.pattern.length;
}

function findApplicableGroups(groups: RobotsGroup[], crawlerToken: string): RobotsGroup[] {
  const lowerToken = crawlerToken.toLowerCase();
  const exact = groups.filter((group) =>
    group.userAgents.some((agent) => agent.toLowerCase() === lowerToken),
  );
  if (exact.length > 0) return exact;
  return groups.filter((group) => group.userAgents.some((agent) => agent.trim() === "*"));
}

/**
 * Evaluates whether `crawlerToken` may access `path`, per the combined rules
 * of every applicable group (RFC 9309 §2.2.1 — groups matching the same
 * token are combined, not just the first one used). Returns a full trace
 * (SRS FR-ROB-007): applicable group, matched rule, line number, and a
 * plain-language explanation, so every report can cite its exact evidence.
 */
export function evaluateRobots(
  parsed: ParsedRobots,
  crawlerToken: string,
  path: string,
): RobotsMatchTrace {
  const applicable = findApplicableGroups(parsed.groups, crawlerToken);

  if (applicable.length === 0) {
    return {
      crawlerToken,
      path,
      applicableGroupUserAgents: null,
      matchedRule: null,
      lineNumber: null,
      result: "no_explicit_rule",
      explanation: `No group in robots.txt names "${crawlerToken}" and no wildcard (*) group exists.`,
    };
  }

  const allRules = applicable.flatMap((group) => group.rules);
  const matching = allRules.filter((rule) => ruleMatches(rule, path));

  if (matching.length === 0) {
    return {
      crawlerToken,
      path,
      applicableGroupUserAgents: applicable.flatMap((g) => g.userAgents),
      matchedRule: null,
      lineNumber: null,
      result: "allowed",
      explanation: `An applicable group was found but no rule matches "${path}"; robots.txt defaults to allow when no rule matches.`,
    };
  }

  // Longest match wins; ties resolve to Allow (the less restrictive rule),
  // matching common crawler implementations' documented tie-break behaviour.
  let best = matching[0]!;
  for (const rule of matching.slice(1)) {
    const bestSpec = specificity(best);
    const ruleSpec = specificity(rule);
    if (
      ruleSpec > bestSpec ||
      (ruleSpec === bestSpec && rule.type === "allow" && best.type === "disallow")
    ) {
      best = rule;
    }
  }

  return {
    crawlerToken,
    path,
    applicableGroupUserAgents: applicable.flatMap((g) => g.userAgents),
    matchedRule: best,
    lineNumber: best.lineNumber,
    result: best.type === "allow" ? "allowed" : "blocked",
    explanation:
      best.type === "allow"
        ? `Line ${best.lineNumber} allows "${best.pattern}${best.anchored ? "$" : ""}", the most specific matching rule.`
        : `Line ${best.lineNumber} disallows "${best.pattern}${best.anchored ? "$" : ""}", the most specific matching rule.`,
  };
}
