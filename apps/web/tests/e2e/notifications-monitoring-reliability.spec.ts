import { expect, test } from "@playwright/test";
import { addVirtualAuthenticator } from "./helpers/webauthn";
import { registerNewAccount } from "./helpers/auth";
import { setPlan, seedNotificationState } from "./helpers/admin-db";
import { ensureRealPage } from "./helpers/navigation";
import { retryUntilSettled } from "./helpers/hydration";

/**
 * Phase 10 (Notification Channels and Monitoring Reliability) — real browser
 * coverage of the notification centre and private Atom feed. Monitoring
 * outcomes themselves (dedupe, failure isolation, reconciliation) are proven
 * at the integration level against real D1
 * (monitoring-outcome-isolation.integration.test.ts,
 * notification-dedupe-reconciliation.integration.test.ts) — running a real
 * scheduled sweep isn't reachable from a browser session, so these journeys
 * seed the resulting notification state through
 * `/api/test-only/seed-notification-state`, which calls the exact same
 * production notification-generation functions monitoring.ts uses.
 */
test.describe("Notifications and monitoring reliability", () => {
  test.beforeEach(async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "WebAuthn virtual authenticator is Chromium-only.");
    await addVirtualAuthenticator(page);
  });

  async function saveDomain(
    page: import("@playwright/test").Page,
    target: string,
  ): Promise<string> {
    const response = await page.request.post("/api/domains", {
      headers: { Origin: page.url() ? new URL(page.url()).origin : "http://localhost:4321" },
      data: { target },
    });
    expect(response.ok()).toBe(true);
    const body = (await response.json()) as { data: { domainId: string } };
    return body.data.domainId;
  }

  test("Journey A/B/C — website, registry-driven, and mixed changes each surface with correctly attributed copy", async ({
    page,
  }) => {
    await registerNewAccount(page, `E2E Notif ABC ${Date.now()}`);
    await setPlan(page, "pro");
    const domainId = await saveDomain(page, "policy-change-journey.com");

    await seedNotificationState(page, {
      action: "policy_change",
      domainId,
      origin: "website_policy",
      hasCritical: true,
    });
    await seedNotificationState(page, {
      action: "policy_change",
      domainId,
      origin: "registry_driven",
    });
    // The mixed event needs its own domain — the dedupe key already used for
    // this domain's website_policy event would otherwise collide with a
    // second policy_change seed for a different event id, which is fine
    // functionally but this keeps the assertions simple to read.
    const mixedDomainId = await saveDomain(page, "mixed-change-journey.com");
    await seedNotificationState(page, {
      action: "policy_change",
      domainId: mixedDomainId,
      origin: "mixed",
    });

    await page.goto("/app/notifications");
    await ensureRealPage(page);
    await expect(
      page.getByText("policy-change-journey.com: AI crawler policy changed"),
    ).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByText(
        "policy-change-journey.com: crawler registry update changed policy evaluation",
      ),
    ).toBeVisible();
    // The mixed notification must never claim to be purely registry-driven —
    // the core Phase 10 regression this whole phase exists to fix.
    await expect(page.getByText(/Both the website's published policy and/)).toBeVisible();
  });

  test("Journey D — a low-signal domain with no seeded policy change shows the empty notification state", async ({
    page,
  }) => {
    await registerNewAccount(page, `E2E Notif LowSignal ${Date.now()}`);
    await setPlan(page, "pro");
    await saveDomain(page, "low-signal-journey.com");

    await page.goto("/app/notifications");
    await ensureRealPage(page);
    await expect(page.getByText("No notifications yet")).toBeVisible({ timeout: 10_000 });
  });

  test("Journey E — repeated target failures group into one notification, then pausing creates exactly one monitoring_paused notification", async ({
    page,
  }) => {
    await registerNewAccount(page, `E2E Notif Failures ${Date.now()}`);
    await setPlan(page, "pro");
    const domainId = await saveDomain(page, "failure-episode-journey.com");

    await seedNotificationState(page, {
      action: "resource_failure_episode",
      domainId,
      occurrenceCount: 3,
    });
    await page.goto("/app/notifications");
    await ensureRealPage(page);
    await expect(page.getByText("failure-episode-journey.com could not be scanned")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("3 occurrences")).toBeVisible();

    await seedNotificationState(page, { action: "monitoring_paused", domainId });
    await page.reload();
    await ensureRealPage(page);
    await expect(page.getByText("Monitoring paused for failure-episode-journey.com")).toBeVisible({
      timeout: 10_000,
    });

    const domainResponse = await page.request.get(`/api/domains/${domainId}`);
    const domainBody = (await domainResponse.json()) as { data: { monitoringState: string } };
    expect(domainBody.data.monitoringState).toBe("paused");
  });

  test("Journey G — private Atom feed: create, read, regenerate invalidates the old URL", async ({
    page,
  }) => {
    await registerNewAccount(page, `E2E Atom ${Date.now()}`);
    await setPlan(page, "solo");
    const domainId = await saveDomain(page, "atom-journey.com");
    await seedNotificationState(page, {
      action: "policy_change",
      domainId,
      origin: "website_policy",
    });

    await page.goto("/app/notifications");
    await ensureRealPage(page);
    await retryUntilSettled(async () => {
      await Promise.all([
        page.waitForResponse(
          (res) => res.url().includes("/api/notifications/feed-token") && res.status() === 200,
        ),
        page.getByRole("button", { name: "Create feed URL" }).click(),
      ]);
    });
    const feedUrlText = await page.locator("pre").innerText();
    expect(feedUrlText).toContain("/feed/");

    const firstFeedResponse = await page.request.get(feedUrlText.trim());
    expect(firstFeedResponse.ok()).toBe(true);
    expect(await firstFeedResponse.text()).toContain("AI crawler policy changed");

    await retryUntilSettled(async () => {
      await Promise.all([
        page.waitForResponse(
          (res) => res.url().includes("/api/notifications/feed-token") && res.status() === 200,
        ),
        page.getByRole("button", { name: "Regenerate feed URL" }).click(),
      ]);
    });
    const oldFeedResponse = await page.request.get(feedUrlText.trim());
    expect(oldFeedResponse.status()).toBe(404);
  });

  test("Journey H — downgrading to Free immediately blocks the private Atom feed", async ({
    page,
  }) => {
    await registerNewAccount(page, `E2E AtomDowngrade ${Date.now()}`);
    await setPlan(page, "solo");

    await page.goto("/app/notifications");
    await ensureRealPage(page);
    await retryUntilSettled(async () => {
      await Promise.all([
        page.waitForResponse(
          (res) => res.url().includes("/api/notifications/feed-token") && res.status() === 200,
        ),
        page.getByRole("button", { name: "Create feed URL" }).click(),
      ]);
    });
    const feedUrlText = (await page.locator("pre").innerText()).trim();

    await setPlan(page, "free");
    const afterDowngrade = await page.request.get(feedUrlText);
    expect(afterDowngrade.status()).toBe(404);

    // In-app notifications remain available regardless of Atom entitlement.
    await page.goto("/app/notifications");
    await ensureRealPage(page);
    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
  });

  test("Journey J — one account's notifications, including a category filter, never leak to another account", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await addVirtualAuthenticator(pageA);
    await registerNewAccount(pageA, `E2E Notif Isolation A ${Date.now()}`);
    await setPlan(pageA, "pro");
    const domainAResponse = await pageA.request.post("/api/domains", {
      headers: { Origin: "http://localhost:4321" },
      data: { target: "notif-isolation-a.com" },
    });
    const domainABody = (await domainAResponse.json()) as { data: { domainId: string } };
    await seedNotificationState(pageA, {
      action: "policy_change",
      domainId: domainABody.data.domainId,
      origin: "website_policy",
    });

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await addVirtualAuthenticator(pageB);
    await registerNewAccount(pageB, `E2E Notif Isolation B ${Date.now()}`);
    await setPlan(pageB, "pro");

    await pageB.goto("/app/notifications");
    await ensureRealPage(pageB);
    await expect(pageB.getByText("notif-isolation-a.com")).toHaveCount(0);
    await expect(pageB.getByText("No notifications yet")).toBeVisible({ timeout: 10_000 });

    // Category filter narrows account A's own list correctly.
    await pageA.goto("/app/notifications");
    await ensureRealPage(pageA);
    await expect(pageA.getByText("notif-isolation-a.com: AI crawler policy changed")).toBeVisible({
      timeout: 10_000,
    });
    await pageA.getByLabel("Category").selectOption("crawler_registry");
    await expect(pageA.getByText("notif-isolation-a.com: AI crawler policy changed")).toHaveCount(
      0,
    );
    await pageA.getByLabel("Category").selectOption("policy_changes");
    await expect(pageA.getByText("notif-isolation-a.com: AI crawler policy changed")).toBeVisible({
      timeout: 10_000,
    });

    await contextA.close();
    await contextB.close();
  });

  test("Journey K — mobile: the notification centre and Atom management render without horizontal overflow at 390px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await registerNewAccount(page, `E2E Notif Mobile ${Date.now()}`);
    await setPlan(page, "pro");
    const domainId = await saveDomain(page, "notif-mobile-journey.com");
    await seedNotificationState(page, {
      action: "policy_change",
      domainId,
      origin: "website_policy",
    });

    await page.goto("/app/notifications");
    await ensureRealPage(page);
    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
    await expect(page.getByText("notif-mobile-journey.com: AI crawler policy changed")).toBeVisible(
      { timeout: 10_000 },
    );

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
