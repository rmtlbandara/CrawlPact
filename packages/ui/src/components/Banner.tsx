import type { ReactNode } from "react";
import { cx } from "../cx";

export type BannerProps = {
  tone: "information" | "warning" | "critical";
  children: ReactNode;
  action?: ReactNode;
};

const TONE_CLASSES: Record<BannerProps["tone"], string> = {
  information: "bg-info-bg text-info",
  warning: "bg-warning-bg text-warning",
  critical: "bg-critical-bg text-critical",
};

/**
 * SRS §10.43: full-width site/app banner, e.g. environment indicator or
 * maintenance-mode notice. Persistent (not a toast) by design.
 */
export function Banner({ tone, children, action }: BannerProps) {
  return (
    <div
      role="status"
      className={cx(
        "flex w-full items-center justify-center gap-4 px-4 py-2 text-supporting font-medium",
        TONE_CLASSES[tone],
      )}
    >
      <span>{children}</span>
      {action}
    </div>
  );
}
