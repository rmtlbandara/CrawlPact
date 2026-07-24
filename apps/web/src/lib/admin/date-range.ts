export type DateRangePreset =
  "today" | "7d" | "30d" | "current_month" | "previous_month" | "current_year" | "custom";

export type DateRange = { from: string; to: string; preset: DateRangePreset };

/** SRS §28.2: resolves a dashboard date-range selection to ISO bounds. `to` is always
 * "now" except for `previous_month`, which is a closed historical window. */
export function resolveDateRange(
  preset: DateRangePreset,
  custom?: { from: string; to: string },
): DateRange {
  const now = new Date();
  const startOfDay = (d: Date) =>
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

  switch (preset) {
    case "today":
      return { preset, from: startOfDay(now).toISOString(), to: now.toISOString() };
    case "7d":
      return {
        preset,
        from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        to: now.toISOString(),
      };
    case "30d":
      return {
        preset,
        from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        to: now.toISOString(),
      };
    case "current_month":
      return {
        preset,
        from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString(),
        to: now.toISOString(),
      };
    case "previous_month": {
      const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      return { preset, from: from.toISOString(), to: to.toISOString() };
    }
    case "current_year":
      return {
        preset,
        from: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString(),
        to: now.toISOString(),
      };
    case "custom": {
      if (!custom) throw new Error("Custom date range requires from/to.");
      return { preset, from: custom.from, to: custom.to };
    }
  }
}

export const DATE_RANGE_LABELS: Record<DateRangePreset, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  current_month: "Current month",
  previous_month: "Previous month",
  current_year: "Current year",
  custom: "Custom range",
};
