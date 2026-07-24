import * as RadixRadioGroup from "@radix-ui/react-radio-group";
import { cx } from "../cx";

export type RadioOption = { value: string; label: string; description?: string };

export type RadioGroupProps = RadixRadioGroup.RadioGroupProps & {
  options: RadioOption[];
  legend: string;
};

/** SRS §10.53. A labelled fieldset of mutually exclusive options. */
export function RadioGroup({ options, legend, className, ...props }: RadioGroupProps) {
  return (
    <RadixRadioGroup.Root
      className={cx("flex flex-col gap-2", className)}
      {...props}
      aria-label={legend}
    >
      {options.map((option) => (
        <div key={option.value} className="flex items-start gap-2">
          <RadixRadioGroup.Item
            value={option.value}
            id={`radio-${option.value}`}
            className={cx(
              "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-neutral-300 bg-white",
              "data-[state=checked]:border-brand-600",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
              "disabled:cursor-not-allowed disabled:bg-neutral-100",
            )}
          >
            <RadixRadioGroup.Indicator className="size-2.5 rounded-full bg-brand-600" />
          </RadixRadioGroup.Item>
          <label htmlFor={`radio-${option.value}`} className="flex flex-col">
            <span className="text-body text-neutral-800">{option.label}</span>
            {option.description && (
              <span className="text-supporting text-neutral-600">{option.description}</span>
            )}
          </label>
        </div>
      ))}
    </RadixRadioGroup.Root>
  );
}
