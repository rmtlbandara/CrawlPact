import type { ReactNode } from "react";
import { cx } from "../cx";
import { Card } from "./Card";

export type MetricCardProps = {
  label: string;
  value: ReactNode;
  trend?: { direction: "up" | "down" | "flat"; label: string };
  helpText?: string;
};

/** SRS §10.19, §10.30. A single at-a-glance number with optional trend context. */
export function MetricCard({ label, value, trend, helpText }: MetricCardProps) {
  return (
    <Card>
      <p className="text-supporting font-medium text-neutral-600">{label}</p>
      <p className="mt-1 text-h1 text-neutral-950">{value}</p>
      {trend && (
        <p
          className={cx(
            "mt-1 text-supporting font-medium",
            trend.direction === "up" && "text-success",
            trend.direction === "down" && "text-error",
            trend.direction === "flat" && "text-neutral-600",
          )}
        >
          {trend.label}
        </p>
      )}
      {helpText && <p className="mt-1 text-supporting text-neutral-500">{helpText}</p>}
    </Card>
  );
}
