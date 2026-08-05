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
const orphanCleanupRoute = (await import("../../src/pages/api/admin/settings/r2-orphan-cleanup"))
  .POST;

const REAL_PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

type OrphanCleanupResult = {
  scanned: number;
  orphansFound: string[];
  orphansDeleted: number;
  dryRun: boolean;
  truncated: boolean;
};

/**
 * Phase 11, Stage 11D: proves the R2 orphan-cleanup admin route (1) never
 * flags a still-referenced logo object as an orphan, (2) never flags a
 * freshly-uploaded object still inside its grace period, (3) correctly
 * finds a genuine orphan (uploaded, past grace period, no D1 row
 * references it), (4) does not delete anything in dry-run mode, and (5)
 * actually deletes it once dry-run is explicitly turned off.
 */
describe("admin R2 orphan cleanup (real D1 + fake R2)", () => {
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

  async function promoteToSuperAdmin(userId: string): Promise<void> {
    await rawDb.prepare("UPDATE users SET is_admin = 1 WHERE id = ?").bind(userId).run();
    await rawDb
      .prepare(
        `INSERT INTO admin_role_assignments (id, user_id, role_id) VALUES (?, ?, 'super_admin')`,
      )
      .bind(`ara_${userId}`, userId)
      .run();
    await rawDb
      .prepare("UPDATE sessions SET is_admin_session = 1 WHERE user_id = ?")
      .bind(userId)
      .run();
  }

  it("finds a genuine orphan without touching a referenced logo or a fresh upload, and only deletes when dryRun is explicitly false", async () => {
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

    // A real, referenced logo — must never be flagged as an orphan.
    const uploadFormData = new FormData();
    uploadFormData.set("file", new File([REAL_PNG_BYTES], "logo.png", { type: "image/png" }));
    const uploadResponse = await logoUploadRoute(
      ctx(formDataRequest("http://x/api/agency-branding/logo", uploadFormData, cookie)),
    );
    const uploadBody = await readJson<{ logoUrl: string }>(uploadResponse);
    if (!uploadBody.ok) throw new Error("logo upload failed");
    const referencedKey = uploadBody.data.logoUrl.replace(/^\/api\/agency-branding\/logo\//, "");

    await shareRoute(
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

    // A genuine orphan: an object in the bucket with no D1 row referencing
    // it, backdated well past the default 60-minute grace period.
    const orphanKey = `${userId}/${crypto.randomUUID()}.png`;
    await mockEnv.AGENCY_LOGOS.put(orphanKey, REAL_PNG_BYTES, {
      httpMetadata: { contentType: "image/png" },
    });
    (
      mockEnv.AGENCY_LOGOS as unknown as { __setUploadedAt: (k: string, d: Date) => void }
    ).__setUploadedAt(orphanKey, new Date(Date.now() - 2 * 60 * 60 * 1000));

    // A brand-new, unreferenced object still inside its grace period —
    // must never be flagged even though nothing references it yet.
    const freshKey = `${userId}/${crypto.randomUUID()}.png`;
    await mockEnv.AGENCY_LOGOS.put(freshKey, REAL_PNG_BYTES, {
      httpMetadata: { contentType: "image/png" },
    });

    const admin = await signUpTestUser("Ops Admin");
    await promoteToSuperAdmin(admin.userId);

    // Dry run first (also the default): must find the orphan but delete nothing.
    const dryRunResponse = await orphanCleanupRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/settings/r2-orphan-cleanup",
          "POST",
          { reason: "Routine orphan inventory check." },
          admin.cookie,
        ),
      ),
    );
    const dryRunBody = await readJson<OrphanCleanupResult>(dryRunResponse);
    if (!dryRunBody.ok) throw new Error("dry run request failed");
    expect(dryRunBody.data.dryRun).toBe(true);
    expect(dryRunBody.data.orphansFound).toEqual([orphanKey]);
    expect(dryRunBody.data.orphansDeleted).toBe(0);
    expect(await mockEnv.AGENCY_LOGOS.get(orphanKey)).not.toBeNull();
    expect(await mockEnv.AGENCY_LOGOS.get(referencedKey)).not.toBeNull();
    expect(await mockEnv.AGENCY_LOGOS.get(freshKey)).not.toBeNull();

    // Real run: only the genuine orphan is deleted.
    const realRunResponse = await orphanCleanupRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/settings/r2-orphan-cleanup",
          "POST",
          { reason: "Confirmed via dry run — deleting the found orphan.", dryRun: false },
          admin.cookie,
        ),
      ),
    );
    const realRunBody = await readJson<OrphanCleanupResult>(realRunResponse);
    if (!realRunBody.ok) throw new Error("real run request failed");
    expect(realRunBody.data.dryRun).toBe(false);
    expect(realRunBody.data.orphansDeleted).toBe(1);
    expect(await mockEnv.AGENCY_LOGOS.get(orphanKey)).toBeNull();
    expect(await mockEnv.AGENCY_LOGOS.get(referencedKey)).not.toBeNull();
    expect(await mockEnv.AGENCY_LOGOS.get(freshKey)).not.toBeNull();
  });

  it("rejects the request without a reason", async () => {
    const admin = await signUpTestUser("No Reason Admin");
    await promoteToSuperAdmin(admin.userId);

    const response = await orphanCleanupRoute(
      ctx(jsonRequest("http://x/api/admin/settings/r2-orphan-cleanup", "POST", {}, admin.cookie)),
    );
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});
