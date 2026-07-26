import { useEffect } from "react";
import { track } from "../lib/analytics-client";
import type { ProductEventName } from "../lib/analytics";

/** Renders nothing — fires one page-view-style analytics event on mount. Use once per page. */
export function AnalyticsBeacon({
  eventName,
  properties,
}: {
  eventName: ProductEventName;
  properties?: Record<string, string | number | boolean>;
}) {
  useEffect(() => {
    track(eventName, properties);
  }, [eventName]);
  return null;
}
