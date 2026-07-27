import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { createD1TestHarness } from "./d1-harness";
import { createVirtualCredential, simulateRegistration } from "./virtual-authenticator";
import { cookieFromResponse, ctx, jsonRequest, readJson } from "./test-helpers";

const RP_ID = "localhost";
const ORIGIN = "http://localhost:4321";

let mockEnv: Cloudflare.Env;
vi.mock("../../src/lib/env", () => ({ getEnv: () => mockEnv }));

const registerBegin = (await import("../../src/pages/api/auth/register/begin")).POST;
const registerFinish = (await import("../../src/pages/api/auth/register/finish")).POST;
const trackRoute = (await import("../../src/pages/api/analytics/track")).POST;
const shareRoute = (await import("../../src/pages/api/audit/[auditId]/share")).POST;

async function signUpTestUser(displayName: string): Promise<{ cookie: string; userId: string }> {
  const beginResponse = await registerBegin(
    ctx(jsonRequest("http://x/register/begin", "POST", { displayName })),
  );
  const begin = await readJson<{
    challengeId: string;
    publicKeyCredentialCreationOptions: { challenge: string };
  }>(beginResponse);
  if (!begin.ok) throw new Error("begin failed");

  const credential = await simulateRegistration(
    await createVirtualCredential(),
    begin.data.publicKeyCredentialCreationOptions.challenge,
    RP_ID,
    ORIGIN,
  );
  const finishResponse = await registerFinish(
    ctx(
      jsonRequest("http://x/register/finish", "POST", {
        challengeId: begin.data.challengeId,
        credential,
      }),
    ),
  );
  const finish = await readJson<{ user: { id: string } }>(finishResponse);
  if (!finish.ok) throw new Error("finish failed");
  return { cookie: cookieFromResponse(finishResponse), userId: finish.data.user.id };
}

describe("first-party analytics + report sharing (real D1)", () => {
  let db: Database;
  let dispose: () => Promise<void>;

  beforeAll(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    db = createDb(harness.db);
    mockEnv = {
      DB: harness.db,
      PUBLIC_APP_ENV: "local",
      PUBLIC_SITE_URL: ORIGIN,
      SESSION_SIGNING_SECRET: "integration-test-secret-value-long-enough",
      WEBAUTHN_RP_ID: RP_ID,
      WEBAUTHN_RP_ORIGIN: ORIGIN,
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

  it("records a page-view-style event via the track endpoint", async () => {
    const response = await trackRoute(
      ctx(jsonRequest("http://x/api/analytics/track", "POST", { eventName: "landing_viewed" })),
    );
    expect(response.status).toBe(200);

    const rows = await db
      .select()
      .from(schema.productEvents)
      .where(eq(schema.productEvents.eventName, "landing_viewed"));
    expect(rows).toHaveLength(1);
  });

  it("rejects an event name outside the fixed allowlist", async () => {
    const response = await trackRoute(
      ctx(
        jsonRequest("http://x/api/analytics/track", "POST", { eventName: "arbitrary_junk_event" }),
      ),
    );
    expect(response.status).toBe(400);

    const rows = await db
      .select()
      .from(schema.productEvents)
      .where(eq(schema.productEvents.eventName, "arbitrary_junk_event"));
    expect(rows).toHaveLength(0);
  });

  it("recorded account_created when a user signed up (side effect of registration)", async () => {
    const { userId } = await signUpTestUser("Ada");
    const rows = await db
      .select()
      .from(schema.productEvents)
      .where(eq(schema.productEvents.eventName, "account_created"));
    expect(rows.some((r) => r.userId === userId)).toBe(true);
  });

  it("refuses to share a scan the caller does not own, and creates a working share link for one they do", async () => {
    const { cookie, userId } = await signUpTestUser("Grace");

    // A scan with no domain (anonymous) can never be shared.
    const now = new Date().toISOString();
    const anonymousScanId = crypto.randomUUID();
    await db.insert(schema.scans).values({
      id: anonymousScanId,
      domainId: null,
      triggeredBy: "anonymous",
      targetInput: "https://example.com",
      canonicalOrigin: "https://example.com",
      status: "completed",
      scoreState: "scored",
      score: 80,
      externalRequestCount: 1,
      startedAt: now,
      completedAt: now,
    });

    const deniedResponse = await shareRoute(
      ctx(jsonRequest("http://x/api/audit/x/share", "POST", {}, cookie), {
        auditId: anonymousScanId,
      }),
    );
    expect(deniedResponse.status).toBe(404);

    // A scan tied to a domain Grace owns can be shared.
    const domainId = crypto.randomUUID();
    await db.insert(schema.domains).values({
      id: domainId,
      ownerUserId: userId,
      displayName: "example.com",
      canonicalOrigin: "https://example.com",
      originalInput: "example.com",
      preset: "maximum_ai_visibility",
      monitoringState: "active",
      monitoringFrequency: "weekly",
      consecutiveFailureCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    const ownedScanId = crypto.randomUUID();
    await db.insert(schema.scans).values({
      id: ownedScanId,
      domainId,
      triggeredBy: "manual",
      triggeredByUserId: userId,
      targetInput: "https://example.com",
      canonicalOrigin: "https://example.com",
      status: "completed",
      scoreState: "scored",
      score: 80,
      externalRequestCount: 1,
      startedAt: now,
      completedAt: now,
    });

    const sharedResponse = await shareRoute(
      ctx(jsonRequest("http://x/api/audit/x/share", "POST", {}, cookie), { auditId: ownedScanId }),
    );
    expect(sharedResponse.status).toBe(201);
    const body = await readJson<{ url: string }>(sharedResponse);
    if (!body.ok) throw new Error("share failed");
    expect(body.data.url).toContain("/shared/");

    const shareEvents = await db
      .select()
      .from(schema.productEvents)
      .where(eq(schema.productEvents.eventName, "report_shared"));
    expect(shareEvents.length).toBeGreaterThan(0);
  });
});
