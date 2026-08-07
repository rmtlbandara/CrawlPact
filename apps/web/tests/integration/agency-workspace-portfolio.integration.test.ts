import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { createD1TestHarness } from "./d1-harness";
import { createFakeR2Bucket } from "./fake-r2-bucket";
import { createVirtualCredential, simulateRegistration } from "./virtual-authenticator";
import {
  cookieFromResponse,
  ctx,
  jsonRequest,
  mutatingRequest,
  getRequest,
  readJson,
} from "./test-helpers";

const RP_ID = "localhost";
const ORIGIN = "http://localhost:4321";

let mockEnv: Cloudflare.Env;
vi.mock("../../src/lib/env", () => ({ getEnv: () => mockEnv }));

const registerBegin = (await import("../../src/pages/api/auth/register/begin")).POST;
const registerFinish = (await import("../../src/pages/api/auth/register/finish")).POST;
const groupsRoute = await import("../../src/pages/api/groups/index");
const groupDetailRoute = await import("../../src/pages/api/groups/[groupId]/index");
const summaryRoute = (await import("../../src/pages/api/workspace/summary")).GET;
const attentionRoute = (await import("../../src/pages/api/workspace/attention")).GET;
const changesRoute = (await import("../../src/pages/api/workspace/changes")).GET;
const domainsRoute = (await import("../../src/pages/api/workspace/domains")).GET;
const importPreviewRoute = (await import("../../src/pages/api/workspace/import/preview")).POST;
const importConfirmRoute = (await import("../../src/pages/api/workspace/import/confirm")).POST;
const bulkActionsRoute = (await import("../../src/pages/api/workspace/bulk-actions")).POST;
const exportRoute = (await import("../../src/pages/api/domains/export.csv")).GET;
const brandProfileRoute = await import("../../src/pages/api/agency-branding/profile");
const logoUploadRoute = (await import("../../src/pages/api/agency-branding/logo")).POST;

const REAL_PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

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

function importPreviewRequest(csvText: string, cookie: string): Request {
  const formData = new FormData();
  formData.set("file", new File([csvText], "import.csv", { type: "text/csv" }));
  return new Request("http://x/api/workspace/import/preview", {
    method: "POST",
    headers: { Origin: ORIGIN, Cookie: cookie },
    body: formData,
  });
}

describe("Phase 9: agency workspace and portfolio workflows (real D1)", () => {
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

  async function makeAgencyUser(displayName: string) {
    const { cookie, userId } = await signUpTestUser(displayName);
    await db.update(schema.users).set({ planId: "agency" }).where(eq(schema.users.id, userId));
    return { cookie, userId };
  }

  it("keeps portfolio summary, attention queue, change feed, and domain table strictly account-isolated", async () => {
    const { cookie: cookieA, userId: userA } = await makeAgencyUser("PortfolioOwnerA");
    const { cookie: cookieB } = await makeAgencyUser("PortfolioOwnerB");

    const now = new Date().toISOString();
    await db.insert(schema.domains).values({
      id: crypto.randomUUID(),
      ownerUserId: userA,
      displayName: "a-only.com",
      canonicalOrigin: "https://a-only.com",
      originalInput: "a-only.com",
      preset: "maximum_ai_visibility",
      monitoringState: "active",
      monitoringFrequency: "weekly",
      consecutiveFailureCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    const summaryAsB = await summaryRoute(
      ctx(getRequest("http://x/api/workspace/summary", cookieB)),
    );
    const summaryBodyB = await readJson<{ totalDomains: number }>(summaryAsB);
    if (!summaryBodyB.ok) throw new Error("summary failed");
    expect(summaryBodyB.data.totalDomains).toBe(0);

    const summaryAsA = await summaryRoute(
      ctx(getRequest("http://x/api/workspace/summary", cookieA)),
    );
    const summaryBodyA = await readJson<{ totalDomains: number }>(summaryAsA);
    if (!summaryBodyA.ok) throw new Error("summary failed");
    expect(summaryBodyA.data.totalDomains).toBe(1);

    const domainsAsB = await domainsRoute(
      ctx(getRequest("http://x/api/workspace/domains", cookieB)),
    );
    const domainsBodyB = await readJson<{ items: unknown[] }>(domainsAsB);
    if (!domainsBodyB.ok) throw new Error("domains failed");
    expect(domainsBodyB.data.items).toHaveLength(0);

    const attentionAsB = await attentionRoute(
      ctx(getRequest("http://x/api/workspace/attention", cookieB)),
    );
    const attentionBodyB = await readJson<{ items: unknown[] }>(attentionAsB);
    if (!attentionBodyB.ok) throw new Error("attention failed");
    expect(attentionBodyB.data.items).toHaveLength(0);

    const changesAsB = await changesRoute(
      ctx(getRequest("http://x/api/workspace/changes", cookieB)),
    );
    const changesBodyB = await readJson<{ items: unknown[] }>(changesAsB);
    if (!changesBodyB.ok) throw new Error("changes failed");
    expect(changesBodyB.data.items).toHaveLength(0);
  });

  // Note: Cache-Control / X-Robots-Tag on private routes are applied by the
  // global Astro middleware (apps/web/src/middleware.ts), which does not run
  // when a route's exported handler is invoked directly in this harness (no
  // Astro request pipeline). That's covered by e2e tests against a real
  // running server instead — see PHASE_09_AGENCY_WORKSPACE_THREAT_REVIEW.md.

  it("deletes a non-empty group by moving its domains to Ungrouped, preserving domain history", async () => {
    const { cookie, userId } = await makeAgencyUser("GroupDeleteOwner");
    const groupResponse = await groupsRoute.POST(
      ctx(jsonRequest("http://x/groups", "POST", { name: "Client Portfolio" }, cookie)),
    );
    const group = await readJson<{ groupId: string }>(groupResponse);
    if (!group.ok) throw new Error("group creation failed");

    const now = new Date().toISOString();
    const domainId = crypto.randomUUID();
    await db.insert(schema.domains).values({
      id: domainId,
      ownerUserId: userId,
      groupId: group.data.groupId,
      displayName: "grouped.com",
      canonicalOrigin: "https://grouped.com",
      originalInput: "grouped.com",
      preset: "maximum_ai_visibility",
      monitoringState: "active",
      monitoringFrequency: "weekly",
      consecutiveFailureCount: 0,
      notes: "keep me",
      createdAt: now,
      updatedAt: now,
    });

    const deleteResponse = await groupDetailRoute.DELETE(
      ctx(mutatingRequest(`http://x/groups/${group.data.groupId}`, "DELETE", cookie), {
        groupId: group.data.groupId,
      }),
    );
    expect(deleteResponse.status).toBe(200);
    const deleteBody = await readJson<{ movedCount: number }>(deleteResponse);
    if (!deleteBody.ok) throw new Error("delete failed");
    expect(deleteBody.data.movedCount).toBe(1);

    const [domain] = await db.select().from(schema.domains).where(eq(schema.domains.id, domainId));
    expect(domain?.groupId).toBeNull();
    expect(domain?.notes).toBe("keep me");
    expect(domain?.canonicalOrigin).toBe("https://grouped.com");
  });

  it("imports a valid CSV, is idempotent on retry, and never runs a synchronous scan", async () => {
    const { cookie, userId } = await makeAgencyUser("ImportOwner");
    const csvText =
      "domain,display_name\r\nclient-one.com,Client One\r\nclient-two.com,Client Two\r\n";

    const previewResponse = await importPreviewRoute(ctx(importPreviewRequest(csvText, cookie)));
    expect(previewResponse.status).toBe(200);
    const preview = await readJson<{ validRows: number; totalRows: number }>(previewResponse);
    if (!preview.ok) throw new Error("preview failed");
    expect(preview.data.validRows).toBe(2);

    const idempotencyKey = crypto.randomUUID();
    const confirmOnce = await importConfirmRoute(
      ctx(
        jsonRequest(
          "http://x/api/workspace/import/confirm",
          "POST",
          { csvContent: csvText, applyMonitoring: true, idempotencyKey },
          cookie,
        ),
      ),
    );
    expect(confirmOnce.status).toBe(200);
    const confirmOnceBody = await readJson<{ createdDomains: number; jobId: string }>(confirmOnce);
    if (!confirmOnceBody.ok) throw new Error("confirm failed");
    expect(confirmOnceBody.data.createdDomains).toBe(2);

    const domainsAfterFirst = await db
      .select()
      .from(schema.domains)
      .where(eq(schema.domains.ownerUserId, userId));
    expect(domainsAfterFirst).toHaveLength(2);
    // No synchronous scan happened — no scan row exists yet for either domain.
    expect(domainsAfterFirst.every((d) => d.lastScanId === null)).toBe(true);

    const confirmTwice = await importConfirmRoute(
      ctx(
        jsonRequest(
          "http://x/api/workspace/import/confirm",
          "POST",
          { csvContent: csvText, applyMonitoring: true, idempotencyKey },
          cookie,
        ),
      ),
    );
    expect(confirmTwice.status).toBe(200);
    const confirmTwiceBody = await readJson<{ jobId: string; createdDomains: number }>(
      confirmTwice,
    );
    if (!confirmTwiceBody.ok) throw new Error("confirm retry failed");
    expect(confirmTwiceBody.data.jobId).toBe(confirmOnceBody.data.jobId);

    const domainsAfterRetry = await db
      .select()
      .from(schema.domains)
      .where(eq(schema.domains.ownerUserId, userId));
    expect(domainsAfterRetry).toHaveLength(2);
  });

  it("stores a formula-like display name from an import as literal text, never executable", async () => {
    const { cookie } = await makeAgencyUser("ImportFormulaOwner");
    const csvText = "domain,display_name\r\nsafe.com,\"=cmd|'/c calc'!A1\"\r\n";

    const response = await importConfirmRoute(
      ctx(
        jsonRequest(
          "http://x/api/workspace/import/confirm",
          "POST",
          { csvContent: csvText, applyMonitoring: false, idempotencyKey: crypto.randomUUID() },
          cookie,
        ),
      ),
    );
    const body = await readJson<{ createdDomains: number }>(response);
    if (!body.ok) throw new Error("import failed");
    expect(body.data.createdDomains).toBe(1);

    const [domain] = await db
      .select()
      .from(schema.domains)
      .where(eq(schema.domains.canonicalOrigin, "https://safe.com"));
    expect(domain?.displayName).toBe("=cmd|'/c calc'!A1");
  });

  it("rejects a batch larger than the Pro plan's 10-per-import limit, reporting every row rather than silently importing a subset", async () => {
    const { cookie, userId } = await signUpTestUser("ImportOverLimitOwner");
    await db.update(schema.users).set({ planId: "pro" }).where(eq(schema.users.id, userId));
    // 15 rows: within the parser's own 100-row structural cap, but over Pro's business
    // batchImportLimit (10) — exercises buildImportPlan's own batch_limit_exceeded
    // classification, distinct from the parser's separate too_many_rows rejection.
    const rows = Array.from({ length: 15 }, (_, i) => `client-${i}.example.com`).join("\r\n");
    const csvText = `domain\r\n${rows}\r\n`;

    const response = await importConfirmRoute(
      ctx(
        jsonRequest(
          "http://x/api/workspace/import/confirm",
          "POST",
          { csvContent: csvText, applyMonitoring: false, idempotencyKey: crypto.randomUUID() },
          cookie,
        ),
      ),
    );
    expect(response.status).toBe(200);
    const body = await readJson<{ createdDomains: number; totalRows: number }>(response);
    if (!body.ok) throw new Error("request failed");
    expect(body.data.createdDomains).toBe(0);
    expect(body.data.totalRows).toBe(15);

    const savedDomains = await db
      .select()
      .from(schema.domains)
      .where(eq(schema.domains.ownerUserId, userId));
    expect(savedDomains).toHaveLength(0);
  });

  it("rejects a CSV with more rows than the parser's structural cap outright, never a silent subset", async () => {
    const { cookie, userId } = await makeAgencyUser("ImportOverParserCapOwner");
    const rows = Array.from({ length: 101 }, (_, i) => `client-${i}.example.com`).join("\r\n");
    const csvText = `domain\r\n${rows}\r\n`;

    const response = await importConfirmRoute(
      ctx(
        jsonRequest(
          "http://x/api/workspace/import/confirm",
          "POST",
          { csvContent: csvText, applyMonitoring: false, idempotencyKey: crypto.randomUUID() },
          cookie,
        ),
      ),
    );
    expect(response.status).toBe(400);

    const savedDomains = await db
      .select()
      .from(schema.domains)
      .where(eq(schema.domains.ownerUserId, userId));
    expect(savedDomains).toHaveLength(0);
  });

  it("rejects cross-account domain IDs and group IDs in the confirm step", async () => {
    const { cookie: victimCookie, userId: victimUserId } = await makeAgencyUser("ImportVictim");
    const { cookie: attackerCookie } = await makeAgencyUser("ImportAttacker");

    const victimGroup = await groupsRoute.POST(
      ctx(jsonRequest("http://x/groups", "POST", { name: "Victim Group" }, victimCookie)),
    );
    const victimGroupBody = await readJson<{ groupId: string }>(victimGroup);
    if (!victimGroupBody.ok) throw new Error("group creation failed");

    const response = await importConfirmRoute(
      ctx(
        jsonRequest(
          "http://x/api/workspace/import/confirm",
          "POST",
          {
            csvContent: "domain\r\nattacker-target.com\r\n",
            groupId: victimGroupBody.data.groupId,
            applyMonitoring: false,
            idempotencyKey: crypto.randomUUID(),
          },
          attackerCookie,
        ),
      ),
    );
    expect(response.status).toBe(400);

    const victimDomains = await db
      .select()
      .from(schema.domains)
      .where(eq(schema.domains.ownerUserId, victimUserId));
    expect(victimDomains).toHaveLength(0);
  });

  it("CSV export neutralises formula-like values and excludes notes by default", async () => {
    const { cookie, userId } = await makeAgencyUser("ExportOwner");
    const now = new Date().toISOString();
    await db.insert(schema.domains).values({
      id: crypto.randomUUID(),
      ownerUserId: userId,
      displayName: "=SUM(A1:A10)",
      canonicalOrigin: "https://export-target.com",
      originalInput: "export-target.com",
      preset: "maximum_ai_visibility",
      monitoringState: "active",
      monitoringFrequency: "weekly",
      consecutiveFailureCount: 0,
      notes: "private internal note",
      createdAt: now,
      updatedAt: now,
    });

    const response = await exportRoute(ctx(getRequest("http://x/api/domains/export.csv", cookie)));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    const csvText = await response.text();
    expect(csvText).toContain("'=SUM(A1:A10)");
    expect(csvText).not.toContain("private internal note");
  });

  it("CSV export rejects a cross-account domainIds selection (returns only owned rows)", async () => {
    const { userId: victimUserId } = await makeAgencyUser("ExportVictim");
    const { cookie: attackerCookie } = await makeAgencyUser("ExportAttacker");
    const now = new Date().toISOString();
    const victimDomainId = crypto.randomUUID();
    await db.insert(schema.domains).values({
      id: victimDomainId,
      ownerUserId: victimUserId,
      displayName: "victim-only.com",
      canonicalOrigin: "https://victim-only.com",
      originalInput: "victim-only.com",
      preset: "maximum_ai_visibility",
      monitoringState: "active",
      monitoringFrequency: "weekly",
      consecutiveFailureCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    const response = await exportRoute(
      ctx(
        getRequest(`http://x/api/domains/export.csv?domainIds=${victimDomainId}`, attackerCookie),
      ),
    );
    const csvText = await response.text();
    expect(csvText).not.toContain("victim-only.com");
  });

  it("bulk actions re-validate ownership server-side, report per-domain results, and are idempotent", async () => {
    const { cookie, userId } = await makeAgencyUser("BulkOwner");
    const { userId: otherUserId } = await makeAgencyUser("BulkOther");
    const now = new Date().toISOString();
    const ownDomainId = crypto.randomUUID();
    await db.insert(schema.domains).values({
      id: ownDomainId,
      ownerUserId: userId,
      displayName: "bulk-target.com",
      canonicalOrigin: "https://bulk-target.com",
      originalInput: "bulk-target.com",
      preset: "maximum_ai_visibility",
      monitoringState: "active",
      monitoringFrequency: "weekly",
      consecutiveFailureCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    const otherDomainId = crypto.randomUUID();
    await db.insert(schema.domains).values({
      id: otherDomainId,
      ownerUserId: otherUserId,
      displayName: "not-yours.com",
      canonicalOrigin: "https://not-yours.com",
      originalInput: "not-yours.com",
      preset: "maximum_ai_visibility",
      monitoringState: "active",
      monitoringFrequency: "weekly",
      consecutiveFailureCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    const idempotencyKey = crypto.randomUUID();
    const response = await bulkActionsRoute(
      ctx(
        jsonRequest(
          "http://x/api/workspace/bulk-actions",
          "POST",
          {
            action: "pause_monitoring",
            domainIds: [ownDomainId, otherDomainId],
            idempotencyKey,
          },
          cookie,
        ),
      ),
    );
    expect(response.status).toBe(200);
    const body = await readJson<{
      succeededCount: number;
      skippedCount: number;
      results: { domainId: string; outcome: string; reason?: string }[];
    }>(response);
    if (!body.ok) throw new Error("bulk action failed");
    expect(body.data.succeededCount).toBe(1);
    expect(body.data.skippedCount).toBe(1);
    const otherResult = body.data.results.find((r) => r.domainId === otherDomainId);
    expect(otherResult?.outcome).toBe("skipped");
    expect(otherResult?.reason).toBe("not_found_or_cross_account");

    const [ownDomain] = await db
      .select()
      .from(schema.domains)
      .where(eq(schema.domains.id, ownDomainId));
    expect(ownDomain?.monitoringState).toBe("paused");
    const [otherDomain] = await db
      .select()
      .from(schema.domains)
      .where(eq(schema.domains.id, otherDomainId));
    expect(otherDomain?.monitoringState).toBe("active");

    // Retry with the same idempotency key returns the stored job, not a re-execution.
    const retryResponse = await bulkActionsRoute(
      ctx(
        jsonRequest(
          "http://x/api/workspace/bulk-actions",
          "POST",
          { action: "pause_monitoring", domainIds: [ownDomainId, otherDomainId], idempotencyKey },
          cookie,
        ),
      ),
    );
    const retryBody = await readJson<{ jobId: string }>(retryResponse);
    if (!retryBody.ok) throw new Error("retry failed");
    const jobs = await db
      .select()
      .from(schema.bulkActionJobs)
      .where(eq(schema.bulkActionJobs.ownerUserId, userId));
    expect(jobs).toHaveLength(1);
  });

  it("gates agency branding profile updates on the agencyBrandingEnabled entitlement and prevents cross-account access", async () => {
    const { cookie: freeCookie } = await signUpTestUser("BrandingFreeUser");
    const deniedResponse = await brandProfileRoute.PUT(
      ctx(
        jsonRequest(
          "http://x/api/agency-branding/profile",
          "PUT",
          { agencyName: "Not Allowed" },
          freeCookie,
        ),
      ),
    );
    expect(deniedResponse.status).toBe(403);

    const { cookie: agencyCookie } = await makeAgencyUser("BrandingAgencyUser");
    const allowedResponse = await brandProfileRoute.PUT(
      ctx(
        jsonRequest(
          "http://x/api/agency-branding/profile",
          "PUT",
          { agencyName: "Acme Agency" },
          agencyCookie,
        ),
      ),
    );
    expect(allowedResponse.status).toBe(200);

    const getAsFree = await brandProfileRoute.GET(
      ctx(getRequest("http://x/api/agency-branding/profile", freeCookie)),
    );
    const getAsFreeBody = await readJson<{ agencyName: string | null }>(getAsFree);
    if (!getAsFreeBody.ok) throw new Error("profile get failed");
    expect(getAsFreeBody.data.agencyName).toBeNull();

    const getAsAgency = await brandProfileRoute.GET(
      ctx(getRequest("http://x/api/agency-branding/profile", agencyCookie)),
    );
    const getAsAgencyBody = await readJson<{ agencyName: string | null }>(getAsAgency);
    if (!getAsAgencyBody.ok) throw new Error("profile get failed");
    expect(getAsAgencyBody.data.agencyName).toBe("Acme Agency");
  });

  it("treats a profile logo as referenced (not orphaned) by the R2 cleanup sweep even with no share yet", async () => {
    const { cookie } = await makeAgencyUser("ProfileLogoOwner");
    const formData = new FormData();
    formData.set("file", new File([REAL_PNG_BYTES], "logo.png", { type: "image/png" }));
    const uploadResponse = await logoUploadRoute(
      ctx(
        new Request("http://x/api/agency-branding/logo", {
          method: "POST",
          headers: { Origin: ORIGIN, Cookie: cookie },
          body: formData,
        }),
      ),
    );
    const uploadBody = await readJson<{ logoUrl: string }>(uploadResponse);
    if (!uploadBody.ok) throw new Error("logo upload failed");

    await brandProfileRoute.PUT(
      ctx(
        jsonRequest(
          "http://x/api/agency-branding/profile",
          "PUT",
          { logoUrl: uploadBody.data.logoUrl },
          cookie,
        ),
      ),
    );

    const { findAndCleanupOrphanedLogos } = await import("../../src/lib/r2-orphan-cleanup");
    const result = await findAndCleanupOrphanedLogos(db, mockEnv.AGENCY_LOGOS, {
      dryRun: false,
      graceMinutes: 0,
    });
    expect(result.orphansFound).not.toContain(
      uploadBody.data.logoUrl.replace(/^\/api\/agency-branding\/logo\//, ""),
    );

    const stored = await mockEnv.AGENCY_LOGOS.get(
      uploadBody.data.logoUrl.replace(/^\/api\/agency-branding\/logo\//, ""),
    );
    expect(stored).not.toBeNull();
  });
});
