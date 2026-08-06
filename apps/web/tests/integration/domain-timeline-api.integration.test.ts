import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createD1TestHarness } from "./d1-harness";
import { createFakeR2Bucket } from "./fake-r2-bucket";
import { createVirtualCredential, simulateRegistration } from "./virtual-authenticator";
import { cookieFromResponse, ctx, getRequest, jsonRequest, readJson } from "./test-helpers";
import { generateTimelineEvent } from "../../src/lib/domain-timeline";

/**
 * IDOR and basic-correctness coverage for the three new Phase 8 API routes
 * (timeline, scan history, comparison) — each must treat another account's
 * domain/scan exactly like a nonexistent one (no existence oracle), and
 * every response must carry the account's own real data, not a stub.
 */

let mockEnv: Cloudflare.Env;
vi.mock("../../src/lib/env", () => ({ getEnv: () => mockEnv }));

const registerBegin = (await import("../../src/pages/api/auth/register/begin")).POST;
const registerFinish = (await import("../../src/pages/api/auth/register/finish")).POST;
const createDomainRoute = (await import("../../src/pages/api/domains/index")).POST;
const timelineRoute = (await import("../../src/pages/api/domains/[domainId]/timeline")).GET;
const scansRoute = (await import("../../src/pages/api/domains/[domainId]/scans")).GET;
const compareRoute = (
  await import("../../src/pages/api/domains/[domainId]/compare/[previousScanId]/[currentScanId]")
).GET;

const RP_ID = "localhost";
const ORIGIN = "http://localhost:4321";

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
  const body = await readJson<{ user: { id: string } }>(finishResponse);
  if (!body.ok) throw new Error("finish failed");
  return { cookie, userId: body.data.user.id };
}

describe("Phase 8 timeline/scan-history/comparison API routes (real D1)", () => {
  let dispose: () => Promise<void>;
  let db: Awaited<ReturnType<typeof createD1TestHarness>>["db"];

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

  let ownerCookie: string;
  let strangerCookie: string;
  let domainId: string;
  let previousScanId: string;
  let currentScanId: string;

  it("sets up an owner account with a saved domain and two comparable scans", async () => {
    ({ cookie: ownerCookie } = await signUpTestUser("Timeline Owner"));
    ({ cookie: strangerCookie } = await signUpTestUser("Timeline Stranger"));

    const createResponse = await createDomainRoute(
      ctx(
        jsonRequest(
          "http://x/domains",
          "POST",
          { target: "timeline-api-test.example" },
          ownerCookie,
        ),
      ),
    );
    const created = await readJson<{ domainId: string }>(createResponse);
    if (!created.ok) throw new Error("domain create failed");
    domainId = created.data.domainId;

    const now = new Date().toISOString();
    previousScanId = crypto.randomUUID();
    currentScanId = crypto.randomUUID();
    for (const [scanId, hash] of [
      [previousScanId, "hash_a"],
      [currentScanId, "hash_b"],
    ] as const) {
      await db
        .prepare(
          `INSERT INTO scans (id, domain_id, triggered_by, target_input, canonical_origin, status, preset, registry_version_id, ruleset_version_id, score, score_state, started_at, completed_at)
           VALUES (?, ?, 'manual', 'https://timeline-api-test.example', 'https://timeline-api-test.example', 'completed', 'maximum_ai_visibility', 'reg_test', 'rules_test', 80, 'scored', ?, ?)`,
        )
        .bind(scanId, domainId, now, now)
        .run();
      await db
        .prepare(
          `INSERT INTO scan_resources (id, scan_id, resource_type, requested_url, resource_hash, truncated, snapshot_text, fetched_at)
           VALUES (?, ?, 'robots_txt', 'https://timeline-api-test.example/robots.txt', ?, 0, 'User-agent: *', ?)`,
        )
        .bind(`${scanId}_robots`, scanId, hash, now)
        .run();
    }

    const { createDb } = await import("@crawlpact/database");
    await generateTimelineEvent(createDb(db), { domainId, previousScanId, currentScanId });
  });

  it("returns the owner's real timeline events, including the retention boundary", async () => {
    const response = await timelineRoute(
      ctx(getRequest(`http://x/domains/${domainId}/timeline`, ownerCookie), { domainId }),
    );
    expect(response.status).toBe(200);
    const body = await readJson<{
      events: { changeOrigin: string }[];
      retentionBoundary: { retentionDays: number };
    }>(response);
    if (!body.ok) throw new Error("timeline fetch failed");
    expect(body.data.events.length).toBeGreaterThan(0);
    expect(body.data.events[0]!.changeOrigin).toBe("website_policy");
    expect(body.data.retentionBoundary.retentionDays).toBeGreaterThan(0);
  });

  it("returns 404 (not an existence oracle) for another account's domain timeline", async () => {
    const response = await timelineRoute(
      ctx(getRequest(`http://x/domains/${domainId}/timeline`, strangerCookie), { domainId }),
    );
    expect(response.status).toBe(404);
  });

  it("returns the owner's real scan history with pagination fields", async () => {
    const response = await scansRoute(
      ctx(getRequest(`http://x/domains/${domainId}/scans`, ownerCookie), { domainId }),
    );
    expect(response.status).toBe(200);
    const body = await readJson<{ scans: { scanId: string }[]; nextCursor: unknown }>(response);
    if (!body.ok) throw new Error("scans fetch failed");
    expect(body.data.scans.map((s) => s.scanId).sort()).toEqual(
      [previousScanId, currentScanId].sort(),
    );
  });

  it("returns 404 for another account's scan history (no existence oracle)", async () => {
    const response = await scansRoute(
      ctx(getRequest(`http://x/domains/${domainId}/scans`, strangerCookie), { domainId }),
    );
    expect(response.status).toBe(404);
  });

  it("returns a real compatible comparison for the owner", async () => {
    const response = await compareRoute(
      ctx(
        getRequest(
          `http://x/domains/${domainId}/compare/${previousScanId}/${currentScanId}`,
          ownerCookie,
        ),
        {
          domainId,
          previousScanId,
          currentScanId,
        },
      ),
    );
    expect(response.status).toBe(200);
    const body = await readJson<{ compatible: boolean }>(response);
    if (!body.ok) throw new Error("compare fetch failed");
    expect(body.data.compatible).toBe(true);
  });

  it("returns 404 for another account's comparison, never leaking evidence (cross-account IDOR)", async () => {
    const response = await compareRoute(
      ctx(
        getRequest(
          `http://x/domains/${domainId}/compare/${previousScanId}/${currentScanId}`,
          strangerCookie,
        ),
        { domainId, previousScanId, currentScanId },
      ),
    );
    expect(response.status).toBe(404);
  });

  it("requires authentication on every new route (no cookie)", async () => {
    const timelineResponse = await timelineRoute(
      ctx(getRequest(`http://x/domains/${domainId}/timeline`), { domainId }),
    );
    expect(timelineResponse.status).toBe(401);

    const scansResponse = await scansRoute(
      ctx(getRequest(`http://x/domains/${domainId}/scans`), { domainId }),
    );
    expect(scansResponse.status).toBe(401);

    const compareResponse = await compareRoute(
      ctx(getRequest(`http://x/domains/${domainId}/compare/${previousScanId}/${currentScanId}`), {
        domainId,
        previousScanId,
        currentScanId,
      }),
    );
    expect(compareResponse.status).toBe(401);
  });
});
