import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { createD1TestHarness } from "./d1-harness";
import { createFakeR2Bucket } from "./fake-r2-bucket";
import { createVirtualCredential, simulateRegistration } from "./virtual-authenticator";
import { cookieFromResponse, ctx, formDataRequest, jsonRequest, readJson } from "./test-helpers";

const RP_ID = "localhost";
const ORIGIN = "http://localhost:4321";

let mockEnv: Cloudflare.Env;
vi.mock("../../src/lib/env", () => ({ getEnv: () => mockEnv }));

const registerBegin = (await import("../../src/pages/api/auth/register/begin")).POST;
const registerFinish = (await import("../../src/pages/api/auth/register/finish")).POST;
const batchImportRoute = (await import("../../src/pages/api/domains/batch-import")).POST;
const shareRoute = (await import("../../src/pages/api/audit/[auditId]/share")).POST;
const logoUploadRoute = (await import("../../src/pages/api/agency-branding/logo")).POST;

// The smallest possible real PNG signature — detectImageType only inspects
// the first 8 magic bytes, so this is sufficient to be recognised as a
// genuine PNG without needing a fully valid image payload.
const REAL_PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

function pngFormData(): FormData {
  const formData = new FormData();
  formData.set("file", new File([REAL_PNG_BYTES], "logo.png", { type: "image/png" }));
  return formData;
}

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
      AGENCY_LOGOS: createFakeR2Bucket(),
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

    // The logo upload endpoint enforces the same plan gate independently —
    // a free-plan user can't get a valid logoUrl to submit in the first place.
    const deniedUpload = await logoUploadRoute(
      ctx(formDataRequest("http://x/api/agency-branding/logo", pngFormData(), freeCookie)),
    );
    expect(deniedUpload.status).toBe(403);

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

    const uploadResponse = await logoUploadRoute(
      ctx(formDataRequest("http://x/api/agency-branding/logo", pngFormData(), agencyCookie)),
    );
    expect(uploadResponse.status).toBe(201);
    const uploadBody = await readJson<{ logoUrl: string }>(uploadResponse);
    if (!uploadBody.ok) throw new Error("logo upload failed");
    expect(uploadBody.data.logoUrl).toMatch(
      new RegExp(`^/api/agency-branding/logo/${agencyUserId}/[A-Za-z0-9-]+\\.png$`),
    );

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
              logoUrl: uploadBody.data.logoUrl,
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
    if (resolved.status !== "valid") throw new Error("expected a valid share");
    expect(resolved.agencyBranding?.agencyName).toBe("Acme SEO Agency");
    expect(resolved.agencyBranding?.clientName).toBe("Client Site Inc.");
    expect(resolved.agencyBranding?.logoUrl).toBe(uploadBody.data.logoUrl);

    // The uploaded object is really in R2, not just a database string.
    const stored = await mockEnv.AGENCY_LOGOS.get(
      uploadBody.data.logoUrl.replace(/^\/api\/agency-branding\/logo\//, ""),
    );
    expect(stored).not.toBeNull();
  });

  it("rejects a non-image upload, an arbitrary URL as logoUrl, and another user's uploaded logo", async () => {
    const { cookie, userId } = await signUpTestUser("AgencyLogoAttacker");
    await db.update(schema.users).set({ planId: "agency" }).where(eq(schema.users.id, userId));

    // The upload endpoint sniffs real bytes, not a spoofed Content-Type.
    const fakeImageFormData = new FormData();
    fakeImageFormData.set(
      "file",
      new File([new TextEncoder().encode("<script>alert(1)</script>")], "logo.png", {
        type: "image/png",
      }),
    );
    const badUploadResponse = await logoUploadRoute(
      ctx(formDataRequest("http://x/api/agency-branding/logo", fakeImageFormData, cookie)),
    );
    expect(badUploadResponse.status).toBe(400);

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

    const jsUriResponse = await shareRoute(
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
    expect(jsUriResponse.status).toBe(400);

    const arbitraryUrlResponse = await shareRoute(
      ctx(
        jsonRequest(
          "http://x/api/audit/x/share",
          "POST",
          { agencyBranding: { logoUrl: "https://evil.example/logo.png" } },
          cookie,
        ),
        { auditId: scanId },
      ),
    );
    expect(arbitraryUrlResponse.status).toBe(400);

    // A well-formed path (matches the upload route's own shape) but
    // belonging to a different user's upload — rejected by share.ts's
    // ownership check even though it passes schema validation.
    const { userId: otherUserId, cookie: otherCookie } = await signUpTestUser("AgencyLogoOwner");
    await db.update(schema.users).set({ planId: "agency" }).where(eq(schema.users.id, otherUserId));
    const otherUpload = await logoUploadRoute(
      ctx(formDataRequest("http://x/api/agency-branding/logo", pngFormData(), otherCookie)),
    );
    const otherUploadBody = await readJson<{ logoUrl: string }>(otherUpload);
    if (!otherUploadBody.ok) throw new Error("logo upload failed");

    const idorResponse = await shareRoute(
      ctx(
        jsonRequest(
          "http://x/api/audit/x/share",
          "POST",
          { agencyBranding: { logoUrl: otherUploadBody.data.logoUrl } },
          cookie,
        ),
        { auditId: scanId },
      ),
    );
    expect(idorResponse.status).toBe(403);
  });
});
