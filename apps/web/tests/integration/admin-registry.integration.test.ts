import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { createD1TestHarness } from "./d1-harness";
import { createFakeR2Bucket } from "./fake-r2-bucket";
import { createVirtualCredential, simulateRegistration } from "./virtual-authenticator";
import { cookieFromResponse, ctx, getRequest, jsonRequest, readJson } from "./test-helpers";

let mockEnv: Cloudflare.Env;
vi.mock("../../src/lib/env", () => ({ getEnv: () => mockEnv }));

const registerBegin = (await import("../../src/pages/api/auth/register/begin")).POST;
const registerFinish = (await import("../../src/pages/api/auth/register/finish")).POST;
const createDomainRoute = (await import("../../src/pages/api/domains/index")).POST;

const listOperatorsRoute = (await import("../../src/pages/api/admin/registry/operators/index")).GET;
const createOperatorRoute = (await import("../../src/pages/api/admin/registry/operators/index"))
  .POST;
const listCrawlersRoute = (await import("../../src/pages/api/admin/registry/crawlers/index")).GET;
const createCrawlerRoute = (await import("../../src/pages/api/admin/registry/crawlers/index")).POST;
const verifyCrawlerRoute = (
  await import("../../src/pages/api/admin/registry/crawlers/[crawlerId]/verify")
).POST;
const deprecateCrawlerRoute = (
  await import("../../src/pages/api/admin/registry/crawlers/[crawlerId]/deprecate")
).POST;

const listReleasesRoute = (await import("../../src/pages/api/admin/registry/releases/index")).GET;
const createReleaseRoute = (await import("../../src/pages/api/admin/registry/releases/index")).POST;
const compareReleasesRoute = (await import("../../src/pages/api/admin/registry/releases/compare"))
  .GET;
const publishReleaseRoute = (
  await import("../../src/pages/api/admin/registry/releases/[versionId]/publish")
).POST;
const rollbackReleaseRoute = (
  await import("../../src/pages/api/admin/registry/releases/[versionId]/rollback")
).POST;

const createRulesetRoute = (await import("../../src/pages/api/admin/registry/rulesets/index")).POST;
const publishRulesetRoute = (
  await import("../../src/pages/api/admin/registry/rulesets/[versionId]/publish")
).POST;

const RP_ID = "localhost";
const ORIGIN = "http://localhost:4321";

/** SRS §28.11/§28.12: registry and ruleset administration, against real D1. */
describe("Super Admin registry and ruleset administration (real D1)", () => {
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

  async function signUpTestUser(displayName: string): Promise<{ cookie: string; userId: string }> {
    const beginResponse = await registerBegin(
      ctx(jsonRequest("http://x/register/begin", "POST", { displayName })),
    );
    const begin = await readJson<{
      challengeId: string;
      publicKeyCredentialCreationOptions: { challenge: string };
    }>(beginResponse);
    if (!begin.ok) throw new Error("begin failed");
    const credential = await createVirtualCredential();
    const response = await simulateRegistration(
      credential,
      begin.data.publicKeyCredentialCreationOptions.challenge,
      RP_ID,
      ORIGIN,
    );
    const finishResponse = await registerFinish(
      ctx(
        jsonRequest("http://x/register/finish", "POST", {
          challengeId: begin.data.challengeId,
          credential: response,
        }),
      ),
    );
    const cookie = cookieFromResponse(finishResponse);
    const finishBody = await readJson<{ user: { id: string } }>(finishResponse);
    if (!finishBody.ok) throw new Error("finish failed");
    return { cookie, userId: finishBody.data.user.id };
  }

  let adminCookie: string;
  let normalCookie: string;

  beforeAll(async () => {
    const admin = await signUpTestUser("Ops Admin");
    await db.prepare("UPDATE users SET is_admin = 1 WHERE id = ?").bind(admin.userId).run();
    await db
      .prepare(
        `INSERT INTO admin_role_assignments (id, user_id, role_id) VALUES (?, ?, 'super_admin')`,
      )
      .bind(`ara_${admin.userId}`, admin.userId)
      .run();
    await db
      .prepare("UPDATE sessions SET is_admin_session = 1 WHERE user_id = ?")
      .bind(admin.userId)
      .run();
    adminCookie = admin.cookie;

    const normal = await signUpTestUser("Bystander");
    normalCookie = normal.cookie;
  });

  let operatorId: string;

  it("creates a crawler operator", async () => {
    const response = await createOperatorRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/registry/operators",
          "POST",
          { name: "Test AI Co", reason: "Onboarding a new operator" },
          adminCookie,
        ),
      ),
    );
    expect(response.status).toBe(201);
    const body = await readJson<{ id: string }>(response);
    if (!body.ok) throw new Error("create failed");
    operatorId = body.data.id;

    const listResponse = await listOperatorsRoute(
      ctx(getRequest("http://x/api/admin/registry/operators", adminCookie)),
    );
    const list = await readJson<{ id: string; name: string }[]>(listResponse);
    if (!list.ok) throw new Error("list failed");
    expect(list.data.some((o) => o.id === operatorId)).toBe(true);
  });

  let crawlerId: string;

  it("creates a draft crawler, always starting unverified", async () => {
    const response = await createCrawlerRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/registry/crawlers",
          "POST",
          {
            operatorId,
            name: "AdminTestBot",
            userAgentToken: "AdminTestBot",
            purpose: "search",
            description: "A test crawler.",
            officialSourceUrl: "https://example.test/testbot-docs",
            reason: "Adding a newly announced crawler",
          },
          adminCookie,
        ),
      ),
    );
    expect(response.status).toBe(201);
    const body = await readJson<{ id: string }>(response);
    if (!body.ok) throw new Error("create failed");
    crawlerId = body.data.id;

    const listResponse = await listCrawlersRoute(
      ctx(getRequest("http://x/api/admin/registry/crawlers", adminCookie)),
    );
    const list =
      await readJson<{ crawler: { id: string; lifecycleStatus: string } }[]>(listResponse);
    if (!list.ok) throw new Error("list failed");
    expect(list.data.find((c) => c.crawler.id === crawlerId)?.crawler.lifecycleStatus).toBe(
      "unverified",
    );
  });

  it("verifies the crawler against its official source, marking it active", async () => {
    const response = await verifyCrawlerRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/registry/crawlers/${crawlerId}/verify`,
          "POST",
          {
            officialSourceUrl: "https://example.test/testbot-docs",
            reason: "Confirmed against official docs",
          },
          adminCookie,
        ),
        { crawlerId },
      ),
    );
    expect(response.status).toBe(200);
    const row = await db
      .prepare("SELECT lifecycle_status, last_verified_at FROM crawlers WHERE id = ?")
      .bind(crawlerId)
      .first();
    expect((row as { lifecycle_status: string }).lifecycle_status).toBe("active");
    expect((row as { last_verified_at: string | null }).last_verified_at).not.toBeNull();
  });

  let releaseAId: string;

  it("creates a registry release snapshotting the current crawler set", async () => {
    const response = await createReleaseRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/registry/releases",
          "POST",
          { versionLabel: "test-a", changelog: "Adds TestBot." },
          adminCookie,
        ),
      ),
    );
    expect(response.status).toBe(201);
    const body = await readJson<{ id: string }>(response);
    if (!body.ok) throw new Error("create failed");
    releaseAId = body.data.id;

    const entries = await db
      .prepare("SELECT COUNT(*) as n FROM registry_version_entries WHERE registry_version_id = ?")
      .bind(releaseAId)
      .first();
    expect((entries as { n: number }).n).toBeGreaterThanOrEqual(1);
  });

  it("publishes the first release", async () => {
    const response = await publishReleaseRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/registry/releases/${releaseAId}/publish`,
          "POST",
          { reason: "Initial publish for testing" },
          adminCookie,
        ),
        { versionId: releaseAId },
      ),
    );
    expect(response.status).toBe(200);
    const row = await db
      .prepare("SELECT is_active FROM registry_versions WHERE id = ?")
      .bind(releaseAId)
      .first();
    expect((row as { is_active: number }).is_active).toBe(1);
  });

  it("deprecates the crawler with a replacement, then a new release reflects the change, detected by compare", async () => {
    const [operator2] = await Promise.all([
      createOperatorRoute(
        ctx(
          jsonRequest(
            "http://x/api/admin/registry/operators",
            "POST",
            { name: "Test AI Co 2", reason: "Second operator for replacement crawler" },
            adminCookie,
          ),
        ),
      ),
    ]);
    const op2Body = await readJson<{ id: string }>(operator2);
    if (!op2Body.ok) throw new Error("operator2 failed");

    const replacementResponse = await createCrawlerRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/registry/crawlers",
          "POST",
          {
            operatorId: op2Body.data.id,
            name: "AdminTestBotReplacement",
            userAgentToken: "AdminTestBotReplacement",
            purpose: "search",
            description: "Replacement crawler.",
            officialSourceUrl: "https://example.test/testbot2-docs",
            reason: "Replacement crawler for TestBot",
          },
          adminCookie,
        ),
      ),
    );
    const replacementBody = await readJson<{ id: string }>(replacementResponse);
    if (!replacementBody.ok) throw new Error("replacement create failed");

    const deprecateResponse = await deprecateCrawlerRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/registry/crawlers/${crawlerId}/deprecate`,
          "POST",
          {
            status: "replaced",
            replacementCrawlerId: replacementBody.data.id,
            reason: "TestBot superseded",
          },
          adminCookie,
        ),
        { crawlerId },
      ),
    );
    expect(deprecateResponse.status).toBe(200);

    const createReleaseBResponse = await createReleaseRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/registry/releases",
          "POST",
          { versionLabel: "test-b", changelog: "TestBot replaced by AdminTestBotReplacement." },
          adminCookie,
        ),
      ),
    );
    const releaseB = await readJson<{ id: string }>(createReleaseBResponse);
    if (!releaseB.ok) throw new Error("release B create failed");

    const compareResponse = await compareReleasesRoute(
      ctx(
        getRequest(
          `http://x/api/admin/registry/releases/compare?from=${releaseAId}&to=${releaseB.data.id}`,
          adminCookie,
        ),
      ),
    );
    const compareBody = await readJson<{
      comparison: { added: string[]; changed: { crawlerId: string }[] };
    }>(compareResponse);
    if (!compareBody.ok) throw new Error("compare failed");
    expect(compareBody.data.comparison.changed.some((c) => c.crawlerId === crawlerId)).toBe(true);
  });

  it("publishing a new release schedules affected domains for re-evaluation", async () => {
    const target = await signUpTestUser("Domain Owner");
    const domainResponse = await createDomainRoute(
      ctx(jsonRequest("http://x/domains", "POST", { target: "example.com" }, target.cookie)),
    );
    const domainBody = await readJson<{ domainId: string }>(domainResponse);
    if (!domainBody.ok) throw new Error("domain create failed");

    // Attach a scan_crawler_results row for the deprecated crawler so this
    // domain is genuinely "affected" by the upcoming publish.
    const scanId = "scan_test_affected";
    const now = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO scans (id, domain_id, triggered_by, target_input, canonical_origin, status, score_state, started_at, completed_at)
         VALUES (?, ?, 'manual', 'example.com', 'https://example.com', 'completed', 'scored', ?, ?)`,
      )
      .bind(scanId, domainBody.data.domainId, now, now)
      .run();
    await db
      .prepare("UPDATE domains SET last_scan_id = ? WHERE id = ?")
      .bind(scanId, domainBody.data.domainId)
      .run();
    await db
      .prepare(
        "INSERT INTO scan_crawler_results (id, scan_id, crawler_id, result) VALUES (?, ?, ?, 'blocked')",
      )
      .bind("scr_test_1", scanId, crawlerId)
      .run();

    const createReleaseCResponse = await createReleaseRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/registry/releases",
          "POST",
          { versionLabel: "test-c", changelog: "Promoting replacement." },
          adminCookie,
        ),
      ),
    );
    const releaseC = await readJson<{ id: string }>(createReleaseCResponse);
    if (!releaseC.ok) throw new Error("release C create failed");

    const publishResponse = await publishReleaseRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/registry/releases/${releaseC.data.id}/publish`,
          "POST",
          { reason: "Promoting AdminTestBotReplacement as the active release" },
          adminCookie,
        ),
        { versionId: releaseC.data.id },
      ),
    );
    const publishBody = await readJson<{ domainsScheduledForReEvaluation: number }>(
      publishResponse,
    );
    if (!publishBody.ok) throw new Error("publish failed");
    expect(publishBody.data.domainsScheduledForReEvaluation).toBeGreaterThanOrEqual(1);

    const domainRow = await db
      .prepare("SELECT next_scan_at FROM domains WHERE id = ?")
      .bind(domainBody.data.domainId)
      .first();
    expect((domainRow as { next_scan_at: string }).next_scan_at).toBeTruthy();
  });

  it("rolls back to the first release without deleting the later ones", async () => {
    const response = await rollbackReleaseRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/registry/releases/${releaseAId}/rollback`,
          "POST",
          { reason: "Reverting due to an unrelated incident" },
          adminCookie,
        ),
        { versionId: releaseAId },
      ),
    );
    expect(response.status).toBe(200);

    const activeRow = await db
      .prepare("SELECT id FROM registry_versions WHERE is_active = 1")
      .first();
    expect((activeRow as { id: string }).id).toBe(releaseAId);

    const stillExists = await db.prepare("SELECT id FROM registry_versions").all();
    expect(stillExists.results.length).toBeGreaterThanOrEqual(3);

    const listResponse = await listReleasesRoute(
      ctx(getRequest("http://x/api/admin/registry/releases", adminCookie)),
    );
    const list = await readJson<{ id: string }[]>(listResponse);
    if (!list.ok) throw new Error("list failed");
    expect(list.data.length).toBeGreaterThanOrEqual(3);
  });

  it("registers and publishes a ruleset version", async () => {
    const createResponse = await createRulesetRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/registry/rulesets",
          "POST",
          { versionLabel: "rules-test-1", description: "Testing ruleset version management." },
          adminCookie,
        ),
      ),
    );
    expect(createResponse.status).toBe(201);
    const body = await readJson<{ id: string }>(createResponse);
    if (!body.ok) throw new Error("create failed");

    const publishResponse = await publishRulesetRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/registry/rulesets/${body.data.id}/publish`,
          "POST",
          { reason: "Promoting new ruleset" },
          adminCookie,
        ),
        { versionId: body.data.id },
      ),
    );
    expect(publishResponse.status).toBe(200);
  });

  it("rejects a non-admin from every registry/ruleset route", async () => {
    const response = await listOperatorsRoute(
      ctx(getRequest("http://x/api/admin/registry/operators", normalCookie)),
    );
    expect(response.status).toBe(403);
  });
});
