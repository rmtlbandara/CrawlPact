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

/**
 * RFC 4180 CSV *reader*, hand-written for Phase 9 batch import
 * (docs/product/CSV_IMPORT_WORKFLOW.md) rather than adding a dependency —
 * this file is small (well under 100 lines including the writer above),
 * fully unit-tested, and has no Workers-runtime-compatibility question a
 * third-party package could raise. Handles quoted fields, embedded commas/
 * newlines, doubled-quote escaping (`""` -> `"`), and both `\r\n` and bare
 * `\n` line endings. A field is treated as quoted only when it *starts*
 * with `"` (the common, unambiguous case); this deliberately does not
 * attempt to recover from a stray unescaped quote mid-field beyond what
 * that simple rule implies — malformed input is reported as an error, not
 * guessed at.
 *
 * Bounds (row/column/field-length) are enforced during parsing itself, so
 * a hostile file is rejected before its full row set is ever built in
 * memory. File-size and UTF-8-validity checks happen at the caller (the
 * import route), since this function only ever sees an already-decoded
 * string.
 */
export const CSV_IMPORT_MAX_ROWS = 100;
export const CSV_IMPORT_MAX_COLUMNS = 10;
/**
 * A hard parser-level safety bound against pathological input (a single
 * absurdly long field), deliberately much larger than the 300-character
 * business-level limit `portfolio-import.ts` enforces per field
 * (`display_name`/`notes`) — that check needs to classify an over-length
 * *value* as one bad row among otherwise-valid ones, which only works if
 * this parser accepts the row at all. If both bounds were the same value,
 * the parser would reject the whole file before the row-level check ever
 * ran, turning a single-row content problem into a whole-file failure.
 */
export const CSV_IMPORT_MAX_FIELD_LENGTH = 4000;

export type CsvParseError =
  "empty_file" | "too_many_rows" | "too_many_columns" | "field_too_long" | "malformed_quoting";

export type ParsedCsv =
  { ok: true; headers: string[]; rows: string[][] } | { ok: false; error: CsvParseError };

class CsvBoundsError extends Error {
  constructor(public readonly code: CsvParseError) {
    super(code);
  }
}

export function parseCsv(text: string): ParsedCsv {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  let fieldStarted = false;

  const pushField = () => {
    if (field.length > CSV_IMPORT_MAX_FIELD_LENGTH) throw new CsvBoundsError("field_too_long");
    record.push(field);
    field = "";
    fieldStarted = false;
  };
  const pushRecord = () => {
    if (record.length > CSV_IMPORT_MAX_COLUMNS) throw new CsvBoundsError("too_many_columns");
    records.push(record);
    // +1 tolerates the header row itself; row limit applies to data rows.
    if (records.length > CSV_IMPORT_MAX_ROWS + 1) throw new CsvBoundsError("too_many_rows");
    record = [];
  };

  try {
    let i = 0;
    while (i < text.length) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i += 1;
          continue;
        }
        field += ch;
        i += 1;
        continue;
      }
      if (ch === '"' && !fieldStarted) {
        inQuotes = true;
        fieldStarted = true;
        i += 1;
        continue;
      }
      if (ch === ",") {
        pushField();
        i += 1;
        continue;
      }
      if (ch === "\r" || ch === "\n") {
        pushField();
        pushRecord();
        i += 1;
        if (ch === "\r" && text[i] === "\n") i += 1;
        continue;
      }
      field += ch;
      fieldStarted = true;
      i += 1;
    }
    if (inQuotes) return { ok: false, error: "malformed_quoting" };
    if (field.length > 0 || record.length > 0) {
      pushField();
      pushRecord();
    }
  } catch (error) {
    if (error instanceof CsvBoundsError) return { ok: false, error: error.code };
    throw error;
  }

  const nonEmpty = records.filter((r) => r.some((cell) => cell.trim().length > 0));
  if (nonEmpty.length === 0) return { ok: false, error: "empty_file" };

  const [headers, ...rows] = nonEmpty as [string[], ...string[][]];
  return { ok: true, headers: headers.map((h) => h.trim().toLowerCase()), rows };
}
