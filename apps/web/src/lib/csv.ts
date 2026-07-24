/**
 * Minimal CSV writer with formula-injection prevention (SRS §33, Part 2
 * Step 19; OWASP "CSV Injection"). Any cell whose *first* character is one
 * a spreadsheet application treats as a formula trigger (`=`, `+`, `-`,
 * `@`, tab, or carriage return) gets a leading `'` — Excel/Sheets then
 * render it as literal text instead of evaluating it. This matters because
 * every field exported here (domain display names, notes) is user-
 * controlled input, not a hard-coded value.
 */
const FORMULA_TRIGGER_CHARS = new Set(["=", "+", "-", "@", "\t", "\r"]);

function escapeCsvField(value: string): string {
  let field = value;
  if (field.length > 0 && FORMULA_TRIGGER_CHARS.has(field[0]!)) {
    field = `'${field}`;
  }
  if (/[",\n\r]/.test(field)) {
    field = `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const lines = [headers.map(escapeCsvField).join(",")];
  for (const row of rows) {
    lines.push(row.map((cell) => escapeCsvField(cell === null ? "" : String(cell))).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
