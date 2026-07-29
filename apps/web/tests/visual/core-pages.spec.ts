import { expect, test } from "@playwright/test";
import { addVirtualAuthenticator } from "../e2e/helpers/webauthn";
import { registerNewAccount, signInWithPasskey } from "../e2e/helpers/auth";
import { findUserIdByDisplayName, grantSuperAdmin } from "../e2e/helpers/admin-db";
import { waitForVisualReadiness } from "./helpers/readiness";

/**
 * Visual regression baseline for SRS §10.56/§10.57 ("core pages pass visual
 * regression tests"), across the seven required breakpoints (defined as
 * separate projects in playwright.visual.config.ts). Run explicitly via
 * `pnpm test:visual` — excluded from `test:e2e` so unrelated PRs don't flake
 * on pixel diffs. See docs/testing/VISUAL_QA_MATRIX.md.
 *
 * Expanded in Part 3 Step 18 to cover one representative page per remaining
 * distinct template (breadcrumb pages, the 20-item guide/crawler index list
 * layouts, the DB-driven changelog, and the 404 page) — not just the
 * original six core public routes.
 */
// Guards against the exact bug this suite has already hit once: a project's
// viewport getting silently overridden by a later-spread device preset (see
// playwright.visual.config.ts). Every project name ends in its intended
// width (e.g. "mobile-360"), so this asserts the real, live viewport used to
// render the page — not just what the config file claims — before any
// screenshot in this file is taken.
test.beforeEach(async ({ page }, testInfo) => {
  const expectedWidth = Number(testInfo.project.name.split("-").pop());
  expect(page.viewportSize()?.width).toBe(expectedWidth);
});

const ROUTES = [
  { name: "home", path: "/" },
  { name: "about", path: "/about" },
  { name: "audit", path: "/audit" },
  { name: "pricing", path: "/pricing" },
  { name: "crawlers", path: "/crawlers" },
  { name: "crawler-detail", path: "/crawlers/gptbot" },
  { name: "guides", path: "/guides" },
  { name: "guide-detail", path: "/guides/how-to-publish-an-llms-txt-file" },
  { name: "tools", path: "/tools" },
  { name: "tool-detail", path: "/tools/content-signals-checker" },
  { name: "methodology", path: "/methodology" },
  { name: "changelog", path: "/changelog" },
  { name: "not-found", path: "/this-page-does-not-exist" },
];

for (const { name, path } of ROUTES) {
  test(`${name} (${path}) matches its visual baseline`, async ({ page }) => {
    await page.goto(path);
    await waitForVisualReadiness(page);
    await expect(page).toHaveScreenshot(`${name}.png`, {
      fullPage: true,
      animations: "disabled",
    });
  });
}

/**
 * Previously every visual baseline was a public marketing route — the
 * customer dashboard and Super Admin shell had no pixel-level regression
 * coverage at all. WebAuthn (needed for a real session) is Chromium-only,
 * which every project in playwright.visual.config.ts already is.
 *
 * The Super Admin *global dashboard* is deliberately not used here: it
 * renders real, ever-growing registered-user/domain/scan counts (SRS
 * §28.2), which would never stabilise across repeated local runs against
 * the shared dev D1 this suite runs against. "Runtime settings" renders a
 * fixed set of configuration rows untouched by any other test, so it's a
 * stable choice for an admin-shell baseline instead. Each test's
 * account-specific display name is masked, since it is randomly generated
 * per run and would otherwise never match a saved baseline. The mask
 * itself is sized to the rendered text, which varies by a few pixels
 * between runs purely from proportional-font character width (confirmed
 * empirically: two consecutive runs differed only in a sliver right at the
 * masked name, nowhere else on the page) — `maxDiffPixelRatio` absorbs
 * exactly that sliver without hiding a real, page-wide regression.
 */
test.describe("authenticated routes", () => {
  test("customer dashboard (empty state) matches its visual baseline", async ({ page }) => {
    await addVirtualAuthenticator(page);
    const displayName = `Visual Customer ${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    await registerNewAccount(page, displayName);
    await page.goto("/app");
    await waitForVisualReadiness(page);
    await expect(page).toHaveScreenshot("app-dashboard-empty.png", {
      fullPage: true,
      animations: "disabled",
      mask: [page.getByText(displayName)],
      maxDiffPixelRatio: 0.02,
    });
  });

  test("Super Admin runtime settings matches its visual baseline", async ({ page }) => {
    await addVirtualAuthenticator(page);
    const displayName = `Visual Admin ${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    await registerNewAccount(page, displayName);
    const userId = await findUserIdByDisplayName(displayName);
    await grantSuperAdmin(userId);
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("**/");
    await signInWithPasskey(page);
    await page.goto("/admin/settings");
    await waitForVisualReadiness(page);
    await expect(page).toHaveScreenshot("admin-settings.png", {
      fullPage: true,
      animations: "disabled",
      mask: [page.getByText(displayName)],
      maxDiffPixelRatio: 0.02,
    });
  });
});
