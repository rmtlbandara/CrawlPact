import * as RadixSwitch from "@radix-ui/react-switch";
import { cx } from "../cx";

export type SwitchProps = RadixSwitch.SwitchProps & {
  label: string;
  description?: string;
};

export function Switch({ label, description, className, id, ...props }: SwitchProps) {
  const inputId = id ?? `switch-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={inputId} className="flex flex-col">
        <span className="text-body text-neutral-800">{label}</span>
        {description && <span className="text-supporting text-neutral-600">{description}</span>}
      </label>
      <RadixSwitch.Root
        id={inputId}
        className={cx(
          "relative h-6 w-11 shrink-0 rounded-pill bg-neutral-300 transition-colors duration-quick",
          "data-[state=checked]:bg-brand-600",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
          "disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        {...props}
      >
        <RadixSwitch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow-elevated transition-transform duration-quick data-[state=checked]:translate-x-[22px]" />
      </RadixSwitch.Root>
    </div>
  );
}
