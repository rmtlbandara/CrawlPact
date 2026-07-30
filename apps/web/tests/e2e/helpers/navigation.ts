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
    // Poll the actual condition we care about (real content rendered)
    // instead of `networkidle`, an indirect, slower proxy for the same
    // thing that doesn't guarantee it either.
    const hasContent = await page
      .waitForFunction(() => document.body.innerHTML.trim().length > 0, { timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    if (hasContent) return;
    await page.waitForTimeout(500 * (attempt + 1));
    await page.reload();
  }
}
