import { cx } from "../cx";

export type SkeletonProps = { className?: string; "aria-label"?: string };

/** SRS §10.33. A non-decorative loading placeholder; respects prefers-reduced-motion globally. */
export function Skeleton({ className, "aria-label": ariaLabel = "Loading" }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label={ariaLabel}
      className={cx("animate-pulse rounded-control bg-neutral-100", className)}
    />
  );
}
