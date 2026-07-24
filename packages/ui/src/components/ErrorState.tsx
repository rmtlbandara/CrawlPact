import type { ReactNode } from "react";

export type ErrorStateProps = {
  title: string;
  description: string;
  actions?: ReactNode;
  technicalDetails?: string;
};

/** SRS §10.35: plain-language explanation first, technical detail only on demand. */
export function ErrorState({ title, description, actions, technicalDetails }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-card border border-neutral-200 px-6 py-12 text-center"
    >
      <h3 className="text-h3 text-neutral-900">{title}</h3>
      <p className="max-w-md text-body text-neutral-600">{description}</p>
      {actions}
      {technicalDetails && (
        <details className="mt-2 w-full max-w-lg text-left">
          <summary className="cursor-pointer text-supporting text-neutral-500">
            View technical details
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-control bg-neutral-100 p-3 text-code text-neutral-700">
            {technicalDetails}
          </pre>
        </details>
      )}
    </div>
  );
}
