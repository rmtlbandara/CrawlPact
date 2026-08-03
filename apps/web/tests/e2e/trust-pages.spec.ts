import { expect, test } from "@playwright/test";

/**
 * Phase 3 (Legal Identity, Contact, Security and Trust Foundation) E2E coverage: every trust
 * route resolves, carries the approved contact addresses, and remains reachable from the footer
 * on both desktop and mobile viewports.
 */

const TRUST_ROUTES = ["/privacy", "/terms", "/contact", "/security", "/about", "/status"];

test.describe("Trust routes resolve without authentication", () => {
  for (const path of TRUST_ROUTES) {
    test(`${path} returns 200`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.ok()).toBe(true);
    });
  }

  test("/.well-known/security.txt returns 200 as text/plain with the required RFC 9116 fields", async ({
    request,
  }) => {
    const response = await request.get("/.well-known/security.txt");
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"] ?? "").toContain("text/plain");
    const body = await response.text();
    expect(body).toContain("Contact: mailto:info@crawlpact.com");
    expect(body).toContain("Canonical: https://crawlpact.com/.well-known/security.txt");
    expect(body).toContain("Policy: https://crawlpact.com/security");
    expect(body).toContain("Preferred-Languages: en");
    expect(body).toMatch(/Expires: \d{4}-\d{2}-\d{2}/);
  });
});

test.describe("Contact routing uses the approved addresses", () => {
  test("/contact links to the correct mailto address for each category", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByRole("link", { name: "info@crawlpact.com" }).first()).toHaveAttribute(
      "href",
      "mailto:info@crawlpact.com",
    );
    await expect(page.getByRole("link", { name: "support@crawlpact.com" }).first()).toHaveAttribute(
      "href",
      "mailto:support@crawlpact.com",
    );
  });

  test("/security links to the responsible-disclosure contact", async ({ page }) => {
    await page.goto("/security");
    await expect(page.getByRole("link", { name: "info@crawlpact.com" }).first()).toHaveAttribute(
      "href",
      "mailto:info@crawlpact.com",
    );
  });

  test("/methodology links to the content-correction contact", async ({ page }) => {
    await page.goto("/methodology");
    await expect(page.getByRole("link", { name: "support@crawlpact.com" }).first()).toHaveAttribute(
      "href",
      "mailto:support@crawlpact.com",
    );
  });
});

test.describe("Footer trust navigation", () => {
  for (const [label, href] of [
    ["About CrawlPact", "/about"],
    ["Contact", "/contact"],
    ["Privacy policy", "/privacy"],
    ["Terms of service", "/terms"],
    ["Security", "/security"],
    ["Status", "/status"],
  ] as const) {
    test(`homepage footer links to ${label}`, async ({ page }) => {
      await page.goto("/");
      const link = page.getByRole("contentinfo").getByRole("link", { name: label, exact: true });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", href);
    });
  }

  test("footer trust links remain reachable on a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const contactLink = page.getByRole("contentinfo").getByRole("link", { name: "Contact" });
    await contactLink.scrollIntoViewIfNeeded();
    await expect(contactLink).toBeVisible();
  });
});
