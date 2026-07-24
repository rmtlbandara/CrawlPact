import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { cx } from "../cx";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

/** SRS §10.21. Pair with `FormField` for the label/description/error wiring. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cx(
        "h-11 w-full rounded-control border border-neutral-300 bg-white px-3 text-body text-neutral-950",
        "placeholder:text-neutral-500",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
        "aria-[invalid=true]:border-error",
        "disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500",
        "read-only:bg-neutral-50",
        className,
      )}
      {...props}
    />
  );
});
