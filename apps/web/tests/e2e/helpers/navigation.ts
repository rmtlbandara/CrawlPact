import type { Page } from "@playwright/test";

/**
 * Astro's dev server on-demand-compiles each route on first hit; under
 * concurrent/rapid navigation this can race and return an empty
 * `<html><head></head><body></body></html>` shell instead of the real page
 * — a transient dev-server quirk, not a real bug (the same race documented
 * in `tests/a11y/home.spec.ts`'s equivalent note for `/changelog`/`/status`).
 * Detects that empty shell and reloads once, which is enough since the
 * route is now compiled.
 */
export async function ensureRealPage(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.waitForLoadState("networkidle");
    const isEmpty = await page.evaluate(() => document.body.innerHTML.trim().length === 0);
    if (!isEmpty) return;
    await page.waitForTimeout(500 * (attempt + 1));
    await page.reload();
  }
}
