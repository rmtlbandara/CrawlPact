import { describe, expect, it } from "vitest";
import { buildPolicyChangeNotificationIntent } from "./notification-intents";
import type { GeneratedTimelineEvent } from "./domain-timeline";

/**
 * Unit tests for the Phase 8 attribution -> notification decision (§17-18).
 * The core regression this guards against: a *mixed* (both website and
 * registry) change must never be mislabelled as purely registry-driven —
 * the bug the pre-Phase-10 drift-based logic in monitoring.ts had, since its
 * `registryChanged` check short-circuited before the website-side severity
 * check ever ran.
 */

const domain = { id: "domain_1", displayName: "example.com" };

function baseEvent(overrides: Partial<GeneratedTimelineEvent>): GeneratedTimelineEvent {
  return {
    id: "event_1",
    domainId: "domain_1",
    eventType: "website_policy_change",
    changeOrigin: "website_policy",
    attentionLevel: "high_attention",
    observedAt: "2026-01-01T00:00:00.000Z",
    previousScanId: "scan_prev",
    currentScanId: "scan_curr",
    previousRegistryVersionId: "reg_1",
    currentRegistryVersionId: "reg_1",
    affectedPurposesJson: "[]",
    findingCountsJson: "{}",
    summary:
      "The website's published crawler-policy signals changed since the previous comparable scan.",
    detailsJson: JSON.stringify({ findingLifecycle: [] }),
    completeness: "complete",
    fingerprint: "fp_1",
    modelVersion: "1",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildPolicyChangeNotificationIntent", () => {
  it("returns null for a low-attention event — timeline-only, no interruption", () => {
    const event = baseEvent({ attentionLevel: "review_recommended" });
    expect(buildPolicyChangeNotificationIntent(domain, event)).toBeNull();
  });

  it("returns null for a baseline event", () => {
    const event = baseEvent({
      eventType: "baseline",
      changeOrigin: "baseline",
      attentionLevel: "informational",
    });
    expect(buildPolicyChangeNotificationIntent(domain, event)).toBeNull();
  });

  it("returns null for an operational event even at high attention (shouldn't occur, but must not notify)", () => {
    const event = baseEvent({ eventType: "operational_change", changeOrigin: "operational" });
    expect(buildPolicyChangeNotificationIntent(domain, event)).toBeNull();
  });

  it("a website-only change with a critical finding produces critical_policy_change", () => {
    const event = baseEvent({
      detailsJson: JSON.stringify({
        findingLifecycle: [{ state: "appeared", severity: "critical" }],
      }),
    });
    const intent = buildPolicyChangeNotificationIntent(domain, event);
    expect(intent?.type).toBe("critical_policy_change");
    expect(intent?.category).toBe("policy_changes");
    expect(intent?.priority).toBe("critical");
    expect(intent?.body).toBe(event.summary);
  });

  it("a website-only change with only a high (non-critical) finding produces high_severity_policy_change", () => {
    const event = baseEvent({
      detailsJson: JSON.stringify({
        findingLifecycle: [{ state: "appeared", severity: "high" }],
      }),
    });
    const intent = buildPolicyChangeNotificationIntent(domain, event);
    expect(intent?.type).toBe("high_severity_policy_change");
    expect(intent?.priority).toBe("high");
  });

  it("a registry-driven change produces registry_drift, categorised as crawler_registry", () => {
    const event = baseEvent({
      eventType: "registry_driven_change",
      changeOrigin: "registry_driven",
      summary:
        "The website's published signals remained unchanged, but CrawlPact's verified crawler registry changed.",
    });
    const intent = buildPolicyChangeNotificationIntent(domain, event);
    expect(intent?.type).toBe("registry_drift");
    expect(intent?.category).toBe("crawler_registry");
    expect(intent?.body).toContain("registry");
  });

  it("a mixed change never produces registry_drift — it uses the policy-change type, with body text stating both changed (the core regression guard)", () => {
    const event = baseEvent({
      eventType: "mixed_change",
      changeOrigin: "mixed",
      summary: "Both the website's published policy and the verified crawler registry changed.",
      detailsJson: JSON.stringify({
        findingLifecycle: [{ state: "appeared", severity: "critical" }],
      }),
    });
    const intent = buildPolicyChangeNotificationIntent(domain, event);
    expect(intent?.type).not.toBe("registry_drift");
    expect(intent?.type).toBe("critical_policy_change");
    expect(intent?.category).toBe("policy_changes");
    expect(intent?.body).toContain("Both");
    expect(intent?.body).toContain("registry");
  });

  it("produces a dedupe key stable for the same event and derived from the event id", () => {
    const event = baseEvent({});
    const first = buildPolicyChangeNotificationIntent(domain, event);
    const second = buildPolicyChangeNotificationIntent(domain, event);
    expect(first?.dedupeKey).toBe(second?.dedupeKey);
    expect(first?.dedupeKey).toContain(event.id);
    expect(first?.sourceType).toBe("domain_change_event");
    expect(first?.sourceId).toBe(event.id);
  });

  it("a malformed detailsJson fails closed (no critical finding assumed) rather than throwing", () => {
    const event = baseEvent({ detailsJson: "not valid json" });
    expect(() => buildPolicyChangeNotificationIntent(domain, event)).not.toThrow();
    const intent = buildPolicyChangeNotificationIntent(domain, event);
    expect(intent?.type).toBe("high_severity_policy_change");
  });

  it("action path points at the domain detail page", () => {
    const event = baseEvent({});
    const intent = buildPolicyChangeNotificationIntent(domain, event);
    expect(intent?.actionPath).toBe(`/app/domains/${domain.id}`);
  });
});
