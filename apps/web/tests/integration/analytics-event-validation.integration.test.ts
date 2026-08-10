import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { eq } from "drizzle-orm";
import { createD1TestHarness } from "./d1-harness";
import { ProhibitedAnalyticsPropertyError, trackEvent } from "../../src/lib/analytics";

/**
 * Phase 13 (§101/§102 of the phase prompt): proves trackEvent()'s
 * PII-shaped property guard actually rejects at the real DB-write boundary
 * (not just in isolation), and that a valid event is written correctly —
 * against real D1, not a mock.
 */
describe("trackEvent() property validation (real D1)", () => {
  let db: Database;
  let dispose: () => Promise<void>;

  beforeAll(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    db = createDb(harness.db);
  });

  afterAll(async () => {
    await dispose();
  });

  it("writes a valid event with no properties", async () => {
    await trackEvent(db, "landing_viewed");
    const rows = await db
      .select()
      .from(schema.productEvents)
      .where(eq(schema.productEvents.eventName, "landing_viewed"));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.properties).toBeNull();
  });

  it("writes a valid event with non-PII-shaped structured properties", async () => {
    await trackEvent(db, "pricing_viewed", {
      properties: { plan: "solo", interval: "annual", position: 2, featured: true },
    });
    const rows = await db
      .select()
      .from(schema.productEvents)
      .where(eq(schema.productEvents.eventName, "pricing_viewed"));
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0]!.properties!)).toEqual({
      plan: "solo",
      interval: "annual",
      position: 2,
      featured: true,
    });
  });

  it.each([
    ["email", { email: "visitor@example.com" }],
    ["domain", { domain: "customer-site.example" }],
    ["url", { url: "https://customer-site.example/page" }],
    ["token", { token: "abc123" }],
    ["ip", { ip: "203.0.113.5" }],
    ["ipAddress", { ipAddress: "203.0.113.5" }],
    ["userAgent", { userAgent: "Mozilla/5.0" }],
    ["password", { password: "hunter2" }],
    ["secret", { secret: "shh" }],
    ["ssn", { ssn: "000-00-0000" }],
    ["creditCard", { creditCard: "4111111111111111" }],
  ])("rejects a synthetic PII-shaped property key: %s", async (_label, properties) => {
    await expect(
      trackEvent(db, "landing_viewed", { properties: properties as Record<string, string> }),
    ).rejects.toThrow(ProhibitedAnalyticsPropertyError);
  });

  it("does not persist a row when the property guard rejects the event", async () => {
    const before = await db.select().from(schema.productEvents);
    await expect(
      trackEvent(db, "landing_viewed", { properties: { email: "visitor@example.com" } }),
    ).rejects.toThrow(ProhibitedAnalyticsPropertyError);
    const after = await db.select().from(schema.productEvents);
    expect(after).toHaveLength(before.length);
  });
});

/**
 * The 200-char string-property cap and the "unknown event name rejected"
 * rule are enforced one layer up, by POST /api/analytics/track's Zod
 * schema (apps/web/src/pages/api/analytics/track.ts) -- not by trackEvent()
 * itself, which trusts its caller (every other call site is server-side
 * code, not a client-supplied payload). That route imports
 * `cloudflare:workers` via getEnv(), so it cannot be invoked directly from
 * a Node-environment vitest run without a Workers runtime; see
 * docs/analytics/PRODUCT_EVENT_REGISTRY.md "Global rules" for where each
 * boundary is enforced.
 */
