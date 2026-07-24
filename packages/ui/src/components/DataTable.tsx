import type { ReactNode } from "react";
import { cx } from "../cx";
import { Skeleton } from "./Skeleton";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Hidden below this breakpoint to keep mobile tables scannable (SRS §10.22). */
  hideBelow?: "sm" | "md" | "lg";
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  isLoading?: boolean;
  error?: string;
  emptyTitle?: string;
  emptyDescription?: string;
};

const HIDE_CLASSES: Record<NonNullable<DataTableColumn<unknown>["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
};

/**
 * Data table foundation (SRS §10.22). Provides loading/empty/error states,
 * a sticky header, and responsive column hiding. Sorting/filtering/
 * virtualisation for specific tables (domains, registry, admin users, ...)
 * are built on top of this in later parts as each table's real data model
 * lands — this foundation intentionally does not invent placeholder sort
 * controls for columns with no real data behind them yet.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  isLoading,
  error,
  emptyTitle = "Nothing to show yet",
  emptyDescription = "No rows match the current view.",
}: DataTableProps<T>) {
  if (error) {
    return <ErrorState title="This table could not be loaded" description={error} />;
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    // A scrollable region must itself be keyboard-focusable (WCAG 2.1.1;
    // axe-core's "scrollable-region-focusable" rule) even though `role="region"`
    // isn't in jsx-a11y's interactive-role list — this is the correct,
    // documented pattern for exactly this case.
    <div
      className="overflow-x-auto rounded-card border border-neutral-200"
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      role="region"
      aria-label="Data table, scrollable horizontally"
    >
      <table className="w-full text-left text-body">
        <thead className="sticky top-0 bg-neutral-50 text-supporting font-medium text-neutral-600">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cx("px-4 py-3", column.hideBelow && HIDE_CLASSES[column.hideBelow])}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200">
          {rows.map((row) => (
            <tr key={getRowKey(row)} className="hover:bg-neutral-50">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cx(
                    "px-4 py-3 text-neutral-800",
                    column.hideBelow && HIDE_CLASSES[column.hideBelow],
                  )}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
