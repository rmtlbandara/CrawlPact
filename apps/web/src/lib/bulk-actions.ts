import { and, eq, inArray, isNull } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { getOwnedGroup } from "./groups";
import { updateDomain } from "./domains";

/**
 * Bounded bulk organisational actions (docs/product/BULK_ACTION_MODEL.md).
 * Every domain ID is re-validated against ownership here — never trusted
 * from the caller — and each domain's outcome is independent: one
 * domain's failure never aborts the rest of the batch.
 */

export type BulkActionType =
  | "assign_group"
  | "move_group"
  | "remove_from_group"
  | "enable_monitoring"
  | "disable_monitoring"
  | "pause_monitoring"
  | "resume_monitoring";

export type BulkActionRowOutcome = {
  domainId: string;
  outcome: "succeeded" | "skipped" | "failed";
  reason?: string;
};

export async function executeBulkAction(
  db: Database,
  ownerUserId: string,
  action: BulkActionType,
  domainIds: string[],
  options: { groupId?: string | null; monitoringFrequency: "none" | "monthly" | "weekly" },
): Promise<BulkActionRowOutcome[]> {
  if ((action === "assign_group" || action === "move_group") && options.groupId) {
    const group = await getOwnedGroup(db, ownerUserId, options.groupId);
    if (!group) {
      return domainIds.map((domainId) => ({
        domainId,
        outcome: "failed",
        reason: "invalid_group",
      }));
    }
  }

  const ownedDomains = await db
    .select()
    .from(schema.domains)
    .where(
      and(
        eq(schema.domains.ownerUserId, ownerUserId),
        isNull(schema.domains.deletedAt),
        inArray(schema.domains.id, domainIds),
      ),
    );
  const ownedById = new Map(ownedDomains.map((d) => [d.id, d]));

  const results: BulkActionRowOutcome[] = [];
  for (const domainId of domainIds) {
    const domain = ownedById.get(domainId);
    if (!domain) {
      results.push({ domainId, outcome: "skipped", reason: "not_found_or_cross_account" });
      continue;
    }

    switch (action) {
      case "assign_group":
      case "move_group": {
        const targetGroupId = options.groupId ?? null;
        if (domain.groupId === targetGroupId) {
          results.push({ domainId, outcome: "skipped", reason: "already_in_target_state" });
          continue;
        }
        const updated = await updateDomain(db, ownerUserId, domainId, { groupId: targetGroupId });
        results.push({
          domainId,
          outcome: updated.ok ? "succeeded" : "failed",
          reason: updated.ok ? undefined : updated.reason,
        });
        continue;
      }
      case "remove_from_group": {
        if (domain.groupId === null) {
          results.push({ domainId, outcome: "skipped", reason: "already_in_target_state" });
          continue;
        }
        const updated = await updateDomain(db, ownerUserId, domainId, { groupId: null });
        results.push({
          domainId,
          outcome: updated.ok ? "succeeded" : "failed",
          reason: updated.ok ? undefined : updated.reason,
        });
        continue;
      }
      case "enable_monitoring":
      case "resume_monitoring": {
        if (options.monitoringFrequency === "none") {
          results.push({ domainId, outcome: "skipped", reason: "plan_no_monitoring" });
          continue;
        }
        if (domain.monitoringState === "active") {
          results.push({ domainId, outcome: "skipped", reason: "already_in_target_state" });
          continue;
        }
        const updated = await updateDomain(db, ownerUserId, domainId, {
          monitoringState: "active",
        });
        results.push({
          domainId,
          outcome: updated.ok ? "succeeded" : "failed",
          reason: updated.ok ? undefined : updated.reason,
        });
        continue;
      }
      case "disable_monitoring":
      case "pause_monitoring": {
        if (domain.monitoringState === "paused") {
          results.push({ domainId, outcome: "skipped", reason: "already_in_target_state" });
          continue;
        }
        const updated = await updateDomain(db, ownerUserId, domainId, {
          monitoringState: "paused",
        });
        results.push({
          domainId,
          outcome: updated.ok ? "succeeded" : "failed",
          reason: updated.ok ? undefined : updated.reason,
        });
        continue;
      }
    }
  }

  return results;
}
