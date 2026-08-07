import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { createD1TestHarness } from "./d1-harness";
import { createFakeR2Bucket } from "./fake-r2-bucket";
import { upsertGroupedNotification } from "../../src/lib/notifications";
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
const listNotificationsRoute = (await import("../../src/pages/api/notifications/index")).GET;
const unreadCountRoute = (await import("../../src/pages/api/notifications/unread-count")).GET;
const markReadRoute = (await import("../../src/pages/api/notifications/read")).POST;
const markAllReadRoute = (await import("../../src/pages/api/notifications/read-all")).POST;
const feedTokenGenerate = (await import("../../src/pages/api/notifications/feed-token")).POST;
const feedTokenRevoke = (await import("../../src/pages/api/notifications/feed-token")).DELETE;
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

async function insertNotification(
  db: Database,
  userId: string,
  fields: { type: string; domainId: string | null; title: string; body: string; createdAt: string },
): Promise<void> {
  await db.insert(schema.notifications).values({
    id: crypto.randomUUID(),
    userId,
    domainId: fields.domainId,
    type: fields.type as (typeof schema.notifications.$inferInsert)["type"],
    title: fields.title,
    body: fields.body,
    createdAt: fields.createdAt,
  });
}

describe("notification centre and private Atom feed (real D1)", () => {
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

  let cookie: string;
  let userId: string;
  const domainId = crypto.randomUUID();

  it("groups repeated resource_failure notifications for the same domain into one row (Phase 10 write-time grouping)", async () => {
    ({ cookie, userId } = await signUpTestUser("Ada"));

    const now = new Date().toISOString();
    await db.insert(schema.domains).values({
      id: domainId,
      ownerUserId: userId,
      displayName: "example.com",
      canonicalOrigin: "https://example.com",
      originalInput: "example.com",
      preset: "maximum_ai_visibility",
      monitoringState: "active",
      monitoringFrequency: "weekly",
      consecutiveFailureCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Two occurrences of the same failure episode — as monitoring.ts's
    // safeNotifyTargetFailure would call it on failure #2 then #3 — collapse
    // onto one row via upsertGroupedNotification's dedupeKey, not two rows.
    const failureEpisodeId = "episode-1";
    for (const occurrenceCount of [2, 3]) {
      await upsertGroupedNotification(db, {
        userId,
        domainId,
        type: "resource_failure",
        category: "monitoring_health",
        priority: "normal",
        title: "example.com could not be scanned",
        body: `Attempt ${occurrenceCount} of 5`,
        sourceType: "scan_failure_episode",
        sourceId: failureEpisodeId,
        dedupeKey: `resource_failure:${failureEpisodeId}`,
        occurrenceCount,
      });
    }
    // upsertGroupedNotification stamps its own rows with the real current
    // time, so this must sort after them to land first in the (newest-first)
    // list — a fixed 2026 `base` timestamp would otherwise sort as the
    // oldest row, not the newest.
    await insertNotification(db, userId, {
      type: "critical_policy_change",
      domainId,
      title: "example.com: AI crawler policy changed <script>alert(1)</script>",
      body: "Something changed & matters",
      createdAt: new Date(Date.now() + 60_000).toISOString(),
    });

    const response = await listNotificationsRoute(
      ctx(getRequest("http://x/api/notifications", cookie)),
    );
    const body = await readJson<{ items: { type: string; groupCount?: number }[] }>(response);
    if (!body.ok) throw new Error("list failed");
    expect(body.data.items).toHaveLength(2);
    expect(body.data.items[0]!.type).toBe("critical_policy_change");
    expect(body.data.items[1]!.type).toBe("resource_failure");
    expect(body.data.items[1]!.groupCount).toBe(3);
  });

  it("reports an accurate unread count and supports marking read / read-all", async () => {
    const before = await readJson<{ count: number }>(
      await unreadCountRoute(ctx(getRequest("http://x/api/notifications/unread-count", cookie))),
    );
    if (!before.ok) throw new Error("count failed");
    expect(before.data.count).toBe(2);

    const list = await readJson<{ items: { notificationId: string; type: string }[] }>(
      await listNotificationsRoute(ctx(getRequest("http://x/api/notifications", cookie))),
    );
    if (!list.ok) throw new Error("list failed");
    const criticalId = list.data.items.find(
      (i) => i.type === "critical_policy_change",
    )!.notificationId;

    await markReadRoute(
      ctx(
        jsonRequest(
          "http://x/api/notifications/read",
          "POST",
          { notificationIds: [criticalId] },
          cookie,
        ),
      ),
    );
    const afterOne = await readJson<{ count: number }>(
      await unreadCountRoute(ctx(getRequest("http://x/api/notifications/unread-count", cookie))),
    );
    if (afterOne.ok) expect(afterOne.data.count).toBe(1);

    await markAllReadRoute(
      ctx(mutatingRequest("http://x/api/notifications/read-all", "POST", cookie)),
    );
    const afterAll_ = await readJson<{ count: number }>(
      await unreadCountRoute(ctx(getRequest("http://x/api/notifications/unread-count", cookie))),
    );
    if (afterAll_.ok) expect(afterAll_.data.count).toBe(0);
  });

  it("never leaks another user's notifications", async () => {
    const { cookie: strangerCookie } = await signUpTestUser("Grace");
    const response = await listNotificationsRoute(
      ctx(getRequest("http://x/api/notifications", strangerCookie)),
    );
    const body = await readJson<{ items: unknown[] }>(response);
    if (!body.ok) throw new Error("list failed");
    expect(body.data.items).toHaveLength(0);
  });

  it("blocks the private Atom feed on a plan without privateAtomFeedEnabled, then allows it after upgrading", async () => {
    const blocked = await feedTokenGenerate(
      ctx(mutatingRequest("http://x/api/notifications/feed-token", "POST", cookie)),
    );
    expect(blocked.status).toBe(403);

    await mockEnv.DB.prepare("UPDATE users SET plan_id = 'pro' WHERE id = ?").bind(userId).run();

    const issued = await feedTokenGenerate(
      ctx(mutatingRequest("http://x/api/notifications/feed-token", "POST", cookie)),
    );
    expect(issued.status).toBe(200);
    const issuedBody = await readJson<{ token: string; feedUrl: string }>(issued);
    if (!issuedBody.ok) throw new Error("issue failed");

    const feedResponse = await feedRoute(
      ctx(new Request(issuedBody.data.feedUrl), { token: issuedBody.data.token }),
    );
    expect(feedResponse.status).toBe(200);
    expect(feedResponse.headers.get("content-type")).toContain("atom+xml");
    const xml = await feedResponse.text();
    expect(xml).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
    // Title with a literal '<script>' must be escaped, never passed through raw.
    expect(xml).not.toContain("<script>alert(1)</script>");
    expect(xml).toContain("&lt;script&gt;");

    // An invalid token gets a generic 404.
    const badFeed = await feedRoute(
      ctx(new Request("http://x/feed/not-a-real-token.xml"), { token: "not-a-real-token" }),
    );
    expect(badFeed.status).toBe(404);

    // Regenerating invalidates the old token.
    const reissued = await feedTokenGenerate(
      ctx(mutatingRequest("http://x/api/notifications/feed-token", "POST", cookie)),
    );
    const reissuedBody = await readJson<{ token: string }>(reissued);
    if (!reissuedBody.ok) throw new Error("reissue failed");
    const oldTokenFeed = await feedRoute(
      ctx(new Request("http://x/feed/x.xml"), { token: issuedBody.data.token }),
    );
    expect(oldTokenFeed.status).toBe(404);
    const newTokenFeed = await feedRoute(
      ctx(new Request("http://x/feed/x.xml"), { token: reissuedBody.data.token }),
    );
    expect(newTokenFeed.status).toBe(200);

    // Revoking without reissuing leaves no working feed.
    await feedTokenRevoke(
      ctx(mutatingRequest("http://x/api/notifications/feed-token", "DELETE", cookie)),
    );
    const afterRevoke = await feedRoute(
      ctx(new Request("http://x/feed/x.xml"), { token: reissuedBody.data.token }),
    );
    expect(afterRevoke.status).toBe(404);
  });
});
