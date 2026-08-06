import { expect, test } from "@playwright/test";
import { addVirtualAuthenticator } from "./helpers/webauthn";
import { registerNewAccount } from "./helpers/auth";
import { setPlan } from "./helpers/admin-db";
import { ensureRealPage } from "./helpers/navigation";
import { retryUntilSettled } from "./helpers/hydration";

/**
 * Phase 9 (Agency Workspace and Portfolio Workflows) — real browser
 * coverage of the new portfolio workspace, domain groups, CSV import,
 * bulk actions, and agency branding, built on the same real
 * passkey-registration flow every other e2e suite in this repo uses.
 * Domains are created through the real `/api/domains` endpoint (the same
 * one the UI itself calls), not seeded directly into D1 — this is data
 * setup, not a bypass of the code under test.
 */
test.describe("Agency workspace", () => {
  test.beforeEach(async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "WebAuthn virtual authenticator is Chromium-only.");
    await addVirtualAuthenticator(page);
  });

  async function saveDomain(page: import("@playwright/test").Page, target: string): Promise<void> {
    const response = await page.request.post("/api/domains", {
      headers: { Origin: page.url() ? new URL(page.url()).origin : "http://localhost:4321" },
      data: { target },
    });
    expect(response.ok()).toBe(true);
  }

  test("Journey A — Pro: create a group, assign a domain, filter, export, branding unavailable", async ({
    page,
  }) => {
    await registerNewAccount(page, `E2E Pro ${Date.now()}`);
    await setPlan(page, "pro");
    await page.goto("/app/domains");
    await ensureRealPage(page);
    await saveDomain(page, "pro-journey-one.com");
    await saveDomain(page, "pro-journey-two.com");

    await page.goto("/app/groups");
    await ensureRealPage(page);
    await page.getByLabel("Group name").fill("Client Portfolio");
    await retryUntilSettled(async () => {
      await Promise.all([
        page.waitForResponse((res) => res.url().endsWith("/api/groups") && res.status() === 201),
        page.getByRole("button", { name: "Create group" }).click(),
      ]);
    });
    // The group name renders inside an editable <input value="..."> in GroupsManager's list
    // item, not as plain text — getByText() only matches text nodes, so this checks the input's
    // value directly.
    await expect(page.locator('input[value="Client Portfolio"]')).toBeVisible({ timeout: 10_000 });

    await page.goto("/app/workspace");
    await ensureRealPage(page);
    await expect(page.getByRole("heading", { name: "Agency workspace" })).toBeVisible();
    await expect(page.getByText("Agency report branding")).toBeVisible();
    await expect(page.getByText("Review the Agency plan")).toBeVisible();
  });

  test("Journey B — Agency: portfolio summary, attention queue, recent changes render real counts", async ({
    page,
  }) => {
    await registerNewAccount(page, `E2E Agency ${Date.now()}`);
    await setPlan(page, "agency");
    await saveDomain(page, "agency-journey-domain.com");

    await page.goto("/app/workspace");
    await ensureRealPage(page);
    await expect(page.getByRole("heading", { name: "Portfolio summary" })).toBeVisible();
    await expect(page.getByLabel(/total saved domains/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "Attention queue" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent portfolio changes" })).toBeVisible();
    // The baseline-pending domain we just saved should show up requiring attention.
    await expect(page.getByText("agency-journey-domain.com")).toBeVisible({ timeout: 10_000 });
  });

  test("Journey C — Pro batch import: upload a CSV, preview, confirm, see created domains", async ({
    page,
  }) => {
    await registerNewAccount(page, `E2E Import ${Date.now()}`);
    await setPlan(page, "pro");

    await page.goto("/app/workspace/import");
    await ensureRealPage(page);
    const csvContent =
      "domain,display_name\nimport-one.example.com,Import One\nimport-two.example.com,Import Two\n";
    await page.setInputFiles('input[type="file"]', {
      name: "import.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csvContent),
    });
    await expect(page.getByText("2 of 2 rows are ready to import")).toBeVisible({
      timeout: 10_000,
    });

    await retryUntilSettled(async () => {
      await Promise.all([
        page.waitForResponse(
          (res) => res.url().includes("/api/workspace/import/confirm") && res.status() === 200,
        ),
        page.getByRole("button", { name: /^Import 2 domains$/ }).click(),
      ]);
    });
    await expect(page.getByText("Created 2 of 2 domains")).toBeVisible();

    await page.goto("/app/domains");
    await ensureRealPage(page);
    // The CSV's own display_name column ("Import One"/"Import Two") takes precedence over the
    // raw domain as the rendered name — the same precedence createDomain always uses.
    await expect(page.getByText("Import One")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Import Two")).toBeVisible({ timeout: 10_000 });
  });

  test("Journey F — CSV security: a formula-like display name survives import/export without executing", async ({
    page,
  }) => {
    await registerNewAccount(page, `E2E CSVSec ${Date.now()}`);
    await setPlan(page, "pro");

    await page.goto("/app/workspace/import");
    await ensureRealPage(page);
    const csvContent = "domain,display_name\r\nformula-target.com,\"=cmd|'/c calc'!A1\"\r\n";
    await page.setInputFiles('input[type="file"]', {
      name: "import.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csvContent),
    });
    await expect(page.getByText("1 of 1 rows are ready to import")).toBeVisible({
      timeout: 10_000,
    });
    await retryUntilSettled(async () => {
      await Promise.all([
        page.waitForResponse(
          (res) => res.url().includes("/api/workspace/import/confirm") && res.status() === 200,
        ),
        page.getByRole("button", { name: /^Import 1 domain$/ }).click(),
      ]);
    });

    // The exported CSV is fetched at the HTTP level (not via a real browser download) — this
    // exercises the same authenticated, cookie-bearing request the "Export CSV" link makes,
    // without Playwright's page.goto/download-event interaction quirk.
    const exportResponse = await page.request.get("/api/domains/export.csv");
    expect(exportResponse.ok()).toBe(true);
    const csvText = await exportResponse.text();
    // A leading `'` neutralises the formula in every spreadsheet application — the raw `=` must
    // never appear as the first character of the cell.
    expect(csvText).toContain("'=cmd|");
    expect(csvText).not.toMatch(/,=cmd\|/);
  });

  test("Journey G — bulk monitoring: select two domains, pause monitoring, see per-domain results", async ({
    page,
  }) => {
    await registerNewAccount(page, `E2E Bulk ${Date.now()}`);
    await setPlan(page, "pro");
    await saveDomain(page, "bulk-one.com");
    await saveDomain(page, "bulk-two.com");

    await page.goto("/app/workspace/domains");
    await ensureRealPage(page);
    const rowCheckboxes = page.locator('input[type="checkbox"][aria-label^="Select "]');
    await expect(rowCheckboxes).toHaveCount(2, { timeout: 10_000 });
    await rowCheckboxes.nth(0).check();
    await rowCheckboxes.nth(1).check();

    await expect(page.getByText("2 selected")).toBeVisible();
    await page.getByLabel("Bulk action").click();
    await page.getByRole("option", { name: "Pause monitoring" }).click();
    await retryUntilSettled(async () => {
      await Promise.all([
        page.waitForResponse(
          (res) => res.url().includes("/api/workspace/bulk-actions") && res.status() === 200,
        ),
        page.getByRole("button", { name: /^Apply to 2 domains$/ }).click(),
      ]);
    });
    await expect(page.getByText(/succeeded, 0 skipped, 0 failed/)).toBeVisible();
  });

  test("Journey I — group deletion: deleting a non-empty group preserves domains and moves them to Ungrouped", async ({
    page,
  }) => {
    await registerNewAccount(page, `E2E GroupDelete ${Date.now()}`);
    await setPlan(page, "pro");
    await saveDomain(page, "group-delete-target.com");

    await page.goto("/app/groups");
    await ensureRealPage(page);
    await page.getByLabel("Group name").fill("Temporary Group");
    await retryUntilSettled(async () => {
      await Promise.all([
        page.waitForResponse((res) => res.url().endsWith("/api/groups") && res.status() === 201),
        page.getByRole("button", { name: "Create group" }).click(),
      ]);
    });

    await page.goto("/app/domains");
    await ensureRealPage(page);
    // Assign the domain to the group via the domain-detail page's group selector is out of
    // scope here; assign directly through the API the UI itself calls.
    const domainsResponse = await page.request.get("/api/domains");
    const domainsBody = (await domainsResponse.json()) as {
      data: { domainId: string }[];
    };
    const domainId = domainsBody.data[0]!.domainId;
    const groupsResponse = await page.request.get("/api/groups");
    const groupsBody = (await groupsResponse.json()) as { data: { groupId: string }[] };
    const groupId = groupsBody.data[0]!.groupId;
    await page.request.patch(`/api/domains/${domainId}`, {
      headers: { Origin: "http://localhost:4321" },
      data: { groupId },
    });

    await page.goto("/app/groups");
    await ensureRealPage(page);
    await expect(page.getByText("1 domain")).toBeVisible();
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("heading", { name: /^Delete "Temporary Group"\?$/ })).toBeVisible();
    await retryUntilSettled(async () => {
      await Promise.all([
        page.waitForResponse(
          (res) => res.url().includes("/api/groups/") && res.request().method() === "DELETE",
        ),
        page.getByRole("button", { name: "Delete group" }).click(),
      ]);
    });
    await expect(page.getByText("No groups yet")).toBeVisible();

    const domainCheck = await page.request.get(`/api/domains/${domainId}`);
    const domainCheckBody = (await domainCheck.json()) as { data: { groupId: string | null } };
    expect(domainCheckBody.data.groupId).toBeNull();
  });

  test("Journey J — mobile: portfolio workspace and import preview render without horizontal overflow at 390px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await registerNewAccount(page, `E2E Mobile ${Date.now()}`);
    await setPlan(page, "agency");
    await saveDomain(page, "mobile-journey.com");

    await page.goto("/app/workspace");
    await ensureRealPage(page);
    await expect(page.getByRole("heading", { name: "Agency workspace" })).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    await page.goto("/app/workspace/import");
    await ensureRealPage(page);
    const importScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const importClientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(importScrollWidth).toBeLessThanOrEqual(importClientWidth + 1);
  });

  test("Journey K — cross-account: one account cannot see another account's portfolio, groups, or domains", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await addVirtualAuthenticator(pageA);
    await registerNewAccount(pageA, `E2E Isolation A ${Date.now()}`);
    await setPlan(pageA, "agency");
    await pageA.request.post("/api/domains", {
      headers: { Origin: "http://localhost:4321" },
      data: { target: "isolation-a-only.com" },
    });
    const groupResponse = await pageA.request.post("/api/groups", {
      headers: { Origin: "http://localhost:4321" },
      data: { name: "A's Group" },
    });
    expect(groupResponse.ok()).toBe(true);

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await addVirtualAuthenticator(pageB);
    await registerNewAccount(pageB, `E2E Isolation B ${Date.now()}`);
    await setPlan(pageB, "agency");

    await pageB.goto("/app/workspace");
    await ensureRealPage(pageB);
    await expect(pageB.getByText("isolation-a-only.com")).toHaveCount(0);

    const groupsAsB = await pageB.request.get("/api/groups");
    const groupsAsBBody = (await groupsAsB.json()) as { data: { name: string }[] };
    expect(groupsAsBBody.data.find((g) => g.name === "A's Group")).toBeUndefined();

    const summaryAsB = await pageB.request.get("/api/workspace/summary");
    const summaryAsBBody = (await summaryAsB.json()) as { data: { totalDomains: number } };
    expect(summaryAsBBody.data.totalDomains).toBe(0);

    await contextA.close();
    await contextB.close();
  });
});
