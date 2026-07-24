import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "../cx";
import type { StatusTone } from "./StatusChip";

export type AlertProps = {
  tone: StatusTone;
  title: string;
  children?: ReactNode;
};

const ICONS: Record<StatusTone, typeof Info> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertTriangle,
  critical: OctagonAlert,
  info: Info,
  unknown: Info,
};

const TONE_CLASSES: Record<StatusTone, string> = {
  success: "border-success/30 bg-success-bg text-success",
  warning: "border-warning/30 bg-warning-bg text-warning",
  error: "border-error/30 bg-error-bg text-error",
  critical: "border-critical/30 bg-critical-bg text-critical",
  info: "border-info/30 bg-info-bg text-info",
  unknown: "border-unknown/30 bg-unknown-bg text-unknown",
};

/** SRS §10.26: inline explanatory alert, never using flashing/aggressive animation for critical tone. */
export function Alert({ tone, title, children }: AlertProps) {
  const Icon = ICONS[tone];
  return (
    <div
      role={tone === "error" || tone === "critical" ? "alert" : "status"}
      className={cx("flex gap-3 rounded-card border p-4", TONE_CLASSES[tone])}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div className="text-body">
        <p className="font-medium">{title}</p>
        {children && <div className="mt-1 text-neutral-700">{children}</div>}
      </div>
    </div>
  );
}
