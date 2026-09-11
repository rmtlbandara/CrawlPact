import type { APIRoute } from "astro";

export const prerender = false;

/**
 * TEMPORARY, disposable diagnostic route — Pre-Phase-4 Observability Step
 * 3A/3B experiment only. Exists solely to empirically test whether
 * Cloudflare auto-enriches a console.error() log event with the real
 * request URL/path even when observability.logs.invocation_logs is false.
 * Logs a fixed, sanitized message (never the request URL/path or the
 * synthetic token in it) so any raw path appearing in the resulting
 * telemetry event can only have come from Cloudflare's own platform
 * enrichment, not from this code. Deleted before this branch is finalized
 * for merge — never intended to reach Production or main.
 */
export const GET: APIRoute = async () => {
  console.error("observability-experiment: sanitized-test-event", {
    surface: "app",
    route_class: "diagnostic",
    event: "test_error_event",
  });
  return new Response("ok", { status: 200 });
};
