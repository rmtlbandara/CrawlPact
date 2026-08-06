import { and, eq, isNull } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { normalizeTarget } from "@crawlpact/core";
import { createDomain, countActiveDomains, updateDomain } from "./domains";
import { parseCsv, CSV_IMPORT_MAX_ROWS } from "./csv";

/**
 * CSV batch import (docs/product/CSV_IMPORT_WORKFLOW.md). Domain creation
 * only — never triggers a scan (see the workflow doc's load-bearing
 * finding). `previewImportCsv` and `confirmImportCsv` share the same
 * parsing/validation logic (`buildRowPlan`) so preview and confirm can
 * never classify a row differently; confirm never trusts a client-supplied
 * preview result, it re-derives everything from the raw CSV text again.
 */

export const IMPORT_KNOWN_COLUMNS = [
  "domain",
  "display_name",
  "group",
  "notes",
  "monitoring",
] as const;
export const IMPORT_MAX_FILE_BYTES = 256 * 1024;

export type ImportRowResult =
  | "created"
  | "duplicate_in_file"
  | "already_saved"
  | "invalid_domain"
  | "private_target"
  | "group_not_found"
  | "monitoring_unavailable"
  | "limit_exceeded"
  | "batch_limit_exceeded"
  | "field_too_long"
  | "unsupported_field";

export type ImportRowPlan = {
  rowNumber: number;
  rawDomain: string;
  normalizedOrigin: string | null;
  hostname: string | null;
  displayName: string | null;
  groupName: string | null;
  resolvedGroupId: string | null;
  notes: string | null;
  monitoringRequested: boolean | null;
  result: ImportRowResult;
};

export type ImportPlan = {
  unsupportedColumns: string[];
  rows: ImportRowPlan[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
};

export type BuildPlanError =
  | "empty_file"
  | "too_many_rows"
  | "too_many_columns"
  | "field_too_long"
  | "malformed_quoting"
  | "missing_domain_column";

const MAX_FIELD_LENGTH = 300;

function fieldAt(row: string[], index: number): string | null {
  if (index < 0) return null;
  const value = row[index];
  return value === undefined || value.trim().length === 0 ? null : value.trim();
}

/**
 * Parses and classifies every row, given the caller's own existing groups
 * and existing saved-domain origins (both fetched once by the caller, not
 * refetched per row). Never writes to the database — used identically by
 * preview and by confirm's own re-validation pass.
 */
export function buildImportPlan(
  csvText: string,
  context: {
    ownedGroupIdByName: Map<string, string>;
    existingOrigins: Set<string>;
    remainingCapacity: number;
    batchImportLimit: number;
  },
): { ok: true; plan: ImportPlan } | { ok: false; error: BuildPlanError } {
  const parsed = parseCsv(csvText);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const domainIndex = parsed.headers.indexOf("domain");
  if (domainIndex === -1) return { ok: false, error: "missing_domain_column" };

  const knownSet = new Set<string>(IMPORT_KNOWN_COLUMNS);
  const unsupportedColumns = parsed.headers.filter((h) => !knownSet.has(h));
  const displayNameIndex = parsed.headers.indexOf("display_name");
  const groupIndex = parsed.headers.indexOf("group");
  const notesIndex = parsed.headers.indexOf("notes");
  const monitoringIndex = parsed.headers.indexOf("monitoring");

  if (parsed.rows.length > CSV_IMPORT_MAX_ROWS) {
    return { ok: false, error: "too_many_rows" };
  }
  if (parsed.rows.length > context.batchImportLimit) {
    // Every row reported the same terminal reason, per §23 "batch limit exceeded" — the whole
    // file is rejected, not silently truncated to the limit.
    const rows: ImportRowPlan[] = parsed.rows.map((row, i) => ({
      rowNumber: i + 2,
      rawDomain: fieldAt(row, domainIndex) ?? "",
      normalizedOrigin: null,
      hostname: null,
      displayName: null,
      groupName: null,
      resolvedGroupId: null,
      notes: null,
      monitoringRequested: null,
      result: "batch_limit_exceeded",
    }));
    return {
      ok: true,
      plan: {
        unsupportedColumns,
        rows,
        totalRows: rows.length,
        validRows: 0,
        invalidRows: rows.length,
      },
    };
  }

  const seenInFile = new Set<string>();
  const rows: ImportRowPlan[] = [];
  let remaining = context.remainingCapacity;

  for (let i = 0; i < parsed.rows.length; i++) {
    const row = parsed.rows[i]!;
    const rowNumber = i + 2; // 1-indexed + header row
    const rawDomain = fieldAt(row, domainIndex) ?? "";
    const displayName = fieldAt(row, displayNameIndex);
    const groupName = fieldAt(row, groupIndex);
    const notes = fieldAt(row, notesIndex);
    const monitoringRaw = fieldAt(row, monitoringIndex);
    const monitoringRequested =
      monitoringRaw === null ? null : monitoringRaw.toLowerCase() === "on";

    const overLength =
      (displayName?.length ?? 0) > MAX_FIELD_LENGTH || (notes?.length ?? 0) > MAX_FIELD_LENGTH;
    if (overLength) {
      rows.push({
        rowNumber,
        rawDomain,
        normalizedOrigin: null,
        hostname: null,
        displayName,
        groupName,
        resolvedGroupId: null,
        notes,
        monitoringRequested,
        result: "field_too_long",
      });
      continue;
    }

    const normalized = normalizeTarget(rawDomain);
    if (!normalized.ok) {
      rows.push({
        rowNumber,
        rawDomain,
        normalizedOrigin: null,
        hostname: null,
        displayName,
        groupName,
        resolvedGroupId: null,
        notes,
        monitoringRequested,
        result: normalized.reason === "literal_ip" ? "private_target" : "invalid_domain",
      });
      continue;
    }

    let resolvedGroupId: string | null = null;
    if (groupName) {
      const match = context.ownedGroupIdByName.get(groupName.toLowerCase());
      if (!match) {
        rows.push({
          rowNumber,
          rawDomain,
          normalizedOrigin: normalized.normalizedOrigin,
          hostname: normalized.hostname,
          displayName,
          groupName,
          resolvedGroupId: null,
          notes,
          monitoringRequested,
          result: "group_not_found",
        });
        continue;
      }
      resolvedGroupId = match;
    }

    if (seenInFile.has(normalized.normalizedOrigin)) {
      rows.push({
        rowNumber,
        rawDomain,
        normalizedOrigin: normalized.normalizedOrigin,
        hostname: normalized.hostname,
        displayName,
        groupName,
        resolvedGroupId,
        notes,
        monitoringRequested,
        result: "duplicate_in_file",
      });
      continue;
    }
    seenInFile.add(normalized.normalizedOrigin);

    if (context.existingOrigins.has(normalized.normalizedOrigin)) {
      rows.push({
        rowNumber,
        rawDomain,
        normalizedOrigin: normalized.normalizedOrigin,
        hostname: normalized.hostname,
        displayName,
        groupName,
        resolvedGroupId,
        notes,
        monitoringRequested,
        result: "already_saved",
      });
      continue;
    }

    if (remaining <= 0) {
      rows.push({
        rowNumber,
        rawDomain,
        normalizedOrigin: normalized.normalizedOrigin,
        hostname: normalized.hostname,
        displayName,
        groupName,
        resolvedGroupId,
        notes,
        monitoringRequested,
        result: "limit_exceeded",
      });
      continue;
    }
    remaining -= 1;

    rows.push({
      rowNumber,
      rawDomain,
      normalizedOrigin: normalized.normalizedOrigin,
      hostname: normalized.hostname,
      displayName,
      groupName,
      resolvedGroupId,
      notes,
      monitoringRequested,
      result: "created",
    });
  }

  const validRows = rows.filter((r) => r.result === "created").length;
  return {
    ok: true,
    plan: {
      unsupportedColumns,
      rows,
      totalRows: rows.length,
      validRows,
      invalidRows: rows.length - validRows,
    },
  };
}

export async function buildImportContext(
  db: Database,
  ownerUserId: string,
  savedDomainLimit: number,
): Promise<{
  ownedGroupIdByName: Map<string, string>;
  existingOrigins: Set<string>;
  remainingCapacity: number;
}> {
  const [groups, existingDomains, activeCount] = await Promise.all([
    db
      .select({ id: schema.domainGroups.id, name: schema.domainGroups.name })
      .from(schema.domainGroups)
      .where(
        and(
          eq(schema.domainGroups.ownerUserId, ownerUserId),
          isNull(schema.domainGroups.deletedAt),
        ),
      ),
    db
      .select({ canonicalOrigin: schema.domains.canonicalOrigin })
      .from(schema.domains)
      .where(and(eq(schema.domains.ownerUserId, ownerUserId), isNull(schema.domains.deletedAt))),
    countActiveDomains(db, ownerUserId),
  ]);

  return {
    ownedGroupIdByName: new Map(groups.map((g) => [g.name.toLowerCase(), g.id])),
    existingOrigins: new Set(existingDomains.map((d) => d.canonicalOrigin)),
    remainingCapacity: Math.max(savedDomainLimit - activeCount, 0),
  };
}

export type ExecuteImportResult = {
  jobId: string;
  status: "completed" | "completed_with_errors" | "failed";
  totalRows: number;
  createdDomains: number;
  failedDomains: number;
  rows: { rowNumber: number; domain: string; result: ImportRowResult; domainId?: string }[];
};

/** Creates domains for every "created"-classified row, bounded and sequential — see the workflow
 * doc's "why no background job" section: this is pure D1 writes, no outbound network call, so
 * doing this synchronously for up to 100 rows in one request is safe. */
export async function executeImportPlan(
  db: Database,
  ownerUserId: string,
  plan: ImportPlan,
  options: {
    defaultGroupId: string | null;
    applyMonitoring: boolean;
    monitoringFrequency: "none" | "monthly" | "weekly";
  },
): Promise<{ createdDomains: number; failedDomains: number; rows: ExecuteImportResult["rows"] }> {
  const rows: ExecuteImportResult["rows"] = [];
  let createdDomains = 0;
  let failedDomains = 0;

  for (const row of plan.rows) {
    if (row.result !== "created" || !row.normalizedOrigin || !row.hostname) {
      rows.push({ rowNumber: row.rowNumber, domain: row.rawDomain, result: row.result });
      if (row.result !== "created") failedDomains++;
      continue;
    }

    const created = await createDomain(db, ownerUserId, {
      canonicalOrigin: row.normalizedOrigin,
      originalInput: row.rawDomain,
      displayName: row.displayName ?? row.hostname,
      groupId: row.resolvedGroupId ?? options.defaultGroupId,
      preset: undefined,
      savedDomainLimit: Number.MAX_SAFE_INTEGER, // capacity already enforced during planning
      monitoringFrequency: options.monitoringFrequency,
    });

    if (!created.ok) {
      rows.push({
        rowNumber: row.rowNumber,
        domain: row.rawDomain,
        result: created.reason === "duplicate" ? "already_saved" : "limit_exceeded",
      });
      failedDomains++;
      continue;
    }

    const monitoringRequested = row.monitoringRequested ?? options.applyMonitoring;
    if (!monitoringRequested && options.monitoringFrequency !== "none") {
      await updateDomain(db, ownerUserId, created.domain.id, { monitoringState: "paused" });
    }

    rows.push({
      rowNumber: row.rowNumber,
      domain: row.rawDomain,
      result: "created",
      domainId: created.domain.id,
    });
    createdDomains++;
  }

  return { createdDomains, failedDomains, rows };
}
