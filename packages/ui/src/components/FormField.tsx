import { useId, cloneElement, isValidElement } from "react";
import type { ReactElement } from "react";
import { cx } from "../cx";

export type FormFieldProps = {
  label: string;
  description?: string;
  error?: string;
  success?: string;
  required?: boolean;
  children: ReactElement<{ id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean }>;
};

/**
 * SRS §10.21: "The interface shall never use placeholder text as the only
 * label." FormField always renders a persistent, associated `<label>`, plus
 * optional description/error/success text wired via `aria-describedby` so
 * assistive technology announces them together with the control.
 */
export function FormField({
  label,
  description,
  error,
  success,
  required,
  children,
}: FormFieldProps) {
  const inputId = useId();
  const descriptionId = useId();
  const messageId = useId();

  const describedBy =
    [description && descriptionId, (error || success) && messageId].filter(Boolean).join(" ") ||
    undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id: inputId,
        "aria-describedby": describedBy,
        "aria-invalid": Boolean(error) || undefined,
      })
    : children;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-supporting font-medium text-neutral-800">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-error">
            *
          </span>
        )}
      </label>
      {description && (
        <p id={descriptionId} className="text-supporting text-neutral-600">
          {description}
        </p>
      )}
      {control}
      {(error || success) && (
        <p
          id={messageId}
          role={error ? "alert" : undefined}
          className={cx("text-supporting", error ? "text-error" : "text-success")}
        >
          {error ?? success}
        </p>
      )}
    </div>
  );
}
