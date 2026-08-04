import { expect, test } from "@playwright/test";

/**
 * Phase 4 (Homepage Information Architecture and Conversion Redesign) E2E coverage — the new
 * homepage sections and the new `/sample-report` route.
 */

test.describe("Homepage sections and conversion links", () => {
  test("shows the three crawler-policy risks section", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: "One crawler-policy mistake can create the wrong outcome.",
      }),
    ).toBeVisible();
  });

  test("sample report preview links to the full sample report", async ({ page }) => {
    await page.goto("/");
    const link = page.getByRole("link", { name: "View the full sample report →" });
    await expect(link).toHaveAttribute("href", "/sample-report");
  });

  test("crawler-purpose section links to the crawler directory", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Not every AI crawler serves the same purpose." }),
    ).toBeVisible();
  });

  test("agency section is present with working CTAs", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Govern crawler policy across every client website." }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Review Agency pricing" })).toHaveAttribute(
      "href",
      "/pricing#agency",
    );
  });

  test("evidence and methodology section links to all six required trust destinations", async ({
    page,
  }) => {
    await page.goto("/");
    const main = page.locator("#main-content");
    for (const [name, href] of [
      ["Methodology", "/methodology"],
      ["Crawler directory", "/crawlers"],
      ["Status", "/status"],
      ["Security", "/security"],
      ["About", "/about"],
      ["Corrections process", "/methodology#corrections"],
    ] as const) {
      await expect(main.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
    }
  });

  test("pricing preview reuses the same plan data as the pricing page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Pricing", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Choose Pro" })).toHaveAttribute(
      "href",
      "/pricing#pro",
    );
  });

  test("final CTA includes the standard limitation and a sample-report link", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByText(
        "Results describe published policy signals and do not guarantee crawler behaviour.",
      ),
    ).toBeVisible();
  });
});

test.describe("/sample-report", () => {
  test("returns 200 and is clearly labelled as a sample, not a live audit", async ({ page }) => {
    const response = await page.goto("/sample-report");
    expect(response?.ok()).toBe(true);
    await expect(page.getByText("Sample report — demonstrates report structure")).toBeVisible();
  });

  test("has exactly one H1 and renders full report structure", async ({ page }) => {
    await page.goto("/sample-report");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("AI crawler policy report");
    await expect(page.getByRole("heading", { name: "Crawler access matrix" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Findings" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Limitations" })).toBeVisible();
  });

  test("contains no real customer domain — uses the reserved .example fixture domain", async ({
    page,
  }) => {
    await page.goto("/sample-report");
    await expect(
      page.locator("#main-content").getByText("sample-domain.example", { exact: true }),
    ).toBeVisible();
  });

  test("links back to a free audit", async ({ page }) => {
    await page.goto("/sample-report");
    await expect(
      page.locator("#main-content").getByRole("link", { name: "Audit a domain" }),
    ).toHaveAttribute("href", "/#hero-audit-form");
  });
});
