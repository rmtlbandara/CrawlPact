import * as RadixCheckbox from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cx } from "../cx";

export type CheckboxProps = RadixCheckbox.CheckboxProps & {
  label: string;
};

/** SRS §10.53. Radix supplies the checked/indeterminate/keyboard behaviour. */
export function Checkbox({ label, className, id, ...props }: CheckboxProps) {
  const inputId = id ?? `checkbox-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="flex items-center gap-2">
      <RadixCheckbox.Root
        id={inputId}
        className={cx(
          "flex size-5 items-center justify-center rounded-[4px] border border-neutral-300 bg-white",
          "data-[state=checked]:border-brand-600 data-[state=checked]:bg-brand-600",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
          "disabled:cursor-not-allowed disabled:bg-neutral-100",
          className,
        )}
        {...props}
      >
        <RadixCheckbox.Indicator>
          <Check className="size-3.5 text-white" strokeWidth={3} />
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>
      <label htmlFor={inputId} className="text-body text-neutral-800">
        {label}
      </label>
    </div>
  );
}
