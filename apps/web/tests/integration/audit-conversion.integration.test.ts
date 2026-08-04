import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { eq } from "drizzle-orm";
import type { DnsResolver } from "@crawlpact/scanner";
import { createD1TestHarness } from "./d1-harness";
import { createFakeR2Bucket } from "./fake-r2-bucket";
import { createVirtualCredential, simulateRegistration } from "./virtual-authenticator";
import {
  cookieFromResponse,
  ctx,
  getRequest,
  jsonRequest,
  mutatingRequest,
  readJson,
} from "./test-helpers";

let mockEnv: Cloudflare.Env;
vi.mock("../../src/lib/env", () => ({ getEnv: () => mockEnv }));

const registerBegin = (await import("../../src/pages/api/auth/register/begin")).POST;
const registerFinish = (await import("../../src/pages/api/auth/register/finish")).POST;
const createContinuationRoute = (await import("../../src/pages/api/audit/[auditId]/continuation"))
  .POST;
const completeContinuationRoute = (
  await import("../../src/pages/api/audit/continuation/[continuationId]")
).POST;
const createDomainRoute = (await import("../../src/pages/api/domains/index")).POST;
const getDomainRoute = (await import("../../src/pages/api/domains/[domainId]/index")).GET;
const { getActiveRegistry } = await import("../../src/lib/registry-data");
const { runAudit } = await import("../../src/lib/run-audit");
const { persistScan } = await import("../../src/lib/persist-scan");

const RP_ID = "localhost";
const ORIGIN = "http://localhost:4321";

// Real DNS-over-HTTPS resolution needs outbound network this sandboxed test
// environment doesn't have — same fake resolver as
// audit-report-signals.integration.test.ts.
const publicResolver: DnsResolver = async () => ({ ok: true, addresses: ["93.184.216.34"] });

function robotsAllowAllFetch(): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/robots.txt")) {
      return new Response("User-agent: *\nAllow: /\n", { status: 200 });
    }
    if (url.endsWith("/sitemap.xml")) return new Response("", { status: 404 });
    return new Response("<html></html>", { status: 200 });
  }) as unknown as typeof fetch;
}

/**
 * Proves the Phase 5 conversion flow — creating and consuming an
 * `audit_continuations` record, adopting or rerunning the underlying scan,
 * saving the domain, and leaving monitoring paused until an explicit later
 * step — against a real D1 instance and the real HTTP route handlers, not
 * mocks. See docs/security/PHASE_05_AUDIT_CONVERSION_THREAT_REVIEW.md and
 * docs/product/ANONYMOUS_TO_AUTHENTICATED_BASELINE_POLICY.md for the design
 * this exercises.
 */
describe("anonymous audit continuation and account conversion (real D1)", () => {
  let dispose: () => Promise<void>;
  let db: Database;
  const originalFetch = globalThis.fetch;

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

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  async function signUpUser(displayName: string): Promise<{ cookie: string; userId: string }> {
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

  /** Seeds a real, fully-persisted anonymous scan — bypassing the disabled anonymous /api/audit
   * HTTP endpoint, exactly like audit-report-signals.integration.test.ts's runAndPersistScan. */
  async function seedAnonymousScan(
    target: string,
    overrides: { status?: "completed" | "target_unavailable" } = {},
  ): Promise<{ scanId: string; canonicalOrigin: string }> {
    globalThis.fetch = robotsAllowAllFetch();
    const registry = await getActiveRegistry(db);
    if (!registry) throw new Error("no active registry in test harness");

    const result = await runAudit(
      target,
      "maximum_ai_visibility",
      registry.crawlers,
      registry.rulesetVersionId,
      { resolver: publicResolver },
    );

    const scanId = crypto.randomUUID();
    await persistScan(
      db,
      {
        scanId,
        targetInput: target,
        preset: "maximum_ai_visibility",
        registryVersionId: registry.registryVersionId,
        rulesetVersionId: registry.rulesetVersionId,
      },
      result,
    );

    if (overrides.status) {
      await db
        .update(schema.scans)
        .set({ status: overrides.status })
        .where(eq(schema.scans.id, scanId));
    }

    const [scan] = await db.select().from(schema.scans).where(eq(schema.scans.id, scanId)).limit(1);
    return { scanId, canonicalOrigin: scan!.canonicalOrigin };
  }

  async function createContinuation(
    auditId: string,
    intendedAction: "save_and_monitor" | "save_only" = "save_and_monitor",
  ): Promise<{ continuationId: string; expiresAt: string }> {
    const response = await createContinuationRoute(
      ctx(jsonRequest(`http://x/audit/${auditId}/continuation`, "POST", { intendedAction }), {
        auditId,
      }),
    );
    expect(response.status).toBe(201);
    const body = await readJson<{ continuationId: string; expiresAt: string }>(response);
    if (!body.ok) throw new Error("continuation create failed");
    return body.data;
  }

  it("creates a continuation for a completed anonymous scan without requiring a session", async () => {
    const { scanId } = await seedAnonymousScan("https://conversion-one.example");
    const { continuationId, expiresAt } = await createContinuation(scanId);
    expect(continuationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("rejects creating a continuation for a scan that did not complete successfully", async () => {
    const { scanId } = await seedAnonymousScan("https://conversion-unavailable.example", {
      status: "target_unavailable",
    });
    const response = await createContinuationRoute(
      ctx(
        jsonRequest(`http://x/audit/${scanId}/continuation`, "POST", {
          intendedAction: "save_and_monitor",
        }),
        { auditId: scanId },
      ),
    );
    expect(response.status).toBe(400);
    const body = await readJson(response);
    if (!body.ok) expect(body.error.code).toBe("VALIDATION_FAILED");
  });

  it("returns AUDIT_NOT_FOUND for a continuation request against an unknown audit id", async () => {
    const response = await createContinuationRoute(
      ctx(
        jsonRequest("http://x/audit/does-not-exist/continuation", "POST", {
          intendedAction: "save_only",
        }),
        { auditId: "does-not-exist" },
      ),
    );
    expect(response.status).toBe(404);
  });

  it("requires a session to complete a continuation", async () => {
    const { scanId } = await seedAnonymousScan("https://conversion-noauth.example");
    const { continuationId } = await createContinuation(scanId);

    const response = await completeContinuationRoute(
      ctx(mutatingRequest(`http://x/audit/continuation/${continuationId}`, "POST"), {
        continuationId,
      }),
    );
    expect(response.status).toBe(401);
  });

  it("completes the full lifecycle: adopts the anonymous scan, saves the domain, leaves monitoring paused", async () => {
    const { scanId, canonicalOrigin } = await seedAnonymousScan("https://conversion-full.example");
    const { continuationId } = await createContinuation(scanId, "save_and_monitor");
    const { cookie } = await signUpUser("Full Flow User");

    const response = await completeContinuationRoute(
      ctx(mutatingRequest(`http://x/audit/continuation/${continuationId}`, "POST", cookie), {
        continuationId,
      }),
    );
    expect(response.status).toBe(200);
    const body = await readJson<{
      domainId: string;
      canonicalOrigin: string;
      baselineEstablished: boolean;
      baselineStrategy: "adopted" | "rerun" | null;
      monitoringEligible: boolean;
    }>(response);
    if (!body.ok) throw new Error("complete failed");
    expect(body.data.canonicalOrigin).toBe(canonicalOrigin);
    expect(body.data.baselineEstablished).toBe(true);
    expect(body.data.baselineStrategy).toBe("adopted");
    expect(body.data.monitoringEligible).toBe(false); // free plan: monitoringFrequency "none"

    const domainResponse = await getDomainRoute(
      ctx(getRequest(`http://x/domains/${body.data.domainId}`, cookie), {
        domainId: body.data.domainId,
      }),
    );
    const domain = await readJson<{
      monitoringState: string;
      lastScanAt: string | null;
      currentScore: number | null;
    }>(domainResponse);
    if (!domain.ok) throw new Error("get domain failed");
    expect(domain.data.monitoringState).toBe("paused");
    expect(domain.data.lastScanAt).not.toBeNull();

    const [domainRow] = await db
      .select()
      .from(schema.domains)
      .where(eq(schema.domains.id, body.data.domainId));
    expect(domainRow!.lastScanId).toBe(scanId);

    const [claimedScan] = await db.select().from(schema.scans).where(eq(schema.scans.id, scanId));
    expect(claimedScan!.domainId).toBe(body.data.domainId);
    expect(claimedScan!.triggeredBy).toBe("manual");
  });

  it("rejects an expired continuation with AUDIT_CONTINUATION_INVALID", async () => {
    const { scanId } = await seedAnonymousScan("https://conversion-expired.example");
    const { continuationId } = await createContinuation(scanId);
    await db
      .update(schema.auditContinuations)
      .set({ expiresAt: new Date(Date.now() - 60_000).toISOString() })
      .where(eq(schema.auditContinuations.id, continuationId));

    const { cookie } = await signUpUser("Expired Link User");
    const response = await completeContinuationRoute(
      ctx(mutatingRequest(`http://x/audit/continuation/${continuationId}`, "POST", cookie), {
        continuationId,
      }),
    );
    expect(response.status).toBe(410);
    const body = await readJson(response);
    if (!body.ok) {
      expect(body.error.code).toBe("AUDIT_CONTINUATION_INVALID");
      expect(body.error.message).toMatch(/expired/i);
    }
  });

  it("rejects a replayed (already-consumed) continuation on the second attempt", async () => {
    const { scanId } = await seedAnonymousScan("https://conversion-replay.example");
    const { continuationId } = await createContinuation(scanId);
    const { cookie } = await signUpUser("Replay User");

    const first = await completeContinuationRoute(
      ctx(mutatingRequest(`http://x/audit/continuation/${continuationId}`, "POST", cookie), {
        continuationId,
      }),
    );
    expect(first.status).toBe(200);

    const second = await completeContinuationRoute(
      ctx(mutatingRequest(`http://x/audit/continuation/${continuationId}`, "POST", cookie), {
        continuationId,
      }),
    );
    expect(second.status).toBe(410);
    const secondBody = await readJson(second);
    if (!secondBody.ok) {
      expect(secondBody.error.code).toBe("AUDIT_CONTINUATION_INVALID");
      expect(secondBody.error.message).toMatch(/already been used/i);
    }
  });

  it("returns AUDIT_CONTINUATION_INVALID for a continuation id that never existed", async () => {
    const { cookie } = await signUpUser("Bogus Link User");
    const response = await completeContinuationRoute(
      ctx(mutatingRequest("http://x/audit/continuation/not-a-real-id", "POST", cookie), {
        continuationId: "not-a-real-id",
      }),
    );
    expect(response.status).toBe(410);
    const body = await readJson(response);
    if (!body.ok) expect(body.error.code).toBe("AUDIT_CONTINUATION_INVALID");
  });

  it("reuses an already-saved domain instead of creating a duplicate", async () => {
    const { cookie } = await signUpUser("Existing Domain User");
    const existing = await createDomainRoute(
      ctx(
        jsonRequest("http://x/domains", "POST", { target: "conversion-existing.example" }, cookie),
      ),
    );
    const existingBody = await readJson<{ domainId: string }>(existing);
    if (!existingBody.ok) throw new Error("pre-create failed");

    const { scanId } = await seedAnonymousScan("https://conversion-existing.example");
    const { continuationId } = await createContinuation(scanId);

    const response = await completeContinuationRoute(
      ctx(mutatingRequest(`http://x/audit/continuation/${continuationId}`, "POST", cookie), {
        continuationId,
      }),
    );
    expect(response.status).toBe(200);
    const body = await readJson<{ domainId: string }>(response);
    if (!body.ok) throw new Error("complete failed");
    expect(body.data.domainId).toBe(existingBody.data.domainId);
  });

  it("returns DOMAIN_LIMIT_REACHED on the free plan's saved-domain limit instead of silently failing", async () => {
    const { cookie } = await signUpUser("Limited User");
    await createDomainRoute(
      ctx(
        jsonRequest(
          "http://x/domains",
          "POST",
          { target: "conversion-limit-first.example" },
          cookie,
        ),
      ),
    );

    const { scanId } = await seedAnonymousScan("https://conversion-limit-second.example");
    const { continuationId } = await createContinuation(scanId);

    const response = await completeContinuationRoute(
      ctx(mutatingRequest(`http://x/audit/continuation/${continuationId}`, "POST", cookie), {
        continuationId,
      }),
    );
    expect(response.status).toBe(403);
    const body = await readJson(response);
    if (!body.ok) expect(body.error.code).toBe("DOMAIN_LIMIT_REACHED");
  });

  it("falls back to a rerun (rather than a privacy-leaking adoption) once the scan is already claimed by a different account, and honestly reports it could not complete while the engine is disabled", async () => {
    const { scanId } = await seedAnonymousScan("https://conversion-race.example");

    const firstContinuation = await createContinuation(scanId);
    const { cookie: firstCookie } = await signUpUser("Race Winner");
    const firstComplete = await completeContinuationRoute(
      ctx(
        mutatingRequest(
          `http://x/audit/continuation/${firstContinuation.continuationId}`,
          "POST",
          firstCookie,
        ),
        {
          continuationId: firstContinuation.continuationId,
        },
      ),
    );
    expect(firstComplete.status).toBe(200);
    const firstBody = await readJson<{ domainId: string; baselineStrategy: string }>(firstComplete);
    if (firstBody.ok) expect(firstBody.data.baselineStrategy).toBe("adopted");

    // A second continuation against the very same already-claimed scan (e.g. a second browser
    // tab that clicked "Save" before the first tab's save completed).
    const secondContinuation = await createContinuation(scanId);
    const { cookie: secondCookie } = await signUpUser("Race Loser");
    const secondComplete = await completeContinuationRoute(
      ctx(
        mutatingRequest(
          `http://x/audit/continuation/${secondContinuation.continuationId}`,
          "POST",
          secondCookie,
        ),
        {
          continuationId: secondContinuation.continuationId,
        },
      ),
    );
    expect(secondComplete.status).toBe(200);
    const secondBody = await readJson<{
      domainId: string;
      baselineEstablished: boolean;
      warning: string | null;
    }>(secondComplete);
    if (!secondBody.ok) throw new Error("second complete failed");
    // The loser gets their own, separate domain row — never a peek at the winner's account.
    if (firstBody.ok) expect(secondBody.data.domainId).not.toBe(firstBody.data.domainId);
    // Falls through to rerun; with the audit engine disabled in this harness, that rerun cannot
    // actually run — proving the honest, non-fabricated failure path (KNOWN_RISKS.md), not a
    // silent adoption of someone else's scan.
    expect(secondBody.data.baselineEstablished).toBe(false);
    expect(secondBody.data.warning).toMatch(/engine is not enabled/i);
  });
});
