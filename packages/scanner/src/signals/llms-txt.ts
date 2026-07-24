/**
 * Bounded llms.txt / llms-full.txt validation (SRS §19.1). Absence is
 * informational, never critical — this module only runs when a fetch
 * already succeeded with a body.
 */
export type LlmsTxtResult = {
  hasH1Heading: boolean;
  linkedResources: string[];
  sizeBytes: number;
  issues: string[];
};

const MAX_LINKS = 50;

export function parseLlmsTxt(text: string): LlmsTxtResult {
  const issues: string[] = [];
  const sizeBytes = new TextEncoder().encode(text).byteLength;

  if (text.trim().length === 0) {
    issues.push("The file is empty.");
    return { hasH1Heading: false, linkedResources: [], sizeBytes, issues };
  }

  const hasH1Heading = /^#\s+\S/m.test(text.split("\n").slice(0, 5).join("\n"));
  if (!hasH1Heading) {
    issues.push("No top-level Markdown heading (# Title) found near the start of the file.");
  }

  const linkPattern = /\[([^\]]*)\]\(([^)]+)\)/g;
  const linkedResources: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(text)) !== null && linkedResources.length < MAX_LINKS) {
    linkedResources.push(match[2]!.trim());
  }

  return { hasH1Heading, linkedResources, sizeBytes, issues };
}
