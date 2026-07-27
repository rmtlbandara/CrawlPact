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
const batchImportRoute = (await import("../../src/pages/api/domains/batch-import")).POST;
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

describe("agency features: batch import and agency branding (real D1)", () => {
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

  it("blocks batch import entirely on a plan without batchImportLimit (free)", async () => {
    const { cookie } = await signUpTestUser("FreeAgency");
    const response = await batchImportRoute(
      ctx(
        jsonRequest(
          "http://x/domains/batch-import",
          "POST",
          { targets: ["client-a.com", "client-b.com"] },
          cookie,
        ),
      ),
    );
    expect(response.status).toBe(200);
    const body = await readJson<{ savedCount: number; errorCount: number }>(response);
    if (!body.ok) throw new Error("request failed");
    expect(body.data.savedCount).toBe(0);
    expect(body.data.errorCount).toBe(2);
  });

  it("imports a batch on the agency plan, reporting per-row success/failure without one bad row blocking the rest", async () => {
    const { cookie, userId } = await signUpTestUser("AgencyOwner");
    await db.update(schema.users).set({ planId: "agency" }).where(eq(schema.users.id, userId));

    const groupResponse = await (
      await import("../../src/pages/api/groups/index")
    ).POST(ctx(jsonRequest("http://x/groups", "POST", { name: "Client Portfolio" }, cookie)));
    const group = await readJson<{ groupId: string }>(groupResponse);
    if (!group.ok) throw new Error("group creation failed");

    const response = await batchImportRoute(
      ctx(
        jsonRequest(
          "http://x/domains/batch-import",
          "POST",
          {
            targets: ["client-a.com", "client-b.com", "client-a.com", "not a valid domain!!"],
            groupId: group.data.groupId,
          },
          cookie,
        ),
      ),
    );
    expect(response.status).toBe(200);
    const body = await readJson<{
      savedCount: number;
      errorCount: number;
      results: { target: string; ok: boolean; error?: string }[];
    }>(response);
    if (!body.ok) throw new Error("import failed");

    expect(body.data.savedCount).toBe(2);
    expect(body.data.errorCount).toBe(2);
    expect(body.data.results.filter((r) => r.ok)).toHaveLength(2);
    // The in-batch duplicate (client-a.com listed twice) is caught by the second occurrence.
    const duplicateRow = body.data.results.find((r) => r.target === "client-a.com" && !r.ok);
    expect(duplicateRow?.error).toContain("Already saved");

    const savedDomains = await db
      .select()
      .from(schema.domains)
      .where(eq(schema.domains.ownerUserId, userId));
    expect(savedDomains.every((d) => d.groupId === group.data.groupId)).toBe(true);
  });

  it("reports every row as failed, without saving any, when a batch exceeds the plan's batchImportLimit", async () => {
    const { cookie, userId } = await signUpTestUser("AgencyOwnerTwo");
    await db.update(schema.users).set({ planId: "agency" }).where(eq(schema.users.id, userId));

    const targets = Array.from({ length: 101 }, (_, i) => `client-${i}.example.com`);
    const response = await batchImportRoute(
      ctx(jsonRequest("http://x/domains/batch-import", "POST", { targets }, cookie)),
    );
    expect(response.status).toBe(200);
    const body = await readJson<{
      savedCount: number;
      errorCount: number;
      results: { error?: string }[];
    }>(response);
    if (!body.ok) throw new Error("request failed");
    expect(body.data.savedCount).toBe(0);
    expect(body.data.errorCount).toBe(101);
    expect(body.data.results[0]?.error).toContain("at most 100");

    const savedDomains = await db
      .select()
      .from(schema.domains)
      .where(eq(schema.domains.ownerUserId, userId));
    expect(savedDomains).toHaveLength(0);
  });

  it("rejects agency branding on a plan without agencyBrandingEnabled, and accepts it on the agency plan", async () => {
    const { cookie: freeCookie, userId: freeUserId } = await signUpTestUser("FreeSharer");
    const now = new Date().toISOString();
    const freeDomainId = crypto.randomUUID();
    await db.insert(schema.domains).values({
      id: freeDomainId,
      ownerUserId: freeUserId,
      displayName: "example.com",
      canonicalOrigin: "https://example.com",
      originalInput: "example.com",
      preset: "maximum_ai_visibility",
      monitoringState: "active",
      monitoringFrequency: "none",
      consecutiveFailureCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    const freeScanId = crypto.randomUUID();
    await db.insert(schema.scans).values({
      id: freeScanId,
      domainId: freeDomainId,
      triggeredBy: "manual",
      triggeredByUserId: freeUserId,
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
      ctx(
        jsonRequest(
          "http://x/api/audit/x/share",
          "POST",
          { agencyBranding: { agencyName: "Not Allowed Agency" } },
          freeCookie,
        ),
        { auditId: freeScanId },
      ),
    );
    expect(deniedResponse.status).toBe(403);
    const deniedBody = await readJson(deniedResponse);
    if (!deniedBody.ok) expect(deniedBody.error.code).toBe("FORBIDDEN");

    // Same request, but from an agency-plan owner of their own scan: allowed.
    const { cookie: agencyCookie, userId: agencyUserId } = await signUpTestUser("AgencyBrander");
    await db
      .update(schema.users)
      .set({ planId: "agency" })
      .where(eq(schema.users.id, agencyUserId));
    const agencyDomainId = crypto.randomUUID();
    await db.insert(schema.domains).values({
      id: agencyDomainId,
      ownerUserId: agencyUserId,
      displayName: "clientsite.com",
      canonicalOrigin: "https://clientsite.com",
      originalInput: "clientsite.com",
      preset: "maximum_ai_visibility",
      monitoringState: "active",
      monitoringFrequency: "weekly",
      consecutiveFailureCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    const agencyScanId = crypto.randomUUID();
    await db.insert(schema.scans).values({
      id: agencyScanId,
      domainId: agencyDomainId,
      triggeredBy: "manual",
      triggeredByUserId: agencyUserId,
      targetInput: "https://clientsite.com",
      canonicalOrigin: "https://clientsite.com",
      status: "completed",
      scoreState: "scored",
      score: 65,
      externalRequestCount: 1,
      startedAt: now,
      completedAt: now,
    });

    const allowedResponse = await shareRoute(
      ctx(
        jsonRequest(
          "http://x/api/audit/x/share",
          "POST",
          {
            agencyBranding: {
              agencyName: "Acme SEO Agency",
              clientName: "Client Site Inc.",
              introText: "Prepared as part of our monthly AI visibility review.",
            },
          },
          agencyCookie,
        ),
        { auditId: agencyScanId },
      ),
    );
    expect(allowedResponse.status).toBe(201);
    const allowedBody = await readJson<{ url: string }>(allowedResponse);
    if (!allowedBody.ok) throw new Error("share failed");

    const token = allowedBody.data.url.split("/shared/")[1]!;
    const { getShareForToken } = await import("../../src/lib/sharing");
    const resolved = await getShareForToken(db, token);
    expect(resolved?.agencyBranding?.agencyName).toBe("Acme SEO Agency");
    expect(resolved?.agencyBranding?.clientName).toBe("Client Site Inc.");
  });

  it("rejects a javascript: URI as a branding logo URL", async () => {
    const { cookie, userId } = await signUpTestUser("AgencyLogoAttacker");
    await db.update(schema.users).set({ planId: "agency" }).where(eq(schema.users.id, userId));
    const now = new Date().toISOString();
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
    const scanId = crypto.randomUUID();
    await db.insert(schema.scans).values({
      id: scanId,
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

    const response = await shareRoute(
      ctx(
        jsonRequest(
          "http://x/api/audit/x/share",
          "POST",
          { agencyBranding: { logoUrl: "javascript:alert(1)" } },
          cookie,
        ),
        { auditId: scanId },
      ),
    );
    expect(response.status).toBe(400);
  });
});
