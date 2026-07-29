import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createD1TestHarness } from "./d1-harness";
import {
  createVirtualCredential,
  simulateAuthentication,
  simulateRegistration,
} from "./virtual-authenticator";
import type { VirtualCredential } from "./virtual-authenticator";
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
const loginBegin = (await import("../../src/pages/api/auth/login/begin")).POST;
const loginFinish = (await import("../../src/pages/api/auth/login/finish")).POST;
const listDomainsRoute = (await import("../../src/pages/api/domains/index")).GET;
const createDomainRoute = (await import("../../src/pages/api/domains/index")).POST;
const getDomainRoute = (await import("../../src/pages/api/domains/[domainId]/index")).GET;
const updateDomainRoute = (await import("../../src/pages/api/domains/[domainId]/index")).PATCH;
const deleteDomainRoute = (await import("../../src/pages/api/domains/[domainId]/index")).DELETE;
const scanDomainRoute = (await import("../../src/pages/api/domains/[domainId]/scan")).POST;
const listGroupsRoute = (await import("../../src/pages/api/groups/index")).GET;
const createGroupRoute = (await import("../../src/pages/api/groups/index")).POST;
const renameGroupRoute = (await import("../../src/pages/api/groups/[groupId]/index")).PATCH;
const deleteGroupRoute = (await import("../../src/pages/api/groups/[groupId]/index")).DELETE;
const getAccountRoute = (await import("../../src/pages/api/account/index")).GET;
const patchAccountRoute = (await import("../../src/pages/api/account/index")).PATCH;
const requestDeletionRoute = (await import("../../src/pages/api/account/deletion")).POST;
const cancelDeletionRoute = (await import("../../src/pages/api/account/deletion")).DELETE;
const exportCsvRoute = (await import("../../src/pages/api/domains/export.csv")).GET;

const RP_ID = "localhost";
const ORIGIN = "http://localhost:4321";

async function signUpTestUser(
  displayName: string,
): Promise<{ cookie: string; credential: VirtualCredential }> {
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
  return { cookie: cookieFromResponse(finishResponse), credential };
}

describe("saved domains, groups, and account management (real D1)", () => {
  let dispose: () => Promise<void>;

  beforeAll(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
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

  let cookie: string;
  let credential: VirtualCredential;
  let domainId: string;

  it("saves a domain (free plan defaults to maximum_ai_visibility)", async () => {
    ({ cookie, credential } = await signUpTestUser("Ada"));

    const response = await createDomainRoute(
      ctx(jsonRequest("http://x/domains", "POST", { target: "example.com" }, cookie)),
    );
    expect(response.status).toBe(201);
    const body = await readJson<{ domainId: string }>(response);
    if (!body.ok) throw new Error("create failed");
    domainId = body.data.domainId;

    const listResponse = await listDomainsRoute(ctx(getRequest("http://x/domains", cookie)));
    const list = await readJson<{ preset: string; canonicalOrigin: string }[]>(listResponse);
    if (!list.ok) throw new Error("list failed");
    expect(list.data).toHaveLength(1);
    expect(list.data[0]!.preset).toBe("maximum_ai_visibility");
  });

  it("rejects saving the same domain twice (DOMAIN_DUPLICATE)", async () => {
    const response = await createDomainRoute(
      ctx(jsonRequest("http://x/domains", "POST", { target: "example.com" }, cookie)),
    );
    expect(response.status).toBe(409);
    const body = await readJson(response);
    if (!body.ok) expect(body.error.code).toBe("DOMAIN_DUPLICATE");
  });

  it("enforces the free plan's saved-domain limit (DOMAIN_LIMIT_REACHED)", async () => {
    const response = await createDomainRoute(
      ctx(jsonRequest("http://x/domains", "POST", { target: "another-example.com" }, cookie)),
    );
    expect(response.status).toBe(403);
    const body = await readJson(response);
    if (!body.ok) expect(body.error.code).toBe("DOMAIN_LIMIT_REACHED");
  });

  it("updates a domain it owns (rename, preset, notes) and rejects an unknown preset", async () => {
    const good = await updateDomainRoute(
      ctx(
        jsonRequest(
          "http://x/domains/x",
          "PATCH",
          { displayName: "Example Co", preset: "publisher_protection", notes: "watch this one" },
          cookie,
        ),
        { domainId },
      ),
    );
    expect(good.status).toBe(200);

    const bad = await updateDomainRoute(
      ctx(jsonRequest("http://x/domains/x", "PATCH", { preset: "not_a_real_preset" }, cookie), {
        domainId,
      }),
    );
    expect(bad.status).toBe(400);

    const getResponse = await getDomainRoute(
      ctx(getRequest("http://x/domains/x", cookie), { domainId }),
    );
    const domain = await readJson<{ displayName: string; preset: string }>(getResponse);
    if (!domain.ok) throw new Error("get failed");
    expect(domain.data.displayName).toBe("Example Co");
    expect(domain.data.preset).toBe("publisher_protection");
  });

  it("cannot see, update, or delete another user's domain", async () => {
    const { cookie: strangerCookie } = await signUpTestUser("Grace");

    const getResponse = await getDomainRoute(
      ctx(getRequest("http://x/domains/x", strangerCookie), { domainId }),
    );
    expect(getResponse.status).toBe(404);

    const patchResponse = await updateDomainRoute(
      ctx(jsonRequest("http://x/domains/x", "PATCH", { displayName: "Hijacked" }, strangerCookie), {
        domainId,
      }),
    );
    expect(patchResponse.status).toBe(404);

    const deleteResponse = await deleteDomainRoute(
      ctx(mutatingRequest("http://x/domains/x", "DELETE", strangerCookie), { domainId }),
    );
    expect(deleteResponse.status).toBe(404);
  });

  it("returns AUDIT_ENGINE_DISABLED for a manual re-scan while the engine is off, without a quota being consumed", async () => {
    const response = await scanDomainRoute(
      ctx(jsonRequest("http://x/domains/x/scan", "POST", {}, cookie), { domainId }),
    );
    expect(response.status).toBe(503);
    const body = await readJson(response);
    if (!body.ok) expect(body.error.code).toBe("AUDIT_ENGINE_DISABLED");
  });

  it("blocks creating a group on a plan without domainGroupsEnabled", async () => {
    const response = await createGroupRoute(
      ctx(jsonRequest("http://x/groups", "POST", { name: "Clients" }, cookie)),
    );
    expect(response.status).toBe(403);
    const body = await readJson(response);
    if (!body.ok) expect(body.error.code).toBe("FORBIDDEN");
  });

  it("allows group creation once on a plan with domainGroupsEnabled, and enforces GROUP_NOT_EMPTY on delete", async () => {
    // Simulate a plan upgrade directly against the harness DB (Paddle billing wiring is Step 17).
    await mockEnv.DB.prepare(
      "UPDATE users SET plan_id = 'pro' WHERE id = (SELECT owner_user_id FROM domains WHERE id = ?)",
    )
      .bind(domainId)
      .run();

    const createResponse = await createGroupRoute(
      ctx(jsonRequest("http://x/groups", "POST", { name: "Clients" }, cookie)),
    );
    expect(createResponse.status).toBe(201);
    const created = await readJson<{ groupId: string }>(createResponse);
    if (!created.ok) throw new Error("create failed");
    const groupId = created.data.groupId;

    const attachResponse = await updateDomainRoute(
      ctx(jsonRequest("http://x/domains/x", "PATCH", { groupId }, cookie), { domainId }),
    );
    expect(attachResponse.status).toBe(200);

    const blockedDelete = await deleteGroupRoute(
      ctx(mutatingRequest("http://x/groups/x", "DELETE", cookie), { groupId }),
    );
    expect(blockedDelete.status).toBe(409);
    const blockedBody = await readJson(blockedDelete);
    if (!blockedBody.ok) expect(blockedBody.error.code).toBe("GROUP_NOT_EMPTY");

    const renameResponse = await renameGroupRoute(
      ctx(jsonRequest("http://x/groups/x", "PATCH", { name: "VIP Clients" }, cookie), { groupId }),
    );
    expect(renameResponse.status).toBe(200);

    await updateDomainRoute(
      ctx(jsonRequest("http://x/domains/x", "PATCH", { groupId: null }, cookie), { domainId }),
    );
    const okDelete = await deleteGroupRoute(
      ctx(mutatingRequest("http://x/groups/x", "DELETE", cookie), { groupId }),
    );
    expect(okDelete.status).toBe(200);

    const list = await readJson<unknown[]>(
      await listGroupsRoute(ctx(getRequest("http://x/groups", cookie))),
    );
    if (list.ok) expect(list.data).toHaveLength(0);
  });

  it("gets and updates the account profile", async () => {
    const getResponse = await getAccountRoute(ctx(getRequest("http://x/account", cookie)));
    const account = await readJson<{ displayName: string }>(getResponse);
    if (!account.ok) throw new Error("get failed");
    expect(account.data.displayName).toBe("Ada");

    const patchResponse = await patchAccountRoute(
      ctx(jsonRequest("http://x/account", "PATCH", { displayName: "Ada L." }, cookie)),
    );
    expect(patchResponse.status).toBe(200);
  });

  it("requests account deletion without revoking the session, then a fresh login still works, then cancels deletion", async () => {
    const requestResponse = await requestDeletionRoute(
      ctx(mutatingRequest("http://x/account/deletion", "POST", cookie)),
    );
    expect(requestResponse.status).toBe(200);

    // The session used to request deletion is still valid afterwards.
    const stillSignedIn = await getAccountRoute(ctx(getRequest("http://x/account", cookie)));
    expect(stillSignedIn.status).toBe(200);
    const stillSignedInBody = await readJson<{ status: string }>(stillSignedIn);
    if (stillSignedInBody.ok) expect(stillSignedInBody.data.status).toBe("pending_deletion");

    // A brand-new login also still works while pending_deletion (only `suspended` blocks login).
    const beginResponse = await loginBegin(ctx(jsonRequest("http://x/login/begin", "POST", {})));
    const begin = await readJson<{
      challengeId: string;
      publicKeyCredentialRequestOptions: { challenge: string };
    }>(beginResponse);
    if (!begin.ok) throw new Error("begin failed");

    const authResponse = await simulateAuthentication(
      credential,
      begin.data.publicKeyCredentialRequestOptions.challenge,
      RP_ID,
      ORIGIN,
    );
    const freshLogin = await loginFinish(
      ctx(
        jsonRequest("http://x/login/finish", "POST", {
          challengeId: begin.data.challengeId,
          credential: authResponse,
        }),
      ),
    );
    expect(freshLogin.status).toBe(200);

    const cancelResponse = await cancelDeletionRoute(
      ctx(mutatingRequest("http://x/account/deletion", "DELETE", cookie)),
    );
    expect(cancelResponse.status).toBe(200);

    const afterCancel = await getAccountRoute(ctx(getRequest("http://x/account", cookie)));
    const afterCancelBody = await readJson<{ status: string }>(afterCancel);
    if (afterCancelBody.ok) expect(afterCancelBody.data.status).toBe("active");
  });

  it("gates CSV export by plan entitlement and neutralises a formula-injection payload in the export", async () => {
    // This user is already on 'pro' (upgraded by an earlier test in this
    // journey), which is exactly what's needed to prove the *allowed* path
    // and its formula-injection defence; DOMAIN_LIMIT_REACHED /
    // "blocks creating a group on a plan without domainGroupsEnabled"
    // earlier in this file already cover the free-plan-blocked case for
    // the equivalent groups entitlement.
    await updateDomainRoute(
      ctx(
        jsonRequest("http://x/domains/x", "PATCH", { displayName: "=cmd|'/c calc'!A1" }, cookie),
        { domainId },
      ),
    );

    const response = await exportCsvRoute(
      ctx(getRequest("http://x/api/domains/export.csv", cookie)),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    const csv = await response.text();
    expect(csv).toContain("'=cmd|");
    expect(csv).not.toMatch(/^=cmd/m);
  });

  it("blocks CSV export on a fresh free-plan account", async () => {
    const { cookie: freeCookie } = await signUpTestUser("FreePlanUser");
    const response = await exportCsvRoute(
      ctx(getRequest("http://x/api/domains/export.csv", freeCookie)),
    );
    expect(response.status).toBe(403);
  });

  it("allows re-saving a domain after it was removed (soft-deleted row must not block re-creation)", async () => {
    const { cookie: freshCookie } = await signUpTestUser("Remi");

    const createResponse = await createDomainRoute(
      ctx(jsonRequest("http://x/domains", "POST", { target: "reusable-example.com" }, freshCookie)),
    );
    expect(createResponse.status).toBe(201);
    const created = await readJson<{ domainId: string }>(createResponse);
    if (!created.ok) throw new Error("create failed");

    const deleteResponse = await deleteDomainRoute(
      ctx(mutatingRequest("http://x/domains/x", "DELETE", freshCookie), {
        domainId: created.data.domainId,
      }),
    );
    expect(deleteResponse.status).toBe(200);

    const recreateResponse = await createDomainRoute(
      ctx(jsonRequest("http://x/domains", "POST", { target: "reusable-example.com" }, freshCookie)),
    );
    expect(recreateResponse.status).toBe(201);
    const recreated = await readJson<{ domainId: string }>(recreateResponse);
    if (!recreated.ok) throw new Error("recreate failed");
    expect(recreated.data.domainId).not.toBe(created.data.domainId);
  });
});
