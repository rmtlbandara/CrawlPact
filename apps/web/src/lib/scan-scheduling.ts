import type { schema } from "@crawlpact/database";

type MonitoringFrequency = (typeof schema.plans.$inferSelect)["monitoringFrequency"];

/**
 * SRS §25: monitoring frequency drives when a domain is next due for a
 * scheduled scan. Shared between the manual-rescan path (Step 13, so a
 * manual scan pushes the next scheduled one out rather than leaving it
 * imminent) and the scheduled monitoring sweep itself (Step 15).
 */
export function computeNextScanAt(
  frequency: MonitoringFrequency,
  from: Date = new Date(),
): string | null {
  if (frequency === "none") return null;
  const days = frequency === "weekly" ? 7 : 30;
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}
