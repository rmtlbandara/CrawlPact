import { expect, test } from "@playwright/test";

/**
 * Phase 19 pricing-comparison prompt §56: E2E coverage for the strengthened /pricing comparison
 * (four semantic tables replacing the old single 11-row table). Checkout-continuity itself (the
 * full sign-up -> /app/billing round trip) is already covered end-to-end by
 * checkout-continuity.spec.ts; this spec focuses on what's new here — the comparison sections,
 * their entitlement values, and the Free/final CTAs — plus a direct CTA href check that doesn't
 * require a real account.
 */
test.describe("Pricing page comparison", () => {
  test("renders four plan cards with Pro marked Most Popular and Agency not", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { level: 1, name: "Pricing" })).toBeVisible();

    for (const name of ["Free", "Solo", "Pro", "Agency"]) {
      await expect(
        page.locator(`#${name.toLowerCase()}`).getByRole("heading", { name }),
      ).toBeVisible();
    }
    await expect(page.locator("#pro").getByText("Most Popular")).toBeVisible();
    await expect(page.locator("#agency").getByText("Most Popular")).toHaveCount(0);
  });

  test("renders all four comparison sections with a table for every plan", async ({ page }) => {
    await page.goto("/pricing");

    const sections = [
      "Core audit & reports",
      "Domains, history & monitoring",
      "Portfolio workflows",
      "Agency capabilities",
    ];
    for (const heading of sections) {
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    }

    // Every comparison region is a real, keyboard-focusable scroll container (§30/§40).
    const coreRegion = page.getByRole("region", {
      name: "Core audit and report features, scrollable table comparing all plans",
    });
    await expect(coreRegion).toBeVisible();
    await expect(coreRegion.getByRole("table")).toBeVisible();
    for (const name of ["Free", "Solo", "Pro", "Agency"]) {
      await expect(coreRegion.getByRole("columnheader", { name: new RegExp(name) })).toBeVisible();
    }
  });

  test("shows the complete core audit and private report sharing as Included on every plan (§11/§20)", async ({
    page,
  }) => {
    await page.goto("/pricing");
    const coreRegion = page.getByRole("region", {
      name: "Core audit and report features, scrollable table comparing all plans",
    });

    // Cell text is "✓ Included" (checkmark + word) for Included and "Not included" (sr-only,
    // paired with a visible "—") for excluded — matching plain "Included" case-insensitively
    // would also match "Not included", so match the exact rendered strings instead.
    const auditRow = coreRegion.getByRole("row", { name: /Complete AI crawler policy audit/ });
    expect(await auditRow.getByText("✓ Included", { exact: true }).count()).toBe(4);

    const sharingRow = coreRegion.getByRole("row", { name: /Private, revocable report sharing/ });
    expect(await sharingRow.getByText("✓ Included", { exact: true }).count()).toBe(4);
  });

  test("gates Agency branding to Agency only (§19)", async ({ page }) => {
    await page.goto("/pricing");
    const agencyRegion = page.getByRole("region", {
      name: "Agency features, scrollable table comparing all plans",
    });
    const brandingRow = agencyRegion.getByRole("row", { name: /Agency-branded shared reports/ });
    expect(await brandingRow.getByText("✓ Included", { exact: true }).count()).toBe(1);
    expect(await brandingRow.getByText("Not included", { exact: true }).count()).toBe(3);
  });

  test("shows representative entitlement values from the live catalog (§56.8)", async ({
    page,
  }) => {
    await page.goto("/pricing");
    const domainsRegion = page.getByRole("region", {
      name: "Domain, history and monitoring limits, scrollable table comparing all plans",
    });

    const savedDomainsRow = domainsRegion.getByRole("row", { name: /^Saved domains/ });
    await expect(savedDomainsRow).toContainText("1");
    await expect(savedDomainsRow).toContainText("5");
    await expect(savedDomainsRow).toContainText("25");
    await expect(savedDomainsRow).toContainText("100");

    const monitoringRow = domainsRegion.getByRole("row", { name: /^Automatic monitoring/ });
    await expect(monitoringRow).toContainText("No automatic monitoring");
    await expect(monitoringRow).toContainText("Weekly");
  });

  test("Yearly is selected by default and toggling to Monthly updates comparison header prices", async ({
    page,
  }) => {
    await page.goto("/pricing");
    const yearlyToggle = page.getByRole("button", { name: "Yearly", exact: false });
    await expect(yearlyToggle).toHaveAttribute("aria-pressed", "true");

    const coreRegion = page.getByRole("region", {
      name: "Core audit and report features, scrollable table comparing all plans",
    });
    await expect(coreRegion.getByRole("columnheader", { name: /Solo/ })).toContainText("$89/year");

    await page.getByRole("button", { name: "Monthly", exact: true }).click();
    await expect(coreRegion.getByRole("columnheader", { name: /Solo/ })).toContainText("$9/month");
  });

  test("an unauthenticated visitor's Pro CTA preserves plan and interval", async ({ page }) => {
    await page.goto("/pricing");
    const proLink = page.locator("#pro").getByRole("link", { name: "Choose Pro" });
    await expect(proLink).toHaveAttribute("href", "/sign-in?plan=pro&interval=year");
  });

  test("Free plan and the final CTA both point to the free audit", async ({ page }) => {
    await page.goto("/pricing");
    await expect(
      page.locator("#free").getByRole("link", { name: "Scan a website" }),
    ).toHaveAttribute("href", "/audit");
    await expect(page.getByRole("link", { name: "Audit a domain free" })).toHaveAttribute(
      "href",
      "/audit",
    );
  });
});
