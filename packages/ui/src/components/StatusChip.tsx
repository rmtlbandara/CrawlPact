import type { ReactNode } from "react";
import { cx } from "../cx";

export type StatusTone = "success" | "warning" | "error" | "critical" | "info" | "unknown";

export type StatusChipProps = {
  tone: StatusTone;
  label: string;
  icon?: ReactNode;
  className?: string;
};

const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  error: "bg-error-bg text-error",
  critical: "bg-critical-bg text-critical",
  info: "bg-info-bg text-info",
  unknown: "bg-unknown-bg text-unknown",
};

/**
 * SRS §10.23. Status is never colour-only: every chip renders a text label
 * (and optionally an icon), so it remains meaningful without colour
 * perception and to screen readers.
 */
export function StatusChip({ tone, label, icon, className }: StatusChipProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-supporting font-medium",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {icon && (
        <span aria-hidden="true" className="[&>svg]:size-3.5">
          {icon}
        </span>
      )}
      {label}
    </span>
  );
}
