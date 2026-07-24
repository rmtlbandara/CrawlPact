import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../cx";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  eyebrow?: string;
  title?: ReactNode;
  action?: ReactNode;
};

/** SRS §10.19. A bordered, minimally-shadowed container for meaningful grouping. */
export function Card({ eyebrow, title, action, className, children, ...props }: CardProps) {
  return (
    <div
      className={cx("rounded-card border border-neutral-200 bg-white p-5", className)}
      {...props}
    >
      {(eyebrow || title || action) && (
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            {eyebrow && (
              <p className="text-metadata font-medium uppercase tracking-wide text-neutral-500">
                {eyebrow}
              </p>
            )}
            {title && <h3 className="text-card-heading text-neutral-950">{title}</h3>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
