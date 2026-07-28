import * as RadixSelect from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cx } from "../cx";

export type SelectOption = { value: string; label: string };

export type SelectProps = {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  name?: string;
  id?: string;
  /**
   * Required unless the trigger is already associated with a visible
   * `<label htmlFor>` (e.g. via `FormField`). Radix's Select.Trigger has no
   * accessible name of its own before a value is chosen — without one of
   * these two, screen reader users get an unlabelled control (confirmed by
   * axe-core: WCAG 2.2 AA `button-name`, critical impact).
   */
  ariaLabel?: string;
};

/** SRS §10.53. Native-feeling select with full keyboard support via Radix. */
export function Select({ options, placeholder, id, ariaLabel, ...props }: SelectProps) {
  return (
    <RadixSelect.Root {...props}>
      <RadixSelect.Trigger
        id={id}
        aria-label={ariaLabel}
        className={cx(
          "flex h-11 w-full items-center justify-between gap-2 rounded-control border border-neutral-300 bg-white px-3 text-body text-neutral-950",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
          "disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500",
        )}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronDown className="size-4 text-neutral-500" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          className="z-dropdown overflow-hidden rounded-card border border-neutral-200 bg-white shadow-elevated"
          position="popper"
          sideOffset={4}
        >
          <RadixSelect.Viewport className="p-1">
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                className={cx(
                  "flex cursor-pointer items-center justify-between gap-2 rounded-[6px] px-3 py-2 text-body text-neutral-800 outline-none",
                  "data-[highlighted]:bg-brand-50 data-[highlighted]:text-brand-800",
                )}
              >
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator>
                  <Check className="size-4 text-brand-600" />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
