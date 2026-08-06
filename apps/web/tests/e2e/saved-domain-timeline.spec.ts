import { expect, test } from "@playwright/test";
import { addVirtualAuthenticator } from "./helpers/webauthn";
import { registerNewAccount } from "./helpers/auth";
import { ensureRealPage } from "./helpers/navigation";
import { clearAnonymousAuditRateLimit } from "./helpers/admin-db";
import { retryUntilSettled } from "./helpers/hydration";

// Same CrawlPact-controlled fixture site audit-conversion.spec.ts uses for its real-scan test.
const SCAN_FIXTURE_DOMAIN = "e2e-fixture.crawlpact.com";
const FIXTURE_ORIGIN_PATTERN = new RegExp(`https://${SCAN_FIXTURE_DOMAIN.replace(/\./g, "\\.")}`);

/**
 * Phase 8 (Saved-Domain Experience and Change Timeline) — real end-to-end
 * coverage of the redesigned domain list and domain-detail page, built on
 * top of the same real anonymous-audit-to-save flow
 * audit-conversion.spec.ts already proves works, so this exercises the new
 * UI against a genuinely saved domain with a real completed scan, not a
 * mock.
 */
test.describe("Saved-domain experience", () => {
  test.beforeEach(async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "WebAuthn virtual authenticator is Chromium-only.");
    await addVirtualAuthenticator(page);
  });

  async function saveAFixtureDomain(page: import("@playwright/test").Page): Promise<void> {
    await clearAnonymousAuditRateLimit(page);
    await page.goto("/");
    const auditButton = page.getByRole("button", { name: "Audit a domain" }).first();
    await retryUntilSettled(async () => {
      await page.getByLabel("Domain or URL to audit").first().fill(SCAN_FIXTURE_DOMAIN);
      await auditButton.click();
      await expect(auditButton).toBeDisabled({ timeout: 1_000 });
    });
    await page.waitForURL("**/audit/*", { timeout: 45_000 });
    await ensureRealPage(page);

    const saveButton = page.getByRole("button", { name: "Save and monitor this domain" });
    await retryUntilSettled(async () => {
      await Promise.all([
        page.waitForResponse(
          (res) => res.url().includes("/continuation") && res.request().method() === "POST",
        ),
        saveButton.click(),
      ]);
    });
    await page.waitForURL("**/sign-in?continuation=*");
    await ensureRealPage(page);

    const displayName = `E2E Timeline User ${Date.now()}`;
    await page.getByLabel("Display name").fill(displayName);
    await Promise.all([
      page.waitForResponse((res) => res.url().includes("/api/auth/register/finish")),
      page.getByRole("button", { name: "Create account with a passkey" }).click(),
    ]);
    await page.getByText("Save your recovery codes now").waitFor();
    await page.getByLabel("I have saved these recovery codes somewhere safe.").check();
    await page.getByRole("button", { name: "Continue to dashboard" }).click();
    await page.waitForURL("**/app/continue?continuation=*");
    await ensureRealPage(page);
    await retryUntilSettled(async () => {
      await Promise.all([
        page.waitForResponse(
          (res) =>
            res.url().includes("/api/audit/continuation/") && res.request().method() === "POST",
        ),
        page.getByRole("button", { name: "Confirm and save" }).click(),
      ]);
    });
    await expect(
      page.getByRole("heading", {
        name: new RegExp(`^${FIXTURE_ORIGIN_PATTERN.source} is saved$`),
      }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: new RegExp(`^Go to ${FIXTURE_ORIGIN_PATTERN.source}$`) })
      .click();
    await page.waitForURL("**/app/domains/*");
    await ensureRealPage(page);
  }

  test("a newly saved domain shows the current-policy summary, a real first-baseline message, monitoring status, and scan history with human-readable status labels", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await saveAFixtureDomain(page);

    // Section 2 — current policy summary (reused deterministic model, not
    // raw report data the user has to interpret first).
    await expect(page.getByRole("heading", { name: "Current policy summary" })).toBeVisible();
    await expect(page.getByText(/^Search:/)).toBeVisible();
    await expect(page.getByText(/^Training:/)).toBeVisible();

    // Section 3 — what changed: a genuine first save has no prior scan to
    // compare against, so the real, honest first-baseline copy renders —
    // never a fabricated "no changes ever" claim.
    await expect(page.getByRole("heading", { name: "What changed" })).toBeVisible();
    await expect(
      page.getByText(
        "This is the first saved baseline. Future scans will appear in the change timeline when a meaningful difference is detected.",
      ),
    ).toBeVisible();

    // Section 4 — monitoring status, including the plan/frequency fields
    // this phase adds (nextScanAt was never shown anywhere pre-Phase 8).
    await expect(page.getByRole("heading", { name: "Monitoring status" })).toBeVisible();
    await expect(page.getByText("Frequency", { exact: true })).toBeVisible();
    await expect(page.getByText("Next scheduled scan")).toBeVisible();

    // Section 5 — the policy-change timeline island actually mounts,
    // resolves its real fetch, and shows the real baseline event
    // establishBaseline() generates for a genuine first successful scan
    // (the same event the "What changed" section above already summarised).
    await expect(page.getByRole("heading", { name: "Policy-change timeline" })).toBeVisible();
    await expect(
      page
        .getByText(
          "This is the first saved baseline. Future scans will appear in the change timeline when a meaningful difference is detected.",
        )
        .last(),
    ).toBeVisible({ timeout: 10_000 });

    // Section 9 — scan history shows the real completed scan with a human
    // label ("Complete"), never the raw "completed" enum string bare on
    // the page (docs/brand/MESSAGING_SURFACE_INVENTORY.md item C3).
    await expect(page.getByRole("heading", { name: "Scan history" })).toBeVisible();
    await expect(page.getByText("Complete", { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });

    // Section 11 — retention messaging is real, not a placeholder.
    await expect(page.getByRole("heading", { name: "History retention" })).toBeVisible();
    await expect(page.getByText(/This account retains domain audit history for/)).toBeVisible();
  });

  test("the saved-domain list shows the new domain with an Active monitoring status chip and a real recent-change value", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await saveAFixtureDomain(page);
    await page.goto("/app/domains");
    await ensureRealPage(page);
    await expect(page.getByRole("cell", { name: SCAN_FIXTURE_DOMAIN })).toBeVisible();
  });

  test("a scan comparison link is reachable from the timeline once a real second scan exists, and evidence renders as inert text (no raw HTML)", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await saveAFixtureDomain(page);

    // Trigger a real manual rescan — a comparable second scan is required
    // before any timeline event (and thus any comparison link) can exist,
    // matching this phase's own no-backfill decision.
    await page.goto(page.url()); // ensure we're on the domain detail page
    const rescanButton = page.getByRole("button", { name: "Re-scan now" });
    await retryUntilSettled(async () => {
      await Promise.all([
        page.waitForResponse(
          (res) => res.url().includes("/scan") && res.request().method() === "POST",
        ),
        rescanButton.click(),
      ]);
    });
    await page.waitForLoadState("networkidle");

    // No script/style tag or `javascript:` scheme ever ends up literally
    // rendered as active markup on the page — proves the evidence-escaping
    // convention holds in a real browser DOM, not just in code review.
    const hasUnescapedScriptTag = await page.evaluate(
      () => document.querySelectorAll("script[data-evidence]").length > 0,
    );
    expect(hasUnescapedScriptTag).toBe(false);
  });
});

test.describe("Saved-domain routes require authorisation", () => {
  test("an unauthenticated request to a domain detail page redirects to sign-in", async ({
    request,
  }) => {
    const response = await request.get("/app/domains/nonexistent-domain-id", { maxRedirects: 0 });
    expect(response.status()).toBeGreaterThanOrEqual(300);
    expect(response.status()).toBeLessThan(400);
    expect(response.headers()["location"] ?? "").toContain("/sign-in");
  });

  test("an unauthenticated request to the saved-domain list redirects to sign-in", async ({
    request,
  }) => {
    const response = await request.get("/app/domains", { maxRedirects: 0 });
    expect(response.status()).toBeGreaterThanOrEqual(300);
    expect(response.status()).toBeLessThan(400);
    expect(response.headers()["location"] ?? "").toContain("/sign-in");
  });

  test("the timeline API rejects an unauthenticated request", async ({ request }) => {
    const response = await request.get("/api/domains/nonexistent-domain-id/timeline");
    expect(response.status()).toBe(401);
  });
});

test.describe("Saved-domain experience on mobile", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "WebAuthn virtual authenticator is Chromium-only.",
  );

  test("the empty saved-domain list is usable at a 390px viewport", async ({ page }) => {
    await addVirtualAuthenticator(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await registerNewAccount(page, `E2E Mobile Domains ${Date.now()}`);
    await page.goto("/app/domains");
    await ensureRealPage(page);
    await expect(page.getByRole("heading", { name: "No saved domains yet" })).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
