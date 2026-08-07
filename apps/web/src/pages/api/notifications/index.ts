import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import { notificationCategorySchema, notificationTypeSchema, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../lib/env";
import { requireSession } from "../../../lib/auth/require-session";
import { listNotifications } from "../../../lib/notifications";
import { jsonErrorResponse, jsonResponse } from "../../../lib/json-response";

export const prerender = false;

/** GET /api/notifications — the notification centre feed (SRS §26), with optional type/category/domain/group/unread filters and cursor pagination. */
export const GET: APIRoute = async ({ request, url }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    const typeParam = url.searchParams.get("type");
    const parsedType = typeParam ? notificationTypeSchema.safeParse(typeParam) : null;
    const categoryParam = url.searchParams.get("category");
    const parsedCategory = categoryParam
      ? notificationCategorySchema.safeParse(categoryParam)
      : null;
    const groupId = url.searchParams.get("groupId");

    // Phase 10 (§29): group filter — always scoped to the caller's own
    // domains, never a client-supplied domain-id list, so a group filter
    // can never leak another account's domains into the notification query.
    let domainIds: string[] | undefined;
    if (groupId) {
      const rows = await db
        .select({ id: schema.domains.id })
        .from(schema.domains)
        .where(and(eq(schema.domains.ownerUserId, user.id), eq(schema.domains.groupId, groupId)));
      domainIds = rows.map((r) => r.id);
    }

    const result = await listNotifications(db, user.id, {
      cursor: url.searchParams.get("cursor") ?? undefined,
      domainId: url.searchParams.get("domainId") ?? undefined,
      domainIds,
      unreadOnly: url.searchParams.get("unreadOnly") === "true",
      type: parsedType?.success ? parsedType.data : undefined,
      category: parsedCategory?.success ? parsedCategory.data : undefined,
    });

    return jsonResponse(ok(result, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
