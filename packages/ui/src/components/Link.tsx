import { forwardRef } from "react";
import type { AnchorHTMLAttributes } from "react";
import { cx } from "../cx";

export type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: "default" | "muted";
};

/**
 * A styled `<a>` (SRS §9.23: "descriptive links"). This is intentionally a
 * plain anchor, not a router abstraction — Astro pages use native
 * navigation, so no client-side router wrapper is needed.
 */
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { variant = "default", className, children, ...props },
  ref,
) {
  return (
    <a
      ref={ref}
      className={cx(
        "underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 rounded-sm",
        variant === "default" ? "text-brand-700" : "text-neutral-600",
        className,
      )}
      {...props}
    >
      {children}
    </a>
  );
});
