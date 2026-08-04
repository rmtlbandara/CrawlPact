import { useState } from "react";
import type {
  AgencyBranding,
  AuditReportResponse,
  AuditStatus,
  LlmsTxtSignal,
} from "@crawlpact/core";
import { Alert, DiffViewer, ProvenanceHeader, ScoreComponent, StatusChip } from "@crawlpact/ui";
import type { StatusTone } from "@crawlpact/ui";

const STATUS_TONE: Record<AuditStatus, StatusTone> = {
  queued: "info",
  running: "info",
  completed: "success",
  completed_with_warnings: "warning",
  incomplete: "unknown",
  target_unavailable: "error",
  blocked_for_safety: "error",
  rate_limited: "warning",
  internal_failure: "error",
  engine_disabled: "unknown",
};

const STATUS_LABEL: Record<AuditStatus, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Complete",
  completed_with_warnings: "Complete with warnings",
  incomplete: "Incomplete",
  target_unavailable: "Target unavailable",
  blocked_for_safety: "Blocked for safety",
  rate_limited: "Rate limited",
  internal_failure: "Internal error",
  engine_disabled: "Engine disabled",
};

const RESULT_TONE: Record<string, StatusTone> = {
  allowed: "success",
  blocked: "error",
  no_explicit_rule: "warning",
  mixed: "warning",
  unknown: "unknown",
  resource_unavailable: "unknown",
  not_evaluated: "unknown",
};

const RESULT_LABEL: Record<string, string> = {
  allowed: "Allowed",
  blocked: "Blocked",
  no_explicit_rule: "No explicit rule",
  mixed: "Mixed",
  unknown: "Unknown",
  resource_unavailable: "Resource unavailable",
  not_evaluated: "Not evaluated",
};

const SEVERITY_TONE: Record<string, StatusTone> = {
  critical: "critical",
  high: "error",
  medium: "warning",
  low: "info",
  information: "unknown",
};

/** Which tool a visitor arrived from — reorders sections so the relevant
 * real result leads, without hiding anything else the same real scan found. */
export type ReportFocus = "crawlers" | "robots" | "llms" | "rsl" | "content-signals";

const SECTION_ORDER: Record<ReportFocus, string[]> = {
  crawlers: ["crawlers", "findings", "recommendation", "llms", "rsl", "content-signals"],
  robots: ["findings", "recommendation", "crawlers", "llms", "rsl", "content-signals"],
  llms: ["llms", "crawlers", "findings", "recommendation", "rsl", "content-signals"],
  rsl: ["rsl", "crawlers", "findings", "recommendation", "llms", "content-signals"],
  "content-signals": ["content-signals", "crawlers", "findings", "recommendation", "llms", "rsl"],
};
const DEFAULT_ORDER = ["crawlers", "findings", "recommendation", "llms", "rsl", "content-signals"];

function LlmsTxtBlock({
  label,
  path,
  signal,
}: {
  label: string;
  path: string;
  signal: LlmsTxtSignal;
}) {
  return (
    <div>
      <h3 className="text-card-heading text-neutral-950">
        {label} <span className="font-mono text-supporting text-neutral-500">{path}</span>
      </h3>
      {!signal.checked ? (
        <p className="mt-1 text-body text-neutral-600">Could not be checked for this scan.</p>
      ) : !signal.found ? (
        <p className="mt-1 text-body text-neutral-600">
          No <code>{path}</code> file was found. This is informational — the file is optional.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1 text-body text-neutral-700">
          <li>Size: {signal.sizeBytes.toLocaleString()} bytes</li>
          <li>Top-level Markdown heading: {signal.hasH1Heading ? "Present" : "Missing"}</li>
          <li>Linked resources found: {signal.linkedResources.length}</li>
        </ul>
      )}
      {signal.issues.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-supporting text-neutral-600">
          {signal.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Renders a completed audit report (SRS §23). This is a real report built
 * from persisted D1 rows via `apps/web/src/lib/get-scan-report.ts` — it is
 * never shown for a scan that didn't actually run (see the surrounding
 * page's 404 handling for an unknown auditId). `focus` only reorders
 * sections for the free-tool entry points (SRS §30); it never hides a real
 * result — every section below reflects the same one real scan.
 */
export function AuditReportView({
  report,
  proposedRobotsText,
  diffLines,
  agencyBranding,
  focus,
}: {
  report: AuditReportResponse;
  proposedRobotsText: string | null;
  diffLines: Array<{ type: "added" | "removed" | "unchanged"; text: string }> | null;
  agencyBranding?: AgencyBranding | null;
  focus?: ReportFocus;
}) {
  const [copied, setCopied] = useState(false);

  const sections: Record<string, React.ReactNode> = {
    crawlers: (
      <section key="crawlers">
        <h2 className="text-h3 text-neutral-950">Crawler access matrix</h2>
        {/* A scrollable region must itself be keyboard-focusable (WCAG 2.1.1;
            axe-core's "scrollable-region-focusable" rule) even though `role="region"`
            isn't in jsx-a11y's interactive-role list — see packages/ui/src/components/DataTable.tsx
            for the same documented pattern. */}
        <div
          className="mt-4 overflow-x-auto rounded-card border border-neutral-200"
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          role="region"
          aria-label="Crawler access matrix table"
        >
          <table className="w-full text-left text-body">
            <thead className="bg-neutral-50 text-supporting font-medium text-neutral-600">
              <tr>
                <th className="px-4 py-3">Crawler</th>
                <th className="px-4 py-3">Operator</th>
                <th className="px-4 py-3">Purpose</th>
                <th className="px-4 py-3">Result</th>
                <th className="px-4 py-3">Matched rule</th>
                <th className="px-4 py-3">Line</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {report.crawlerMatrix.map((row) => (
                <tr key={row.crawlerId}>
                  <td className="px-4 py-3 font-medium text-neutral-900">{row.crawlerName}</td>
                  <td className="px-4 py-3 text-neutral-700">{row.operator}</td>
                  <td className="px-4 py-3 text-neutral-700">{row.purpose.replace("_", " ")}</td>
                  <td className="px-4 py-3">
                    <StatusChip
                      tone={RESULT_TONE[row.result] ?? "unknown"}
                      label={RESULT_LABEL[row.result] ?? row.result}
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-supporting text-neutral-600">
                    {row.matchedRule ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-supporting text-neutral-600">
                    {row.matchedLineNumber ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    ),

    findings: (
      <section key="findings">
        <h2 className="text-h3 text-neutral-950">Findings</h2>
        {report.findings.length === 0 ? (
          <p className="mt-3 text-body text-neutral-600">
            No conflicts were detected against the selected preset.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {report.findings.map((finding) => (
              <Alert
                key={finding.code + finding.evidenceSummary}
                tone={SEVERITY_TONE[finding.severity] ?? "info"}
                title={finding.title}
              >
                <p>{finding.whatHappened}</p>
                <p className="mt-1 font-medium">Why it matters: {finding.whyItMatters}</p>
                <p className="mt-1">Recommended action: {finding.recommendedAction}</p>
                {finding.limitation && <p className="mt-1 text-supporting">{finding.limitation}</p>}
              </Alert>
            ))}
          </div>
        )}
      </section>
    ),

    recommendation: diffLines && diffLines.some((line) => line.type === "added") && (
      <section key="recommendation">
        <h2 className="text-h3 text-neutral-950">Recommended configuration</h2>
        <p className="mt-2 text-body text-neutral-700">
          Copyable additions to your robots.txt. CrawlPact never modifies your website directly.
        </p>
        <div className="mt-4">
          <DiffViewer lines={diffLines} />
        </div>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(proposedRobotsText ?? "");
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="no-print mt-3 rounded-control border border-neutral-300 px-4 py-2 text-body font-medium text-neutral-800 hover:bg-neutral-50"
        >
          {copied ? "Copied" : "Copy full proposed robots.txt"}
        </button>
      </section>
    ),

    llms: (
      <section key="llms">
        <h2 className="text-h3 text-neutral-950">llms.txt</h2>
        <div className="mt-4 flex flex-col gap-5 rounded-card border border-neutral-200 bg-white p-5">
          <LlmsTxtBlock label="llms.txt" path="/llms.txt" signal={report.llmsTxt} />
          <LlmsTxtBlock label="llms-full.txt" path="/llms-full.txt" signal={report.llmsFullTxt} />
        </div>
      </section>
    ),

    rsl: (
      <section key="rsl">
        <h2 className="text-h3 text-neutral-950">RSL (Really Simple Licensing)</h2>
        <div className="mt-4 rounded-card border border-neutral-200 bg-white p-5">
          {!report.rsl.checked ? (
            <p className="text-body text-neutral-600">Could not be checked for this scan.</p>
          ) : !report.rsl.discovered ? (
            <p className="text-body text-neutral-600">
              No RSL declaration was found at <code>/.well-known/rsl.xml</code>. This is
              informational — RSL is optional and emerging.
            </p>
          ) : (
            <div className="flex flex-col gap-3 text-body text-neutral-700">
              <p>
                Permits:{" "}
                {report.rsl.permits.length > 0 ? report.rsl.permits.join(", ") : "none declared"}
              </p>
              <p>
                Prohibits:{" "}
                {report.rsl.prohibits.length > 0
                  ? report.rsl.prohibits.join(", ")
                  : "none declared"}
              </p>
              <p>
                Payment terms:{" "}
                {report.rsl.paymentTerms.length > 0
                  ? report.rsl.paymentTerms.join(", ")
                  : "none declared"}
              </p>
              {report.rsl.unsupportedElements.length > 0 && (
                <p className="text-supporting text-neutral-500">
                  Additional, unrecognised elements were present:{" "}
                  {report.rsl.unsupportedElements.join(", ")}
                </p>
              )}
            </div>
          )}
          {report.rsl.issues.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-supporting text-neutral-600">
              {report.rsl.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-supporting text-neutral-500">
            RSL is a machine-readable declaration, not technical enforcement — see{" "}
            <a href="/limitations" className="text-brand-700 underline underline-offset-2">
              limitations
            </a>
            .
          </p>
        </div>
      </section>
    ),

    "content-signals": (
      <section key="content-signals">
        <h2 className="text-h3 text-neutral-950">Content Signals</h2>
        <div className="mt-4 flex flex-col gap-5 rounded-card border border-neutral-200 bg-white p-5">
          <div>
            {!report.contentSignals.checked ? (
              <p className="text-body text-neutral-600">Could not be checked for this scan.</p>
            ) : !report.contentSignals.present ? (
              <p className="text-body text-neutral-600">
                No <code>Content-Signal</code> response header was present on the homepage. This is
                informational — Content Signals is an emerging, optional convention.
              </p>
            ) : (
              <ul className="flex flex-col gap-1 text-body text-neutral-700">
                {Object.entries(report.contentSignals.recognised).map(([key, value]) => (
                  <li key={key}>
                    <span className="font-mono">{key}</span>: {value}
                  </li>
                ))}
                {Object.keys(report.contentSignals.unknownFields).length > 0 && (
                  <li className="text-supporting text-neutral-500">
                    Unrecognised fields:{" "}
                    {Object.entries(report.contentSignals.unknownFields)
                      .map(([k, v]) => `${k}=${v}`)
                      .join(", ")}
                  </li>
                )}
              </ul>
            )}
          </div>
          <div>
            <h3 className="text-card-heading text-neutral-950">Related directives</h3>
            <ul className="mt-2 flex flex-col gap-1 text-body text-neutral-700">
              <li>
                Meta robots tag:{" "}
                {report.robotsMeta.checked
                  ? (report.robotsMeta.metaRobots ?? "not present")
                  : "could not be checked"}
              </li>
              <li>
                X-Robots-Tag header:{" "}
                {report.robotsMeta.xRobotsTag.length > 0
                  ? report.robotsMeta.xRobotsTag.join(", ")
                  : "not present"}
              </li>
              <li>Canonical URL: {report.robotsMeta.canonicalUrl ?? "not present"}</li>
            </ul>
          </div>
        </div>
      </section>
    ),
  };

  const order = (focus && SECTION_ORDER[focus]) || DEFAULT_ORDER;

  return (
    <div className="flex flex-col gap-8">
      {agencyBranding && (
        <section className="rounded-panel border border-neutral-200 bg-neutral-50 p-6">
          <div className="flex flex-wrap items-center gap-4">
            {agencyBranding.logoUrl && (
              <img
                src={agencyBranding.logoUrl}
                alt={agencyBranding.agencyName ?? "Agency logo"}
                className="h-10 max-w-[200px] object-contain"
              />
            )}
            <div>
              {agencyBranding.agencyName && (
                <p className="text-h3 text-neutral-950">{agencyBranding.agencyName}</p>
              )}
              {agencyBranding.clientName && (
                <p className="text-supporting text-neutral-600">
                  Prepared for {agencyBranding.clientName}
                </p>
              )}
            </div>
          </div>
          {agencyBranding.introText && (
            <p className="mt-4 text-body text-neutral-700">{agencyBranding.introText}</p>
          )}
          <p className="mt-3 text-supporting text-neutral-500">
            This report was generated by CrawlPact and is shown here with additional branding added
            by the sender. The methodology, evidence, and limitations below are produced by
            CrawlPact and are unaffected by that branding.
          </p>
        </section>
      )}

      <section className="rounded-panel border border-neutral-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4">
          <div className="flex items-center gap-2">
            <svg
              viewBox="0 0 32 32"
              fill="none"
              aria-hidden="true"
              className="size-6 shrink-0 text-brand-600"
            >
              <path
                d="M21 9h-8a4 4 0 0 0-4 4v6a4 4 0 0 0 4 4h8"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <path d="M12 16h11" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              <rect x="23.2" y="14.4" width="3.2" height="3.2" rx="0.8" fill="currentColor" />
            </svg>
            <h1 className="text-h2 text-neutral-950">AI crawler policy report</h1>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="no-print rounded-control border border-neutral-300 px-3 py-1.5 text-supporting font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Print report
          </button>
        </div>
        <ProvenanceHeader
          domain={report.domain}
          reportState={{ tone: STATUS_TONE[report.status], label: STATUS_LABEL[report.status] }}
          fields={[
            { label: "Scan time", value: new Date(report.scanDate).toLocaleString() },
            { label: "Registry version", value: report.registryVersion },
            { label: "Ruleset version", value: report.rulesetVersion },
            { label: "Preset", value: report.preset },
          ]}
        />
        <div className="mt-5 max-w-sm">
          <ScoreComponent
            score={report.score}
            categoryBreakdown={
              report.score.state === "scored" ? report.score.categoryBreakdown : undefined
            }
            methodologyHref="/scoring"
          />
        </div>
      </section>

      {order.map((key) => sections[key])}

      <section>
        <h2 className="text-h3 text-neutral-950">Limitations</h2>
        <ul className="mt-3 list-disc pl-5 text-body text-neutral-700">
          {report.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
