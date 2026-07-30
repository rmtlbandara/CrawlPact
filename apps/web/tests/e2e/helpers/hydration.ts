import { expect } from "@playwright/test";

/**
 * React islands (`client:load`/`client:idle`) attach their event handlers
 * asynchronously after the initial HTML paints. A click that lands before
 * that happens is a real click Playwright considers successful — the
 * element was visible and received the event — but has no effect, since no
 * handler was attached yet to receive it. `networkidle` was previously used
 * as an indirect, unreliable proxy for "hydration is probably done by now"
 * (slow, and not actually tied to hydration completing). This retries the
 * interaction itself against a concrete expected effect instead, which is
 * deterministic regardless of how long hydration actually takes: no effect
 * within the retry's own short window means the handler wasn't attached
 * yet, so try again.
 */
export async function retryUntilSettled(
  action: () => Promise<void>,
  timeoutMs = 10_000,
): Promise<void> {
  await expect(action).toPass({ timeout: timeoutMs });
}
