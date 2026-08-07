import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { addVirtualAuthenticator } from "../e2e/helpers/webauthn";
import { registerNewAccount } from "../e2e/helpers/auth";
import { setPlan } from "../e2e/helpers/admin-db";
import { ensureRealPage } from "../e2e/helpers/navigation";
import { retryUntilSettled } from "../e2e/helpers/hydration";

/**
 * Phase 9 (Agency Workspace and Portfolio Workflows) accessibility smoke
 * tests, following the same pattern as tests/a11y/home.spec.ts's
 * "authenticated routes" block. WebAuthn (needed to reach an authenticated
 * session) is Chromium-only, matching every other authenticated a11y test
 * in this repo.
 */
test.describe("agency workspace", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "WebAuthn is Chromium-only.");

  async function scan(page: import("@playwright/test").Page) {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  }

  test("the empty agency workspace (Pro) has no automatically detectable WCAG 2.2 AA violations", async ({
    page,
  }) => {
    await addVirtualAuthenticator(page);
    await registerNewAccount(page, `A11y Workspace ${Date.now()}`);
    await setPlan(page, "pro");
    await page.goto("/app/workspace");
    await ensureRealPage(page);
    await expect(page.getByRole("heading", { name: "Agency workspace" })).toBeVisible();
    await scan(page);
  });

  test("the populated portfolio summary and attention queue (Agency) has no automatically detectable WCAG 2.2 AA violations", async ({
    page,
  }) => {
    await addVirtualAuthenticator(page);
    await registerNewAccount(page, `A11y Portfolio ${Date.now()}`);
    await setPlan(page, "agency");
    await page.request.post("/api/domains", {
      headers: { Origin: "http://localhost:4321" },
      data: { target: "a11y-portfolio-domain.com" },
    });
    await page.goto("/app/workspace");
    await ensureRealPage(page);
    await expect(page.getByText("a11y-portfolio-domain.com")).toBeVisible({ timeout: 10_000 });
    await scan(page);
  });

  test("the portfolio table with bulk-selection controls has no automatically detectable WCAG 2.2 AA violations", async ({
    page,
  }) => {
    await addVirtualAuthenticator(page);
    await registerNewAccount(page, `A11y Table ${Date.now()}`);
    await setPlan(page, "agency");
    await page.request.post("/api/domains", {
      headers: { Origin: "http://localhost:4321" },
      data: { target: "a11y-table-domain.com" },
    });
    await page.goto("/app/workspace/domains");
    await ensureRealPage(page);
    await expect(page.getByText("a11y-table-domain.com")).toBeVisible({ timeout: 10_000 });
    await scan(page);
  });

  test("the CSV import upload screen has no automatically detectable WCAG 2.2 AA violations", async ({
    page,
  }) => {
    await addVirtualAuthenticator(page);
    await registerNewAccount(page, `A11y Import ${Date.now()}`);
    await setPlan(page, "pro");
    await page.goto("/app/workspace/import");
    await ensureRealPage(page);
    await expect(page.getByRole("heading", { name: "Import domains" })).toBeVisible();
    await scan(page);
  });

  test("the groups list with a real group has no automatically detectable WCAG 2.2 AA violations", async ({
    page,
  }) => {
    await addVirtualAuthenticator(page);
    await registerNewAccount(page, `A11y Groups ${Date.now()}`);
    await setPlan(page, "pro");
    await page.goto("/app/groups");
    await ensureRealPage(page);
    await page.getByLabel("Group name").fill("A11y Group");
    await retryUntilSettled(async () => {
      await Promise.all([
        page.waitForResponse((res) => res.url().endsWith("/api/groups") && res.status() === 201),
        page.getByRole("button", { name: "Create group" }).click(),
      ]);
    });
    await expect(page.locator('input[value="A11y Group"]')).toBeVisible({ timeout: 10_000 });
    await scan(page);
  });

  test("agency branding settings (Agency plan) has no automatically detectable WCAG 2.2 AA violations", async ({
    page,
  }) => {
    await addVirtualAuthenticator(page);
    await registerNewAccount(page, `A11y Branding ${Date.now()}`);
    await setPlan(page, "agency");
    await page.goto("/app/agency-branding");
    await ensureRealPage(page);
    await expect(page.getByRole("heading", { name: "Agency branding" })).toBeVisible();
    await scan(page);
  });
});
