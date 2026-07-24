export type DiffLine = { type: "added" | "removed" | "unchanged"; text: string };

/**
 * Builds the report's configuration diff (SRS §21, §10.28) from the
 * original robots.txt text plus a set of purely-additive recommended
 * lines (see recommendations.ts for why additions are always appended,
 * never edited in place).
 */
export function buildRobotsDiff(originalText: string, proposedAdditions: string[]): DiffLine[] {
  const originalLines = originalText.length > 0 ? originalText.split(/\r\n|\r|\n/) : [];
  const unchanged: DiffLine[] = originalLines.map((text) => ({ type: "unchanged", text }));
  const added: DiffLine[] = proposedAdditions.map((text) => ({ type: "added", text }));
  return [...unchanged, ...added];
}

export function fullProposedText(originalText: string, proposedAdditions: string[]): string {
  if (proposedAdditions.length === 0) return originalText;
  const separator = originalText.endsWith("\n") || originalText.length === 0 ? "" : "\n";
  return `${originalText}${separator}\n${proposedAdditions.join("\n")}\n`;
}

export function addedLinesOnly(proposedAdditions: string[]): string {
  return proposedAdditions.join("\n");
}
