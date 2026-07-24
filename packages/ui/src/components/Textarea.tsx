import { forwardRef } from "react";
import type { TextareaHTMLAttributes } from "react";
import { cx } from "../cx";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cx(
        "min-h-24 w-full rounded-control border border-neutral-300 bg-white px-3 py-2 text-body text-neutral-950",
        "placeholder:text-neutral-500",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
        "aria-[invalid=true]:border-error",
        "disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500",
        className,
      )}
      {...props}
    />
  );
});
