import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { D1Database } from "@cloudflare/workers-types";
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
const shareRoute = (await import("../../src/pages/api/audit/[auditId]/share")).POST;
const logoUploadRoute = (await import("../../src/pages/api/agency-branding/logo")).POST;
const adminRevokeRoute = (await import("../../src/pages/api/admin/shared-reports/[shareId]/revoke"))
  .POST;

const REAL_PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

/**
 * SRS §29/§28.9/§28.14: an admin-revoked shared report's uploaded agency
 * logo must actually be deleted from R2, not just orphaned — see
 * docs/data/DATA_RETENTION.md's "R2 deletion coordinated with the D1
 * reference" rule and adminRevokeShare()/revoke.ts.
 */
describe("admin shared-report revoke deletes the attached R2 logo object (real D1)", () => {
  let dispose: () => Promise<void>;
  let db: Database;
  let rawDb: D1Database;

  beforeAll(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    rawDb = harness.db as unknown as D1Database;
    db = createDb(harness.db);
    mockEnv = {
      DB: harness.db as unknown as D1Database,
      AGENCY_LOGOS: createFakeR2Bucket(),
      PUBLIC_APP_ENV: "local",
      PUBLIC_SITE_URL: ORIGIN,
      SESSION_SIGNING_SECRET: "integration-test-secret-value-long-enough",
      WEBAUTHN_RP_ID: RP_ID,
      WEBAUTHN_RP_ORIGIN: ORIGIN,
      PADDLE_API_KEY: "test",
      PADDLE_ENVIRONMENT: "sandbox",
      PADDLE_WEBHOOK_SECRET: "test",
      PADDLE_PRICE_ID_SOLO: "pri_solo",
      PADDLE_PRICE_ID_PRO: "pri_pro",
      PADDLE_PRICE_ID_AGENCY: "pri_agency",
      PUBLIC_PADDLE_CLIENT_TOKEN: "test",
      BILLING_ENABLED: "false",
      AUDIT_ENGINE_ENABLED: "false",
    };
  });

  afterAll(async () => {
    await dispose();
  });

  async function signUpTestUser(displayName: string): Promise<{ cookie: string; userId: string }> {
    const beginResponse = await registerBegin(
      ctx(jsonRequest("http://x/register/begin", "POST", { displayName })),
    );
    const begin = await readJson<{
      challengeId: string;
      publicKeyCredentialCreationOptions: { challenge: string };
    }>(beginResponse);
    if (!begin.ok) throw new Error("register begin failed");

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
    if (!finish.ok) throw new Error("register finish failed");
    return { cookie: cookieFromResponse(finishResponse), userId: finish.data.user.id };
  }

  it("deletes the R2 object when an admin revokes a branded share", async () => {
    const { cookie, userId } = await signUpTestUser("AgencyOwner");
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
      monitoringFrequency: "none",
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

    const uploadFormData = new FormData();
    uploadFormData.set("file", new File([REAL_PNG_BYTES], "logo.png", { type: "image/png" }));
    const uploadResponse = await logoUploadRoute(
      ctx(formDataRequest("http://x/api/agency-branding/logo", uploadFormData, cookie)),
    );
    const uploadBody = await readJson<{ logoUrl: string }>(uploadResponse);
    if (!uploadBody.ok) throw new Error("logo upload failed");
    const objectKey = uploadBody.data.logoUrl.replace(/^\/api\/agency-branding\/logo\//, "");

    // Sanity check: the object is really there before revoke.
    expect(await mockEnv.AGENCY_LOGOS.get(objectKey)).not.toBeNull();

    const shareResponse = await shareRoute(
      ctx(
        jsonRequest(
          "http://x/api/audit/x/share",
          "POST",
          { agencyBranding: { agencyName: "Acme SEO Agency", logoUrl: uploadBody.data.logoUrl } },
          cookie,
        ),
        { auditId: scanId },
      ),
    );
    const shareBody = await readJson<{ shareId: string }>(shareResponse);
    if (!shareBody.ok) throw new Error("share creation failed");

    const admin = await signUpTestUser("Ops Admin");
    await rawDb.prepare("UPDATE users SET is_admin = 1 WHERE id = ?").bind(admin.userId).run();
    await rawDb
      .prepare(
        `INSERT INTO admin_role_assignments (id, user_id, role_id) VALUES (?, ?, 'super_admin')`,
      )
      .bind(`ara_${admin.userId}`, admin.userId)
      .run();
    await rawDb
      .prepare("UPDATE sessions SET is_admin_session = 1 WHERE user_id = ?")
      .bind(admin.userId)
      .run();

    const revokeResponse = await adminRevokeRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/shared-reports/${shareBody.data.shareId}/revoke`,
          "POST",
          { reason: "Customer requested takedown during support ticket #123." },
          admin.cookie,
        ),
        { shareId: shareBody.data.shareId },
      ),
    );
    expect(revokeResponse.status).toBe(200);

    // The R2 object is now gone — not just the D1 revokedAt flag.
    expect(await mockEnv.AGENCY_LOGOS.get(objectKey)).toBeNull();
  });
});
