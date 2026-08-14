import { expect, test } from "@playwright/test";

/**
 * Real-browser proof that the report header's brand mark actually loads, on the one report
 * surface that needs no auth fixture (/sample-report). /audit/[auditId] and /shared/[token]
 * render through the exact same shared AuditReportView/BrandMark components (proven identical by
 * apps/web/src/components/audit-report-view-brand.test.ts) and are already exercised end-to-end
 * elsewhere (audit-conversion.spec.ts, saved-domain-timeline.spec.ts) without failure, so this
 * spec is deliberately scoped to the one page cheap enough to check the actual pixel load here.
 */
test.describe("Report logo — real rendering", () => {
  test("sample report loads the current brand mark, not a broken image, and print media doesn't hide it", async ({
    page,
  }) => {
    await page.goto("/sample-report");

    // The page also renders the site header/footer's own BrandMark instances — scope to the
    // report's own header specifically, identified via its unique adjacent heading text.
    const reportHeading = page.getByText("AI crawler policy report", { exact: true });
    const brandMark = reportHeading.locator("xpath=../img");
    await expect(brandMark).toBeVisible();
    await expect(brandMark).toHaveAttribute("src", "/branding/crawlpact-icon.webp");

    const naturalWidth = await brandMark.evaluate((img: HTMLImageElement) => img.naturalWidth);
    expect(naturalWidth).toBeGreaterThan(0);

    const oldLogoSvg = page.locator('svg[viewBox="0 0 32 32"].text-brand-600');
    await expect(oldLogoSvg).toHaveCount(0);

    await page.emulateMedia({ media: "print" });
    await expect(brandMark).toBeVisible();
  });
});
