import type { APIRoute } from "astro";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { requireSession } from "../../../../lib/auth/require-session";
import { jsonErrorResponse } from "../../../../lib/json-response";

export const prerender = false;

const TEMPLATE =
  [
    "domain,display_name,group,notes,monitoring",
    "example.com,Example Co,,,",
    "docs.example.com,Example Docs,Documentation,,on",
  ].join("\r\n") + "\r\n";

/** GET /api/workspace/import/template.csv — a static example file (docs/product/CSV_IMPORT_WORKFLOW.md). */
export const GET: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    await requireSession(request, db);
    return new Response(TEMPLATE, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="crawlpact-import-template.csv"',
      },
    });
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
