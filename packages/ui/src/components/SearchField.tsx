import { Search } from "lucide-react";
import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { cx } from "../cx";

export type SearchFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string; // visually hidden, but always present — no placeholder-only labelling
};

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { label, className, ...props },
  ref,
) {
  return (
    <div className={cx("relative", className)}>
      <label className="sr-only">{label}</label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500"
      />
      <input
        ref={ref}
        type="search"
        className={cx(
          "h-11 w-full rounded-control border border-neutral-300 bg-white pl-9 pr-3 text-body text-neutral-950",
          "placeholder:text-neutral-500",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
        )}
        {...props}
      />
    </div>
  );
});
