import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cx } from "../cx";

export type CodeBlockProps = {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  className?: string;
};

/** SRS §10.27: monospace, line numbers, copy action, horizontal scroll for long lines. */
export function CodeBlock({ code, language, showLineNumbers = true, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const lines = code.split("\n");

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-card border border-neutral-200 bg-neutral-950",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
        <span className="text-metadata text-neutral-400">{language ?? "text"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-[6px] px-2 py-1 text-metadata text-neutral-300 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {/* Scrollable region must be keyboard-focusable — see the matching comment in DataTable.tsx */}
      <pre
        className="overflow-x-auto p-3 text-code text-neutral-100"
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        role="region"
        aria-label={`${language ?? "text"} code, scrollable horizontally`}
      >
        <code>
          {lines.map((line, index) => (
            <div key={index} className="flex gap-4">
              {showLineNumbers && (
                <span aria-hidden="true" className="select-none text-neutral-500">
                  {index + 1}
                </span>
              )}
              <span>{line || " "}</span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}
