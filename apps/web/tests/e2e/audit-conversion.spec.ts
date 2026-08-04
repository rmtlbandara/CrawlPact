import { expect, test } from "@playwright/test";
import { addVirtualAuthenticator } from "./helpers/webauthn";
import { ensureRealPage } from "./helpers/navigation";
import { clearAnonymousAuditRateLimit } from "./helpers/admin-db";
import { retryUntilSettled } from "./helpers/hydration";

// Same CrawlPact-controlled fixture site auth-and-account.spec.ts uses for its real-scan test —
// see that file's comment for why (a stable, version-controlled origin instead of a third party).
const SCAN_FIXTURE_DOMAIN = "e2e-fixture.crawlpact.com";
// The saved canonicalOrigin always carries a scheme ("https://e2e-fixture.crawlpact.com") — these
// headings/links render that full origin, not the bare hostname used to fill the audit form.
const FIXTURE_ORIGIN_PATTERN = new RegExp(`https://${SCAN_FIXTURE_DOMAIN.replace(/\./g, "\\.")}`);

/**
 * The Phase 5 "new user" conversion journey, end to end through a real browser: an anonymous
 * visitor runs a real scan, clicks "Save and monitor this domain" on the public report, signs up
 * for a new account from the continuation-aware sign-in page, lands on the authenticated handoff
 * screen, confirms, and reaches a saved domain — without the report ever having required an
 * account to be useful in the first place. See docs/product/AUDIT_CONVERSION_FLOW.md.
 */
test.describe("Anonymous audit to saved-domain conversion", () => {
  test.beforeEach(async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "WebAuthn virtual authenticator is Chromium-only.");
    await addVirtualAuthenticator(page);
  });

  test("new visitor: audits anonymously, saves via the CTA, signs up, and confirms the save", async ({
    page,
  }) => {
    test.setTimeout(60_000);
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

    // The report is fully usable without an account — the CTA is additive, not a paywall.
    await expect(page.getByRole("heading", { name: "AI crawler policy report" })).toBeVisible();
    const saveButton = page.getByRole("button", { name: "Save and monitor this domain" });
    await expect(saveButton).toBeVisible();

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

    // sign-in.astro defaults to the sign-up tab and names the domain when a valid continuation is
    // present — no extra tab click needed, unlike a plain /sign-in visit.
    await expect(page.getByRole("heading", { level: 1 })).toContainText(SCAN_FIXTURE_DOMAIN);
    await expect(page.getByLabel("Display name")).toBeVisible();

    const displayName = `E2E Conversion User ${Date.now()}`;
    await page.getByLabel("Display name").fill(displayName);
    await Promise.all([
      page.waitForResponse((res) => res.url().includes("/api/auth/register/finish")),
      page.getByRole("button", { name: "Create account with a passkey" }).click(),
    ]);
    await page.getByText("Save your recovery codes now").waitFor();
    await page.getByLabel("I have saved these recovery codes somewhere safe.").check();
    await page.getByRole("button", { name: "Continue to dashboard" }).click();

    // PasskeyAuth's redirectTo carries the continuation through to the authenticated handoff,
    // not the plain /app dashboard a passkey sign-up would otherwise land on.
    await page.waitForURL("**/app/continue?continuation=*");
    await ensureRealPage(page);

    await expect(
      page.getByRole("heading", { name: new RegExp(`^Save ${FIXTURE_ORIGIN_PATTERN.source}\\?$`) }),
    ).toBeVisible();
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
    // The free plan (this brand-new account's default) has no monitoring entitlement — the UI
    // must say so honestly rather than silently omitting the option or falsely offering it.
    await expect(page.getByText("Monitoring isn't included on your plan")).toBeVisible();

    await page
      .getByRole("link", { name: new RegExp(`^Go to ${FIXTURE_ORIGIN_PATTERN.source}$`) })
      .click();
    await page.waitForURL("**/app/domains/*");
    await ensureRealPage(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(SCAN_FIXTURE_DOMAIN);
  });

  test("replaying a continuation link after it has already been used lands on a clear, safe error state", async ({
    page,
  }) => {
    test.setTimeout(60_000);
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

    const saveButton = page.getByRole("button", { name: "Save without monitoring" });
    await retryUntilSettled(async () => {
      await Promise.all([
        page.waitForResponse(
          (res) => res.url().includes("/continuation") && res.request().method() === "POST",
        ),
        saveButton.click(),
      ]);
    });
    await page.waitForURL("**/sign-in?continuation=*");
    const continuationUrl = page.url();

    await page.getByLabel("Display name").fill(`E2E Replay User ${Date.now()}`);
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

    // Re-visiting the original sign-in link a second time, already signed in, follows the same
    // continuation straight back to /app/continue — which must show the already-used error state
    // server-side (no "Confirm and save" button at all), never silently repeat the save.
    await page.goto(continuationUrl);
    await page.waitForURL("**/app/continue?continuation=*");
    await ensureRealPage(page);
    await expect(
      page.getByRole("heading", { name: "This save link is not available" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm and save" })).toHaveCount(0);

    // Independently, the completion endpoint itself also rejects a second attempt at the API
    // layer — proving the server-side protection doesn't rely solely on the page hiding the
    // button (defence in depth, matching PHASE_05_AUDIT_CONVERSION_THREAT_REVIEW.md).
    const continuationId = new URL(continuationUrl).searchParams.get("continuation");
    const replayResponse = await page.request.post(`/api/audit/continuation/${continuationId}`, {
      headers: { Origin: new URL(page.url()).origin },
    });
    expect(replayResponse.status()).toBe(410);
    const replayBody = (await replayResponse.json()) as { error?: { message: string } };
    expect(replayBody.error?.message ?? "").toMatch(/already been used/i);
  });
});
