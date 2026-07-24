/**
 * Minimal class-name joiner. Deliberately not a dependency (clsx/cva) per
 * ADR-0003 — this is the entire implementation this codebase needs.
 */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
