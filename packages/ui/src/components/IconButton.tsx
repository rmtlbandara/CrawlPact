import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "../cx";
import type { ButtonSize, ButtonVariant } from "./Button";

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: ReactNode;
  label: string; // required — an icon-only button has no other accessible name
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-12 w-12",
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-neutral-200 disabled:text-neutral-500",
  secondary:
    "bg-white text-neutral-700 border border-neutral-300 hover:bg-neutral-50 disabled:text-neutral-400",
  tertiary: "bg-transparent text-neutral-700 hover:bg-neutral-100 disabled:text-neutral-400",
  destructive:
    "bg-error text-white hover:bg-[#962015] disabled:bg-neutral-200 disabled:text-neutral-500",
};

/** Icon-only button (SRS §10.11). `label` becomes the accessible name via `aria-label`. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, variant = "tertiary", size = "md", className, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={props.type ?? "button"}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={cx(
        "inline-flex items-center justify-center rounded-control transition-colors duration-quick ease-standard",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
        "disabled:cursor-not-allowed",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className="[&>svg]:size-5">
        {icon}
      </span>
    </button>
  );
});
