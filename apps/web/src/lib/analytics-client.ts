import type { ProductEventName } from "./analytics";

/** Fire-and-forget client-side event beacon — never awaited by the caller, never blocks navigation. */
export function track(
  eventName: ProductEventName,
  properties?: Record<string, string | number | boolean>,
): void {
  fetch("/api/analytics/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventName, properties }),
    keepalive: true,
  }).catch(() => {
    // Analytics must never surface an error to the user.
  });
}
