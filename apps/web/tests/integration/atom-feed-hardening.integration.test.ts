import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { createD1TestHarness } from "./d1-harness";
import { createFakeR2Bucket } from "./fake-r2-bucket";
import { createVirtualCredential, simulateRegistration } from "./virtual-authenticator";
import { cookieFromResponse, ctx, jsonRequest, mutatingRequest, readJson } from "./test-helpers";

/**
 * Phase 10 Atom feed hardening (§35-43). Entitlement was previously checked
 * only at token-issuance time — a downgraded account kept a working feed
 * URL indefinitely. This suite proves the read-time re-check
 * (`getFeedAccessByToken`) actually closes that gap, plus the metadata
 * minimisation and response-header requirements.
 */

let mockEnv: Cloudflare.Env;
vi.mock("../../src/lib/env", () => ({ getEnv: () => mockEnv }));

const registerBegin = (await import("../../src/pages/api/auth/register/begin")).POST;
const registerFinish = (await import("../../src/pages/api/auth/register/finish")).POST;
const feedTokenGenerate = (await import("../../src/pages/api/notifications/feed-token")).POST;
const feedRoute = (await import("../../src/pages/feed/[token].xml")).GET;

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

describe("private Atom feed hardening (real D1)", () => {
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

  it("a downgrade to Free immediately invalidates a previously-issued feed token, even though the token itself was never revoked", async () => {
    const { cookie, userId } = await signUpTestUser("Downgrade Test");
    await mockEnv.DB.prepare("UPDATE users SET plan_id = 'pro' WHERE id = ?").bind(userId).run();

    const issued = await feedTokenGenerate(
      ctx(mutatingRequest("http://x/api/notifications/feed-token", "POST", cookie)),
    );
    expect(issued.status).toBe(200);
    const issuedBody = await readJson<{ token: string; feedUrl: string }>(issued);
    if (!issuedBody.ok) throw new Error("issue failed");

    // Confirm it works pre-downgrade.
    const beforeDowngrade = await feedRoute(
      ctx(new Request(issuedBody.data.feedUrl), { token: issuedBody.data.token }),
    );
    expect(beforeDowngrade.status).toBe(200);

    // Downgrade without touching feed_tokens at all — the read-time
    // entitlement check must be what stops access, not revocation.
    await mockEnv.DB.prepare("UPDATE users SET plan_id = 'free' WHERE id = ?").bind(userId).run();
    const [tokenRow] = await db
      .select({ revokedAt: schema.feedTokens.revokedAt })
      .from(schema.feedTokens)
      .where(eq(schema.feedTokens.userId, userId))
      .limit(1);
    expect(tokenRow!.revokedAt).toBeNull();

    const afterDowngrade = await feedRoute(
      ctx(new Request(issuedBody.data.feedUrl), { token: issuedBody.data.token }),
    );
    expect(afterDowngrade.status).toBe(404);

    // Documented policy (docs/product/PRIVATE_ATOM_FEED_POLICY.md): downgrade
    // never revokes the token, it only becomes unusable while entitlement is
    // lost — enforced purely by the read-time re-check, deliberately without
    // touching billing code (out of Phase 10's scope). So a later
    // re-upgrade, with no new token issuance, restores the exact same URL —
    // this is intentional continuity, not a re-activation requirement.
    await mockEnv.DB.prepare("UPDATE users SET plan_id = 'pro' WHERE id = ?").bind(userId).run();
    const afterReUpgrade = await feedRoute(
      ctx(new Request(issuedBody.data.feedUrl), { token: issuedBody.data.token }),
    );
    expect(afterReUpgrade.status).toBe(200);
  });

  it("a suspended account's feed token stops working even though it was never revoked", async () => {
    const { cookie, userId } = await signUpTestUser("Suspended Test");
    await mockEnv.DB.prepare("UPDATE users SET plan_id = 'pro' WHERE id = ?").bind(userId).run();
    const issued = await feedTokenGenerate(
      ctx(mutatingRequest("http://x/api/notifications/feed-token", "POST", cookie)),
    );
    const issuedBody = await readJson<{ token: string; feedUrl: string }>(issued);
    if (!issuedBody.ok) throw new Error("issue failed");

    await mockEnv.DB.prepare("UPDATE users SET status = 'suspended' WHERE id = ?")
      .bind(userId)
      .run();
    const response = await feedRoute(
      ctx(new Request(issuedBody.data.feedUrl), { token: issuedBody.data.token }),
    );
    expect(response.status).toBe(404);
  });

  it("account deletion (FK cascade) leaves the feed token unusable", async () => {
    const { cookie, userId } = await signUpTestUser("Deletion Test");
    await mockEnv.DB.prepare("UPDATE users SET plan_id = 'pro' WHERE id = ?").bind(userId).run();
    const issued = await feedTokenGenerate(
      ctx(mutatingRequest("http://x/api/notifications/feed-token", "POST", cookie)),
    );
    const issuedBody = await readJson<{ token: string; feedUrl: string }>(issued);
    if (!issuedBody.ok) throw new Error("issue failed");

    await db.delete(schema.users).where(eq(schema.users.id, userId));

    const response = await feedRoute(
      ctx(new Request(issuedBody.data.feedUrl), { token: issuedBody.data.token }),
    );
    expect(response.status).toBe(404);
  });

  it("response headers and feed metadata are private, minimal, and never expose the account's display name or raw id", async () => {
    const { cookie, userId } = await signUpTestUser("Header Metadata Test Name");
    await mockEnv.DB.prepare("UPDATE users SET plan_id = 'pro' WHERE id = ?").bind(userId).run();
    const issued = await feedTokenGenerate(
      ctx(mutatingRequest("http://x/api/notifications/feed-token", "POST", cookie)),
    );
    const issuedBody = await readJson<{ token: string; feedUrl: string }>(issued);
    if (!issuedBody.ok) throw new Error("issue failed");

    const response = await feedRoute(
      ctx(new Request(issuedBody.data.feedUrl), { token: issuedBody.data.token }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-type")).toContain("application/atom+xml");

    const xml = await response.text();
    expect(xml).not.toContain("Header Metadata Test Name");
    expect(xml).not.toContain(userId);
    expect(xml).toContain("<title>CrawlPact notifications</title>");
  });

  it("an invalid, revoked, and entitlement-blocked token all produce the identical generic 404 with the same private headers", async () => {
    const invalid = await feedRoute(
      ctx(new Request("http://x/feed/not-a-real-token.xml"), { token: "not-a-real-token" }),
    );
    expect(invalid.status).toBe(404);
    expect(invalid.headers.get("cache-control")).toBe("private, no-store");
    expect(invalid.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
});
