import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { createDb, schema } from "@crawlpact/database";
import { createD1TestHarness } from "./d1-harness";
import { createFakeR2Bucket } from "./fake-r2-bucket";
import { ctx, getRequest } from "./test-helpers";

let mockEnv: Cloudflare.Env;
vi.mock("../../src/lib/env", () => ({ getEnv: () => mockEnv }));

const feedRoute = (await import("../../src/pages/status/feed.xml")).GET;

/**
 * Phase 14 (§88-91): the public status Atom feed reuses `getPublicStatus()`
 * directly, so it should be structurally incapable of leaking a non-public
 * incident, and must escape admin-authored incident text before
 * interpolating it into XML (a real, tested injection boundary — not just
 * asserted by code comment).
 */
describe("public status Atom feed (real D1)", () => {
  let dispose: () => Promise<void>;
  let db: D1Database;

  beforeAll(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    db = harness.db;
    mockEnv = {
      DB: harness.db,
      AGENCY_LOGOS: createFakeR2Bucket(),
      PUBLIC_APP_ENV: "local",
      PUBLIC_SITE_URL: "http://localhost:4321",
      SESSION_SIGNING_SECRET: "integration-test-secret-value-long-enough",
      ABUSE_MONITORING_SECRET: "integration-test-abuse-secret-value-long-enough",
      WEBAUTHN_RP_ID: "localhost",
      WEBAUTHN_RP_ORIGIN: "http://localhost:4321",
      PADDLE_API_KEY: "test",
      PADDLE_ENVIRONMENT: "sandbox",
      PADDLE_WEBHOOK_SECRET: "test",
      PADDLE_PRICE_ID_SOLO: "test",
      PADDLE_PRICE_ID_PRO: "test",
      PADDLE_PRICE_ID_AGENCY: "test",
      PUBLIC_PADDLE_CLIENT_TOKEN: "test",
      BILLING_ENABLED: "false",
      AUDIT_ENGINE_ENABLED: "false",
    };
  });

  afterAll(async () => {
    await dispose();
  });

  it("returns a valid Atom feed with the correct content type and headers", async () => {
    const response = await feedRoute(ctx(getRequest("http://localhost:4321/status/feed.xml")));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/atom+xml");
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
    expect(response.headers.get("cache-control")).toContain("public");
    const body = await response.text();
    expect(body).toContain('<?xml version="1.0" encoding="utf-8"?>');
    expect(body).toContain("<feed xmlns=");
  });

  it("escapes admin-authored incident text and excludes a non-public incident", async () => {
    const dbClient = createDb(db);
    const now = new Date().toISOString();

    await dbClient.insert(schema.incidents).values([
      {
        id: "inc_xss_public",
        title: '<script>alert("xss")</script> & "quoted"',
        publicSummary: "Summary with <b>markup</b> & an ampersand",
        severity: "minor",
        status: "investigating",
        isPublic: true,
        isScheduledMaintenance: false,
        affectedComponents: JSON.stringify(["website"]),
        startsAt: now,
        resolvedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "inc_draft_private",
        title: "Private draft incident — must never appear publicly",
        publicSummary: "Should never be visible",
        severity: "critical",
        status: "investigating",
        isPublic: false,
        isScheduledMaintenance: false,
        affectedComponents: JSON.stringify(["website"]),
        startsAt: now,
        resolvedAt: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const response = await feedRoute(ctx(getRequest("http://localhost:4321/status/feed.xml")));
    const body = await response.text();

    // Raw injection must never appear unescaped.
    expect(body).not.toContain("<script>alert");
    expect(body).toContain("&lt;script&gt;");
    expect(body).toContain("&amp;");
    expect(body).toContain("&quot;quoted&quot;");

    // The public incident is present at all (by its escaped id/content).
    expect(body).toContain("inc_xss_public");

    // The draft (is_public = false) incident never appears, in any form.
    expect(body).not.toContain("inc_draft_private");
    expect(body).not.toContain("Private draft incident");
  });
});
