import { Check } from "lucide-react";
import { cx } from "../cx";

export type ProgressStep = { id: string; label: string };

export type ProgressStepsProps = {
  steps: ProgressStep[];
  currentStepId: string | null;
  completedStepIds: string[];
};

/**
 * SRS §10.32: audit progress. Deliberately shows discrete named stages
 * rather than a fabricated percentage, since scan duration cannot be
 * predicted precisely (SRS §10.32: "shall not display a false exact
 * percentage if progress cannot be measured accurately").
 */
export function ProgressSteps({ steps, currentStepId, completedStepIds }: ProgressStepsProps) {
  return (
    <ol aria-label="Audit progress" className="flex flex-col gap-3">
      {steps.map((step) => {
        const isCompleted = completedStepIds.includes(step.id);
        const isCurrent = step.id === currentStepId;
        return (
          <li key={step.id} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={cx(
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-metadata font-medium",
                isCompleted && "border-success bg-success-bg text-success",
                isCurrent && !isCompleted && "border-brand-600 bg-brand-50 text-brand-700",
                !isCompleted && !isCurrent && "border-neutral-300 text-neutral-400",
              )}
            >
              {isCompleted ? <Check className="size-3.5" /> : ""}
            </span>
            <span
              className={cx(
                "text-body",
                isCurrent ? "font-medium text-neutral-900" : "text-neutral-600",
              )}
              aria-current={isCurrent ? "step" : undefined}
            >
              {step.label}
              {isCurrent && (
                <span
                  className="ml-2 inline-block size-1.5 animate-pulse rounded-full bg-brand-600"
                  aria-hidden="true"
                />
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
