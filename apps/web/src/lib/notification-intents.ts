import type { GeneratedTimelineEvent } from "./domain-timeline";

/**
 * Maps a Phase 8 domain_change_events row to a notification decision (Phase
 * 10). This is the single place that decides *whether* a policy-change
 * notification fires and what it says — replacing the pre-Phase-10 logic in
 * monitoring.ts that recomputed its own cruder website-vs-registry drift
 * independently of the Phase 8 attribution model and, as a result, could
 * mislabel a mixed (both website and registry) change as purely
 * registry-driven. See docs/architecture/NOTIFICATION_RELIABILITY_ARCHITECTURE.md.
 */

export type PolicyChangeNotificationType =
  "critical_policy_change" | "high_severity_policy_change" | "registry_drift";

export type PolicyChangeNotificationIntent = {
  type: PolicyChangeNotificationType;
  category: "policy_changes" | "crawler_registry";
  priority: "critical" | "high";
  title: string;
  body: string;
  sourceType: "domain_change_event";
  sourceId: string;
  dedupeKey: string;
  actionPath: string;
  modelVersion: string;
};

type FindingLifecycleDetail = { state: string; severity: string };

function hasAppearedFindingOfSeverity(detailsJson: string, severity: "critical" | "high"): boolean {
  try {
    const details = JSON.parse(detailsJson) as { findingLifecycle?: FindingLifecycleDetail[] };
    return (details.findingLifecycle ?? []).some(
      (entry) => entry.state === "appeared" && entry.severity === severity,
    );
  } catch {
    // detailsJson is always written by domain-timeline.ts's own
    // JSON.stringify — a parse failure here would mean the row is corrupt,
    // not that no critical finding exists. Fail closed (assume no critical
    // finding) rather than let a malformed row throw out of notification
    // generation.
    return false;
  }
}

/**
 * Returns `null` when this event does not merit an interruptive
 * notification — every event still remains visible in the domain's
 * change timeline regardless (docs/product/NOTIFICATION_FATIGUE_AND_GROUPING_POLICY.md).
 *
 * Notify only for website/registry/mixed changes CrawlPact's own attribution
 * already scored `high_attention` (a critical/high-severity finding
 * appeared, or 3+ crawler purposes were affected) — deliberately reusing
 * Phase 8's own threshold rather than inventing a second one, so the
 * notification decision and the timeline's own "this matters" signal can
 * never disagree.
 */
export function buildPolicyChangeNotificationIntent(
  domain: { id: string; displayName: string },
  event: GeneratedTimelineEvent,
): PolicyChangeNotificationIntent | null {
  if (event.attentionLevel !== "high_attention") return null;
  if (
    event.eventType !== "website_policy_change" &&
    event.eventType !== "registry_driven_change" &&
    event.eventType !== "mixed_change"
  ) {
    return null;
  }

  const hasCritical = hasAppearedFindingOfSeverity(event.detailsJson, "critical");

  let type: PolicyChangeNotificationType;
  let category: "policy_changes" | "crawler_registry";
  let title: string;

  if (event.changeOrigin === "registry_driven") {
    type = "registry_drift";
    category = "crawler_registry";
    title = `${domain.displayName}: crawler registry update changed policy evaluation`;
  } else {
    // website_policy or mixed — both are consequential for the site's own
    // published policy, so both use the policy-change types. The mixed case
    // is distinguished from a pure website change in the *body*, not the
    // type: `event.summary` is already worded correctly per origin by
    // domain-timeline.ts's buildSummary() ("Both the website's published
    // policy and the verified crawler registry changed"), so reusing it here
    // guarantees the notification can never describe a mixed change as
    // "purely website-driven" — SRS/Phase 10 §17's hard requirement.
    type = hasCritical ? "critical_policy_change" : "high_severity_policy_change";
    category = "policy_changes";
    title = `${domain.displayName}: AI crawler policy changed`;
  }

  return {
    type,
    category,
    priority: hasCritical ? "critical" : "high",
    title,
    body: event.summary,
    sourceType: "domain_change_event",
    sourceId: event.id,
    dedupeKey: `${type}:domain_change_event:${event.id}`,
    actionPath: `/app/domains/${domain.id}`,
    modelVersion: event.modelVersion,
  };
}
