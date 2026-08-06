import { expect, test } from "@playwright/test";
import { ensureRealPage } from "./helpers/navigation";
import { ADMIN_STORAGE_STATE } from "./helpers/fixture-accounts";

/**
 * Public Status and Changelog Trust Correction. Real browser coverage for
 * the specific regressions this correction fixes — the removed
 * trust-reducing uptime sentence, the removed dead link to the archived
 * IMPLEMENTATION_STATUS.md doc, no fabricated uptime percentage, and (for
 * the authenticated Super Admin view) the dual public/internal status
 * display. Route-resolution-only coverage for `/status` already exists in
 * trust-pages.spec.ts (Phase 3) — this file is about real page content.
 */
test.describe("Public status page trust content", () => {
  test("shows a real public overall status and summary, never a hardcoded value", async ({
    page,
  }) => {
    await page.goto("/status");
    await ensureRealPage(page);
    await expect(page.getByText("Overall status")).toBeVisible();
    // One of the six real public levels must render as visible text — status
    // is never colour-only (SRS §10.23 / this correction's own §19).
    const levelText = page.locator(
      "text=/Operational|Degraded performance|Partial outage|Major outage|Maintenance|Status unavailable/",
    );
    await expect(levelText.first()).toBeVisible();
  });

  test("never shows the removed trust-reducing uptime sentence or a fabricated percentage", async ({
    page,
  }) => {
    await page.goto("/status");
    await ensureRealPage(page);
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("does not yet have reliable historical uptime");
    expect(bodyText).not.toMatch(/\d{1,3}(\.\d+)?%\s*(uptime|availability)/i);
  });

  test("never links to the archived IMPLEMENTATION_STATUS.md doc", async ({ page }) => {
    await page.goto("/status");
    await ensureRealPage(page);
    const html = await page.content();
    expect(html).not.toContain("IMPLEMENTATION_STATUS.md");
  });

  test("never leaks an internal-only reason or verification-source string into the page source", async ({
    page,
  }) => {
    await page.goto("/status");
    await ensureRealPage(page);
    const html = await page.content();
    // These are real strings this correction's own internal-only detail
    // text uses (lib/admin/health.ts) — none may ever appear on the public
    // page, which only ever consumes getPublicStatus's PublicStatusReport.
    expect(html).not.toContain("scheduled_job_runs");
    expect(html).not.toContain("webhook_events");
    expect(html).not.toContain("security_events");
    expect(html).not.toContain("in the last hour");
  });

  test("Billing and checkout shows Operational on a clean local environment with no recent failures", async ({
    page,
  }) => {
    await page.goto("/status");
    await ensureRealPage(page);
    const billingRow = page.locator("li", { hasText: "Billing and checkout" });
    await expect(billingRow).toBeVisible();
    await expect(billingRow.getByText("Operational")).toBeVisible();
  });
});

test.describe("Changelog trust content", () => {
  test("uses the production-appropriate introduction, not development-status wording", async ({
    page,
  }) => {
    await page.goto("/changelog");
    await ensureRealPage(page);
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).toContain(
      "Meaningful CrawlPact product, reliability, security, and content improvements",
    );
    expect(bodyText).not.toMatch(/still in development|not yet production-ready|work in progress/i);
  });
});

test.describe("Admin health/status page requires authorisation", () => {
  // No storageState applied in this describe block — a genuinely
  // unauthenticated request, matching seo-metadata.spec.ts's own
  // established pattern for this exact check.
  test("redirects an unauthenticated request to sign-in", async ({ request }) => {
    const response = await request.get("/admin/health", { maxRedirects: 0 });
    expect(response.status()).toBeGreaterThanOrEqual(300);
    expect(response.status()).toBeLessThan(400);
    expect(response.headers()["location"] ?? "").toContain("/sign-in");
  });
});

test.describe("Super Admin dual public/internal status display", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "WebAuthn is Chromium-only.");
  test.use({ storageState: ADMIN_STORAGE_STATE });

  test("shows the public overall status, the internal overall state, and per-component public/internal labels side by side", async ({
    page,
  }) => {
    await page.goto("/admin/health");
    await ensureRealPage(page);
    await expect(page.getByText("Public overall status")).toBeVisible();
    await expect(page.getByText("Internal overall state")).toBeVisible();
    await expect(page.getByText("Public impact right now")).toBeVisible();
    await expect(page.getByText("Active public incidents")).toBeVisible();
    await expect(page.getByText("Internal warnings (no public impact)")).toBeVisible();
    // At least one per-component card must show both labelled fields — never
    // two unlabelled badges side by side (this correction's §19).
    await expect(page.getByText("Public:").first()).toBeVisible();
    await expect(page.getByText("Internal:").first()).toBeVisible();
  });
});
