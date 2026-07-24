import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "../cx";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 focus-visible:outline-brand-600 disabled:bg-neutral-200 disabled:text-neutral-500",
  secondary:
    "bg-white text-neutral-800 border border-neutral-300 hover:bg-neutral-50 active:bg-neutral-100 focus-visible:outline-brand-600 disabled:text-neutral-400 disabled:border-neutral-200",
  tertiary:
    "bg-transparent text-brand-700 hover:bg-brand-50 active:bg-brand-100 focus-visible:outline-brand-600 disabled:text-neutral-400",
  destructive:
    "bg-error text-white hover:bg-[#962015] active:bg-[#7a1a11] focus-visible:outline-error disabled:bg-neutral-200 disabled:text-neutral-500",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-supporting gap-1.5",
  md: "h-11 px-4 text-body gap-2",
  lg: "h-12 px-5 text-body-lg gap-2",
};

/**
 * Primary interactive control (SRS §10.20). Use exactly one `primary`
 * button per view for the main action. Never disable a button without
 * explaining why elsewhere in the UI (e.g. a helper string) — a disabled
 * button with no explanation is a UX dead end.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    isLoading = false,
    leadingIcon,
    trailingIcon,
    className,
    children,
    disabled,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={props.type ?? "button"}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={cx(
        "inline-flex items-center justify-center rounded-control font-medium transition-colors",
        "duration-quick ease-standard focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    >
      {isLoading ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : (
        leadingIcon
      )}
      {children}
      {!isLoading && trailingIcon}
    </button>
  );
});
