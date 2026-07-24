import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

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
