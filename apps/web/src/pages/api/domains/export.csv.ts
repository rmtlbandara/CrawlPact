import type { APIRoute } from "astro";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import { createDb } from "@crawlpact/database";
import { ApiError } from "@crawlpact/core";
import { getEnv } from "../../../lib/env";
import { requireSession } from "../../../lib/auth/require-session";
import { listDomains } from "../../../lib/domains";
import { getPlan } from "../../../lib/plan";
import { toCsv } from "../../../lib/csv";
import { getPortfolioSnapshot } from "../../../lib/portfolio";
import { isRateLimited, recordSecurityEvent } from "../../../lib/auth/rate-limit";
import { hashIp } from "../../../lib/ip-hash";
import { trackEvent } from "../../../lib/analytics";
import { jsonErrorResponse } from "../../../lib/json-response";

export const prerender = false;

const RATE_LIMIT_SCOPE = "domain_csv_export";
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/**
 * GET /api/domains/export.csv — CSV export of saved domains; requires the
 * plan's `csvExportEnabled` entitlement (SRS §10.40). Extended in Phase 9
 * (docs/product/CSV_EXPORT_WORKFLOW.md) with optional scope filters —
 * `groupId` or `domainIds` — additional portfolio columns, and an opt-in
 * `includeNotes` flag (off by default, per §47). Every scope parameter is
 * re-validated against the caller's own ownership; none of them can ever
 * widen the result beyond the caller's own domains.
 */
export const GET: APIRoute = async ({ request, url }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    const plan = await getPlan(db, user.planId);
    if (!plan.csvExportEnabled) {
      throw new ApiError("FORBIDDEN", "CSV export is not available on your current plan.");
    }

    const ipHash = await hashIp(request);
    if (ipHash) {
      const limited = await isRateLimited(db, "rate_limit", ipHash, {
        max: RATE_LIMIT_MAX,
        windowMs: RATE_LIMIT_WINDOW_MS,
        scope: RATE_LIMIT_SCOPE,
      });
      if (limited) throw new ApiError("RATE_LIMITED", "Too many exports — try again later.");
    }

    const groupIdParam = url.searchParams.get("groupId");
    const domainIdsParam = url.searchParams.get("domainIds");
    const includeNotes = url.searchParams.get("includeNotes") === "1";
    const selectedIds = domainIdsParam
      ? new Set(domainIdsParam.split(",").filter(Boolean).slice(0, 100))
      : null;

    const snapshot = await getPortfolioSnapshot(db, user.id);
    const legacyDomains = await listDomains(db, user.id);
    const legacyByDomainId = new Map(legacyDomains.map((d) => [d.domainId, d]));

    let scope: "all" | "group" | "selected" = "all";
    let rows = snapshot;
    if (groupIdParam) {
      scope = "group";
      rows = rows.filter((d) => d.groupId === groupIdParam);
    } else if (selectedIds) {
      scope = "selected";
      rows = rows.filter((d) => selectedIds.has(d.domainId));
    }

    let notesByDomainId: Map<string, string | null> | null = null;
    if (includeNotes && rows.length > 0) {
      const notesRows = await db
        .select({ id: schema.domains.id, notes: schema.domains.notes })
        .from(schema.domains)
        .where(
          and(
            eq(schema.domains.ownerUserId, user.id),
            isNull(schema.domains.deletedAt),
            inArray(
              schema.domains.id,
              rows.map((r) => r.domainId),
            ),
          ),
        );
      notesByDomainId = new Map(notesRows.map((r) => [r.id, r.notes]));
    }

    const headers = [
      "Domain",
      "Canonical origin",
      "Group",
      "Preset",
      "Monitoring",
      "Monitoring frequency",
      "Policy Health Score",
      "Open findings",
      "Last scan",
      "Next scan",
      "Latest meaningful change",
      "Change origin",
      "Unresolved attention count",
      ...(includeNotes ? ["Notes"] : []),
    ];

    const csv = toCsv(
      headers,
      rows.map((d) => {
        const legacy = legacyByDomainId.get(d.domainId);
        const base: (string | number | null)[] = [
          d.displayName,
          d.canonicalOrigin,
          d.groupName,
          legacy?.preset ?? "",
          d.monitoringState,
          d.monitoringFrequency,
          d.currentScore,
          legacy?.openFindingsCount ?? 0,
          d.lastScanAt,
          d.nextScanAt,
          d.changeSummary ? d.changeSummary.slice(0, 200) : null,
          d.changeOrigin,
          d.attentionReasons.length,
        ];
        if (includeNotes) base.push(notesByDomainId?.get(d.domainId) ?? null);
        return base;
      }),
    );

    await trackEvent(db, "portfolio_export_completed", {
      userId: user.id,
      properties: { plan: plan.id, resultCategory: scope },
    });
    if (ipHash) {
      await recordSecurityEvent(db, "rate_limit", {
        ipHash,
        userId: user.id,
        target: RATE_LIMIT_SCOPE,
      });
    }

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="crawlpact-domains-${scope}.csv"`,
      },
    });
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
