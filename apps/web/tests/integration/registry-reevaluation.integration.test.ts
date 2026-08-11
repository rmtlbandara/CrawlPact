import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { createD1TestHarness } from "./d1-harness";
import { createFakeR2Bucket } from "./fake-r2-bucket";
import { createVirtualCredential, simulateRegistration } from "./virtual-authenticator";
import { cookieFromResponse, ctx, jsonRequest, readJson } from "./test-helpers";

let mockEnv: Cloudflare.Env;
vi.mock("../../src/lib/env", () => ({ getEnv: () => mockEnv }));

const registerBegin = (await import("../../src/pages/api/auth/register/begin")).POST;
const registerFinish = (await import("../../src/pages/api/auth/register/finish")).POST;
const createDomainRoute = (await import("../../src/pages/api/domains/index")).POST;
const createReleaseRoute = (await import("../../src/pages/api/admin/registry/releases/index")).POST;
const publishReleaseRoute = (
  await import("../../src/pages/api/admin/registry/releases/[versionId]/publish")
).POST;
const rollbackReleaseRoute = (
  await import("../../src/pages/api/admin/registry/releases/[versionId]/rollback")
).POST;

const RP_ID = "localhost";
const ORIGIN = "http://localhost:4321";

/**
 * Phase 15 Section 138/141 — re-evaluation scheduling tests. Covers the two
 * scenarios not already exercised by `admin-registry.integration.test.ts`'s
 * existing "schedules affected domains" test (which uses an
 * evaluation-semantic lifecycle change):
 *
 * 1. A source-only (evidence-class) change must schedule ZERO
 *    re-evaluations — the direct regression test for the confirmed
 *    pre-Phase-15 bug where any field edit, including a URL move, counted
 *    as "changed" and could trigger customer re-scans.
 * 2. Rollback must schedule re-evaluation exactly like a forward publish —
 *    the Section 65 fix (previously rollback only moved the pointer).
 */
describe("registry re-evaluation scheduling (real D1)", () => {
  let dispose: () => Promise<void>;
  let rawDb: D1Database;
  let adminCookie: string;
  let crawlerId: string;

  beforeEach(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    rawDb = harness.db as unknown as D1Database;
    mockEnv = {
      DB: harness.db,
      AGENCY_LOGOS: createFakeR2Bucket(),
      PUBLIC_APP_ENV: "local",
      PUBLIC_SITE_URL: ORIGIN,
      SESSION_SIGNING_SECRET: "integration-test-secret-value-long-enough",
      ABUSE_MONITORING_SECRET: "integration-test-abuse-secret-value-long-enough",
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

    const beginResponse = await registerBegin(
      ctx(jsonRequest("http://x/register/begin", "POST", { displayName: "Reeval Test Admin" })),
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
    adminCookie = cookieFromResponse(finishResponse);
    const finishBody = await readJson<{ user: { id: string } }>(finishResponse);
    if (!finishBody.ok) throw new Error("finish failed");
    await rawDb
      .prepare("UPDATE users SET is_admin = 1 WHERE id = ?")
      .bind(finishBody.data.user.id)
      .run();
    await rawDb
      .prepare(
        `INSERT INTO admin_role_assignments (id, user_id, role_id) VALUES (?, ?, 'super_admin')`,
      )
      .bind(`ara_${finishBody.data.user.id}`, finishBody.data.user.id)
      .run();
    await rawDb
      .prepare("UPDATE sessions SET is_admin_session = 1 WHERE user_id = ?")
      .bind(finishBody.data.user.id)
      .run();

    crawlerId = "crawler_test"; // seeded by d1-harness.ts
  });

  afterEach(async () => {
    await dispose();
  });

  async function seedAffectedDomain(): Promise<string> {
    const target = await registerBegin(
      ctx(jsonRequest("http://x/register/begin", "POST", { displayName: "Domain Owner" })),
    );
    const targetBegin = await readJson<{
      challengeId: string;
      publicKeyCredentialCreationOptions: { challenge: string };
    }>(target);
    if (!targetBegin.ok) throw new Error("target begin failed");
    const targetCredential = await simulateRegistration(
      await createVirtualCredential(),
      targetBegin.data.publicKeyCredentialCreationOptions.challenge,
      RP_ID,
      ORIGIN,
    );
    const targetFinish = await registerFinish(
      ctx(
        jsonRequest("http://x/register/finish", "POST", {
          challengeId: targetBegin.data.challengeId,
          credential: targetCredential,
        }),
      ),
    );
    const targetCookie = cookieFromResponse(targetFinish);

    const domainResponse = await createDomainRoute(
      ctx(
        jsonRequest(
          "http://x/domains",
          "POST",
          { target: "reeval-test.example.com" },
          targetCookie,
        ),
      ),
    );
    const domainBody = await readJson<{ domainId: string }>(domainResponse);
    if (!domainBody.ok) throw new Error("domain create failed");

    const scanId = `scan_reeval_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    await rawDb
      .prepare(
        `INSERT INTO scans (id, domain_id, triggered_by, target_input, canonical_origin, status, score_state, started_at, completed_at)
         VALUES (?, ?, 'manual', 'reeval-test.example.com', 'https://reeval-test.example.com', 'completed', 'scored', ?, ?)`,
      )
      .bind(scanId, domainBody.data.domainId, now, now)
      .run();
    await rawDb
      .prepare("UPDATE domains SET last_scan_id = ? WHERE id = ?")
      .bind(scanId, domainBody.data.domainId)
      .run();
    await rawDb
      .prepare(
        "INSERT INTO scan_crawler_results (id, scan_id, crawler_id, result) VALUES (?, ?, ?, 'blocked')",
      )
      .bind(`scr_reeval_${crypto.randomUUID().slice(0, 8)}`, scanId, crawlerId)
      .run();

    return domainBody.data.domainId;
  }

  it("a source-URL-only (evidence-class) change schedules ZERO re-evaluations", async () => {
    const domainId = await seedAffectedDomain();

    // Evidence-only edit: move the seeded crawler's source URL, nothing else.
    await rawDb
      .prepare("UPDATE crawlers SET official_source_url = ? WHERE id = ?")
      .bind("https://example.test/testbot-moved", crawlerId)
      .run();

    const createResponse = await createReleaseRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/registry/releases",
          "POST",
          { versionLabel: "reeval-test-evidence-only", changelog: "Source URL refresh only." },
          adminCookie,
        ),
      ),
    );
    const created = await readJson<{ id: string }>(createResponse);
    if (!created.ok) throw new Error("create failed");

    const publishResponse = await publishReleaseRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/registry/releases/${created.data.id}/publish`,
          "POST",
          { reason: "Publishing an evidence-only correction" },
          adminCookie,
        ),
        { versionId: created.data.id },
      ),
    );
    const publishBody = await readJson<{ domainsScheduledForReEvaluation: number }>(
      publishResponse,
    );
    if (!publishBody.ok) throw new Error("publish failed");
    expect(publishBody.data.domainsScheduledForReEvaluation).toBe(0);

    // The domain's next_scan_at must be untouched by this publish.
    const domainRow = await rawDb
      .prepare("SELECT next_scan_at FROM domains WHERE id = ?")
      .bind(domainId)
      .first();
    expect((domainRow as { next_scan_at: string | null } | null)?.next_scan_at).toBeNull();
  });

  it("rollback schedules re-evaluation exactly like a forward publish when the diff is evaluation-semantic", async () => {
    const domainId = await seedAffectedDomain();

    // Release A = current state (baseline, active).
    const releaseAResponse = await createReleaseRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/registry/releases",
          "POST",
          { versionLabel: "reeval-rollback-a", changelog: "Baseline." },
          adminCookie,
        ),
      ),
    );
    const releaseA = await readJson<{ id: string }>(releaseAResponse);
    if (!releaseA.ok) throw new Error("release A create failed");
    await publishReleaseRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/registry/releases/${releaseA.data.id}/publish`,
          "POST",
          { reason: "Publish baseline release A" },
          adminCookie,
        ),
        { versionId: releaseA.data.id },
      ),
    );

    // Evaluation-semantic edit: change the seeded crawler's purpose.
    await rawDb
      .prepare("UPDATE crawlers SET purpose = 'training' WHERE id = ?")
      .bind(crawlerId)
      .run();

    const releaseBResponse = await createReleaseRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/registry/releases",
          "POST",
          { versionLabel: "reeval-rollback-b", changelog: "Purpose change." },
          adminCookie,
        ),
      ),
    );
    const releaseB = await readJson<{ id: string }>(releaseBResponse);
    if (!releaseB.ok) throw new Error("release B create failed");
    await publishReleaseRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/registry/releases/${releaseB.data.id}/publish`,
          "POST",
          { reason: "Publish release B with the purpose change" },
          adminCookie,
        ),
        { versionId: releaseB.data.id },
      ),
    );

    // Clear next_scan_at (publish B already scheduled it) so the rollback
    // test below is unambiguous about what caused the next scheduling.
    await rawDb.prepare("UPDATE domains SET next_scan_at = NULL WHERE id = ?").bind(domainId).run();

    const rollbackResponse = await rollbackReleaseRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/registry/releases/${releaseA.data.id}/rollback`,
          "POST",
          { reason: "Rolling back the purpose change" },
          adminCookie,
        ),
        { versionId: releaseA.data.id },
      ),
    );
    const rollbackBody = await readJson<{ domainsScheduledForReEvaluation: number }>(
      rollbackResponse,
    );
    if (!rollbackBody.ok) throw new Error("rollback failed");
    expect(rollbackBody.data.domainsScheduledForReEvaluation).toBeGreaterThanOrEqual(1);

    const domainRow = await rawDb
      .prepare("SELECT next_scan_at FROM domains WHERE id = ?")
      .bind(domainId)
      .first();
    expect((domainRow as { next_scan_at: string }).next_scan_at).toBeTruthy();
  });
});
