export type DiffLine = { type: "added" | "removed" | "unchanged"; text: string };

export type DiffViewerProps = {
  lines: DiffLine[];
  className?: string;
};

/**
 * Configuration-diff foundation (SRS §10.28). Additions/removals are marked
 * with both colour AND a leading `+`/`-` glyph plus an `aria-label`, so
 * meaning survives without colour perception (SRS §10.28: "Additions shall
 * not rely only on green... Removals shall not rely only on red").
 */
export function DiffViewer({ lines, className }: DiffViewerProps) {
  return (
    <pre
      className={`overflow-x-auto rounded-card border border-neutral-200 bg-neutral-50 p-3 text-code ${className ?? ""}`}
    >
      <code>
        {lines.map((line, index) => {
          const prefix = line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";
          const label =
            line.type === "added" ? "Added" : line.type === "removed" ? "Removed" : "Unchanged";
          return (
            <div
              key={index}
              aria-label={`${label}: ${line.text}`}
              className={
                line.type === "added"
                  ? "bg-success-bg text-success"
                  : line.type === "removed"
                    ? "bg-error-bg text-error"
                    : "text-neutral-700"
              }
            >
              <span aria-hidden="true" className="mr-2 select-none font-bold">
                {prefix}
              </span>
              {line.text || " "}
            </div>
          );
        })}
      </code>
    </pre>
  );
}
