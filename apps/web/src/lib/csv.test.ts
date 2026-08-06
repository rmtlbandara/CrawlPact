import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "./csv";

describe("toCsv", () => {
  it("neutralises formula-trigger characters at the start of a field", () => {
    const csv = toCsv(["name"], [["=cmd|'/c calc'!A1"]]);
    expect(csv).toContain("'=cmd|");
    expect(csv.startsWith("name")).toBe(true);
  });

  it("neutralises +, -, @, tab, and carriage-return triggers", () => {
    for (const trigger of ["+1+1", "-1+1", "@SUM(A1)", "\tevil", "\revil"]) {
      const csv = toCsv(["field"], [[trigger]]);
      expect(csv).toContain(`'${trigger}`);
    }
  });

  it("does not alter a field starting with an ordinary character", () => {
    const csv = toCsv(["name"], [["example.com"]]);
    expect(csv).toContain("example.com");
    expect(csv).not.toContain("'example.com");
  });

  it("quotes fields containing commas, quotes, or newlines per RFC 4180", () => {
    const csv = toCsv(["name"], [['Say "hi", please']]);
    expect(csv).toContain('"Say ""hi"", please"');
  });

  it("renders null cells as empty strings", () => {
    const csv = toCsv(["a", "b"], [["x", null]]);
    expect(csv).toContain("x,\r\n");
  });
});

describe("parseCsv", () => {
  it("parses a simple header + rows file", () => {
    const result = parseCsv("domain,display_name\r\nexample.com,Example\r\nother.com,Other\r\n");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.headers).toEqual(["domain", "display_name"]);
    expect(result.rows).toEqual([
      ["example.com", "Example"],
      ["other.com", "Other"],
    ]);
  });

  it("handles bare LF line endings", () => {
    const result = parseCsv("domain\nexample.com\nother.com");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toEqual([["example.com"], ["other.com"]]);
  });

  it("handles quoted fields with embedded commas and newlines", () => {
    const result = parseCsv('domain,notes\r\nexample.com,"Client, Inc.\nSecond line"\r\n');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toEqual([["example.com", "Client, Inc.\nSecond line"]]);
  });

  it("handles doubled-quote escaping inside a quoted field", () => {
    const result = parseCsv('domain,notes\r\nexample.com,"Say ""hi"""\r\n');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toEqual([["example.com", 'Say "hi"']]);
  });

  it("lowercases and trims headers", () => {
    const result = parseCsv(" Domain , Display Name \r\nexample.com,Example\r\n");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.headers).toEqual(["domain", "display name"]);
  });

  it("rejects an empty file", () => {
    expect(parseCsv("")).toEqual({ ok: false, error: "empty_file" });
    expect(parseCsv("   \n  ")).toEqual({ ok: false, error: "empty_file" });
  });

  it("rejects unterminated quoted fields", () => {
    expect(parseCsv('domain\r\n"example.com\r\n')).toEqual({
      ok: false,
      error: "malformed_quoting",
    });
  });

  it("rejects more than the maximum number of data rows", () => {
    const rows = Array.from({ length: 102 }, (_, i) => `example${i}.com`).join("\n");
    const result = parseCsv(`domain\n${rows}\n`);
    expect(result).toEqual({ ok: false, error: "too_many_rows" });
  });

  it("rejects more than the maximum number of columns", () => {
    const header = Array.from({ length: 11 }, (_, i) => `col${i}`).join(",");
    expect(parseCsv(`${header}\n`)).toEqual({ ok: false, error: "too_many_columns" });
  });

  it("rejects a field longer than the parser's hard safety bound", () => {
    const longField = "a".repeat(4001);
    expect(parseCsv(`domain\r\n${longField}\r\n`)).toEqual({
      ok: false,
      error: "field_too_long",
    });
  });

  it("does not execute or lose formula-like field content", () => {
    const result = parseCsv("domain,display_name\r\nexample.com,\"=cmd|'/c calc'!A1\"\r\n");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0]?.[1]).toBe("=cmd|'/c calc'!A1");
  });
});
