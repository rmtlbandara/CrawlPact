import { ChevronLeft, ChevronRight } from "lucide-react";
import { cx } from "../cx";

export type PaginationProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
};

/** SRS §10.22. Simple previous/next + page-number pagination for tables. */
export function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1">
      <button
        type="button"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="flex size-9 items-center justify-center rounded-control text-neutral-600 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="px-3 text-supporting text-neutral-700" aria-live="polite">
        Page {page} of {pageCount}
      </span>
      <button
        type="button"
        aria-label="Next page"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
        className={cx(
          "flex size-9 items-center justify-center rounded-control text-neutral-600 hover:bg-neutral-100",
          "disabled:cursor-not-allowed disabled:text-neutral-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600",
        )}
      >
        <ChevronRight className="size-4" />
      </button>
    </nav>
  );
}
