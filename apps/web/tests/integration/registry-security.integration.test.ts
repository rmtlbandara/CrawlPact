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
 * Phase 15 Section 131/144/145 — Admin registry security and
 * publication/rollback robustness: IDOR against invalid/non-existent
 * version IDs, and idempotency (repeated identical requests / "replay").
 */
describe("registry publication/rollback security and idempotency (real D1)", () => {
  let dispose: () => Promise<void>;
  let rawDb: D1Database;
  let adminCookie: string;

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
      GOOGLE_CLIENT_ID: "test-client-id.apps.googleusercontent.com",
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
      ctx(jsonRequest("http://x/register/begin", "POST", { displayName: "Security Test Admin" })),
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
  });

  afterEach(async () => {
    await dispose();
  });

  it("rejects publishing a non-existent registry version id (IDOR-shaped input)", async () => {
    const response = await publishReleaseRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/registry/releases/does-not-exist/publish",
          "POST",
          { reason: "Attempting to publish a non-existent release" },
          adminCookie,
        ),
        { versionId: "does-not-exist" },
      ),
    );
    const body = await readJson(response);
    expect(body.ok).toBe(false);
  });

  it("rejects rolling back to a non-existent registry version id", async () => {
    const response = await rollbackReleaseRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/registry/releases/does-not-exist/rollback",
          "POST",
          { reason: "Attempting to roll back to a non-existent release" },
          adminCookie,
        ),
        { versionId: "does-not-exist" },
      ),
    );
    const body = await readJson(response);
    expect(body.ok).toBe(false);
  });

  it("rejects rolling back to a never-published draft release", async () => {
    const createResponse = await createReleaseRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/registry/releases",
          "POST",
          { versionLabel: "security-test-draft", changelog: "A draft, never published." },
          adminCookie,
        ),
      ),
    );
    const created = await readJson<{ id: string }>(createResponse);
    if (!created.ok) throw new Error("create failed");

    const response = await rollbackReleaseRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/registry/releases/${created.data.id}/rollback`,
          "POST",
          { reason: "Attempting to activate a draft via rollback" },
          adminCookie,
        ),
        { versionId: created.data.id },
      ),
    );
    const body = await readJson(response);
    expect(body.ok).toBe(false);

    const activeRow = await rawDb
      .prepare("SELECT id FROM registry_versions WHERE is_active = 1")
      .first();
    expect((activeRow as { id: string } | null)?.id).not.toBe(created.data.id);
  });

  it("publishing the already-active release twice is idempotent (no duplicate activation-history rows)", async () => {
    const createResponse = await createReleaseRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/registry/releases",
          "POST",
          { versionLabel: "security-test-idempotent", changelog: "Idempotency test release." },
          adminCookie,
        ),
      ),
    );
    const created = await readJson<{ id: string }>(createResponse);
    if (!created.ok) throw new Error("create failed");

    const firstPublish = await publishReleaseRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/registry/releases/${created.data.id}/publish`,
          "POST",
          { reason: "First publish" },
          adminCookie,
        ),
        { versionId: created.data.id },
      ),
    );
    const firstBody = await readJson<{ alreadyActive: boolean }>(firstPublish);
    if (!firstBody.ok) throw new Error("first publish failed");
    expect(firstBody.data.alreadyActive).toBe(false);

    const secondPublish = await publishReleaseRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/registry/releases/${created.data.id}/publish`,
          "POST",
          { reason: "Replayed publish request" },
          adminCookie,
        ),
        { versionId: created.data.id },
      ),
    );
    const secondBody = await readJson<{ alreadyActive: boolean }>(secondPublish);
    if (!secondBody.ok) throw new Error("second publish failed");
    expect(secondBody.data.alreadyActive).toBe(true);

    const activationRows = await rawDb
      .prepare(
        "SELECT COUNT(*) as n FROM registry_version_activations WHERE registry_version_id = ?",
      )
      .bind(created.data.id)
      .first();
    expect((activationRows as { n: number }).n).toBe(1);
  });

  it("rolling back to the already-active release is idempotent", async () => {
    const createResponse = await createReleaseRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/registry/releases",
          "POST",
          { versionLabel: "security-test-rollback-idempotent", changelog: "Rollback idempotency." },
          adminCookie,
        ),
      ),
    );
    const created = await readJson<{ id: string }>(createResponse);
    if (!created.ok) throw new Error("create failed");
    await publishReleaseRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/registry/releases/${created.data.id}/publish`,
          "POST",
          { reason: "Publish before rollback idempotency test" },
          adminCookie,
        ),
        { versionId: created.data.id },
      ),
    );

    const rollbackResponse = await rollbackReleaseRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/registry/releases/${created.data.id}/rollback`,
          "POST",
          { reason: "Rolling back to the release that is already active" },
          adminCookie,
        ),
        { versionId: created.data.id },
      ),
    );
    const rollbackBody = await readJson<{ alreadyActive: boolean }>(rollbackResponse);
    if (!rollbackBody.ok) throw new Error("rollback failed");
    expect(rollbackBody.data.alreadyActive).toBe(true);

    const activationRows = await rawDb
      .prepare(
        "SELECT COUNT(*) as n FROM registry_version_activations WHERE registry_version_id = ? AND action = 'rolled_back_to'",
      )
      .bind(created.data.id)
      .first();
    expect((activationRows as { n: number }).n).toBe(0);
  });
});
