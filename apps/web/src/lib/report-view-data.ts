import { eq } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { buildRobotsDiff, fullProposedText } from "@crawlpact/policy";
import type { DiffLine } from "@crawlpact/policy";
import { getScanReport } from "./get-scan-report";

export type ReportViewData = {
  report: Awaited<ReturnType<typeof getScanReport>>;
  diffLines: DiffLine[] | null;
  proposedRobotsText: string | null;
};

/** Shared between the direct report page and the public shared-report page — same rendering, different access rules. */
export async function loadReportViewData(db: Database, scanId: string): Promise<ReportViewData> {
  const report = await getScanReport(db, scanId);
  if (!report) return { report: null, diffLines: null, proposedRobotsText: null };

  const [scanRow] = await db
    .select({ recommendedAdditions: schema.scans.recommendedAdditions })
    .from(schema.scans)
    .where(eq(schema.scans.id, scanId))
    .limit(1);
  const [resource] = await db
    .select({ snapshotText: schema.scanResources.snapshotText })
    .from(schema.scanResources)
    .where(eq(schema.scanResources.scanId, scanId))
    .limit(1);

  const originalText = resource?.snapshotText ?? "";
  const proposedAdditions: string[] = scanRow?.recommendedAdditions
    ? (JSON.parse(scanRow.recommendedAdditions) as string[])
    : [];

  return {
    report,
    diffLines: buildRobotsDiff(originalText, proposedAdditions),
    proposedRobotsText: fullProposedText(originalText, proposedAdditions),
  };
}
