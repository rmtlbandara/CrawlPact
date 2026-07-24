import type { ReactNode } from "react";

export type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
};

/** SRS §10.34: every empty state explains what the section contains, why it's empty, and what to do. */
export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-neutral-300 px-6 py-12 text-center">
      {icon && (
        <div aria-hidden="true" className="text-neutral-400 [&>svg]:size-10">
          {icon}
        </div>
      )}
      <h3 className="text-h3 text-neutral-900">{title}</h3>
      <p className="max-w-sm text-body text-neutral-600">{description}</p>
      {action}
    </div>
  );
}
