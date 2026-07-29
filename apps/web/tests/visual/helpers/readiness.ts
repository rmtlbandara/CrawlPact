import type { Page } from "@playwright/test";
import { ensureRealPage } from "../../e2e/helpers/navigation";

/**
 * Replaces `networkidle` as the pre-screenshot readiness signal for visual
 * regression tests. `networkidle` only guarantees network quiescence — it
 * says nothing about whether fonts have swapped in or layout has actually
 * settled, which is why the same commit's render could differ by ~1-2% of
 * pixels (and occasionally by whole rows of pixels) between two separate CI
 * runs. See docs/status/KNOWN_RISKS.md.
 *
 * `ensureRealPage` guards against Astro's dev server returning an empty
 * shell on a route's first hit under concurrent workers (same helper the
 * e2e suite already relies on for the same server).
 */
export async function waitForVisualReadiness(page: Page): Promise<void> {
  await ensureRealPage(page);

  await page.evaluate(() => document.fonts.ready);

  // No in-flight CSS animation/transition frame or blinking caret can land
  // in a screenshot. `toHaveScreenshot`'s own `animations: "disabled"`
  // option only freezes CSS animations at the moment of capture, not
  // before — this removes them outright so nothing is mid-transition when
  // the layout-stability check below measures the page.
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
    `,
  });

  // Poll document height across animation frames until it stops changing.
  // Catches hydration-triggered reflows and late-settling images that
  // networkidle can resolve either before or after, unpredictably — the
  // exact failure mode behind the 1px/18px height mismatches recorded in
  // KNOWN_RISKS.md.
  await page.waitForFunction(
    () =>
      new Promise<boolean>((resolve) => {
        const before = document.documentElement.scrollHeight;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve(document.documentElement.scrollHeight === before);
          });
        });
      }),
    { timeout: 5_000 },
  );
}
