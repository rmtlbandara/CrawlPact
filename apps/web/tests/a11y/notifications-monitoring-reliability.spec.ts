import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { addVirtualAuthenticator } from "../e2e/helpers/webauthn";
import { registerNewAccount } from "../e2e/helpers/auth";
import { setPlan, seedNotificationState } from "../e2e/helpers/admin-db";
import { ensureRealPage } from "../e2e/helpers/navigation";
import { retryUntilSettled } from "../e2e/helpers/hydration";

/**
 * Phase 10 (Notification Channels and Monitoring Reliability) accessibility
 * smoke tests, following the same pattern as tests/a11y/agency-workspace.spec.ts.
 */
test.describe("notifications and monitoring reliability", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "WebAuthn is Chromium-only.");

  async function scan(page: import("@playwright/test").Page) {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  }

  async function saveDomain(
    page: import("@playwright/test").Page,
    target: string,
  ): Promise<string> {
    const response = await page.request.post("/api/domains", {
      headers: { Origin: "http://localhost:4321" },
      data: { target },
    });
    const body = (await response.json()) as { data: { domainId: string } };
    return body.data.domainId;
  }

  test("the empty notification centre has no automatically detectable WCAG 2.2 AA violations", async ({
    page,
  }) => {
    await addVirtualAuthenticator(page);
    await registerNewAccount(page, `A11y Notif Empty ${Date.now()}`);
    await setPlan(page, "pro");
    await page.goto("/app/notifications");
    await ensureRealPage(page);
    await expect(page.getByText("No notifications yet")).toBeVisible({ timeout: 10_000 });
    await scan(page);
  });

  test("a populated notification list, including a grouped occurrence and filters, has no automatically detectable WCAG 2.2 AA violations", async ({
    page,
  }) => {
    await addVirtualAuthenticator(page);
    await registerNewAccount(page, `A11y Notif List ${Date.now()}`);
    await setPlan(page, "pro");
    const domainId = await saveDomain(page, "a11y-notif-list.com");
    await seedNotificationState(page, {
      action: "policy_change",
      domainId,
      origin: "website_policy",
    });
    await seedNotificationState(page, {
      action: "resource_failure_episode",
      domainId,
      occurrenceCount: 2,
    });

    await page.goto("/app/notifications");
    await ensureRealPage(page);
    await expect(page.getByText("a11y-notif-list.com: AI crawler policy changed")).toBeVisible({
      timeout: 10_000,
    });
    await scan(page);
  });

  test("a monitoring-paused notification has no automatically detectable WCAG 2.2 AA violations", async ({
    page,
  }) => {
    await addVirtualAuthenticator(page);
    await registerNewAccount(page, `A11y Notif Paused ${Date.now()}`);
    await setPlan(page, "pro");
    const domainId = await saveDomain(page, "a11y-notif-paused.com");
    await seedNotificationState(page, { action: "monitoring_paused", domainId });

    await page.goto("/app/notifications");
    await ensureRealPage(page);
    await expect(page.getByText("Monitoring paused for a11y-notif-paused.com")).toBeVisible({
      timeout: 10_000,
    });
    await scan(page);
  });

  test("the Atom feed management panel, including the created-secret state, has no automatically detectable WCAG 2.2 AA violations", async ({
    page,
  }) => {
    await addVirtualAuthenticator(page);
    await registerNewAccount(page, `A11y Notif Atom ${Date.now()}`);
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
    await expect(page.getByText("Save this URL now")).toBeVisible();
    await scan(page);
  });
});
