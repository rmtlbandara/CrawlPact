import { describe, expect, it } from "vitest";
import { buildImportPlan } from "./portfolio-import";

function csv(rows: string[]): string {
  return rows.join("\r\n") + "\r\n";
}

const baseContext = {
  ownedGroupIdByName: new Map<string, string>(),
  existingOrigins: new Set<string>(),
  remainingCapacity: 100,
  batchImportLimit: 100,
};

describe("buildImportPlan", () => {
  it("classifies a simple valid file", () => {
    const result = buildImportPlan(csv(["domain", "example.com", "other.com"]), baseContext);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.validRows).toBe(2);
    expect(result.plan.rows.every((r) => r.result === "created")).toBe(true);
  });

  it("rejects a file missing the domain column", () => {
    const result = buildImportPlan(csv(["display_name", "Example"]), baseContext);
    expect(result).toEqual({ ok: false, error: "missing_domain_column" });
  });

  it("classifies duplicates within the file", () => {
    const result = buildImportPlan(csv(["domain", "example.com", "example.com"]), baseContext);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.rows[0]?.result).toBe("created");
    expect(result.plan.rows[1]?.result).toBe("duplicate_in_file");
  });

  it("classifies normalised duplicates (different casing/scheme) within the file", () => {
    const result = buildImportPlan(
      csv(["domain", "https://Example.com/", "example.com"]),
      baseContext,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.rows[0]?.result).toBe("created");
    expect(result.plan.rows[1]?.result).toBe("duplicate_in_file");
  });

  it("classifies an already-saved domain", () => {
    const result = buildImportPlan(csv(["domain", "example.com"]), {
      ...baseContext,
      existingOrigins: new Set(["https://example.com"]),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.rows[0]?.result).toBe("already_saved");
  });

  it("classifies an invalid domain", () => {
    const result = buildImportPlan(csv(["domain", "not a domain!!"]), baseContext);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.rows[0]?.result).toBe("invalid_domain");
  });

  it("classifies a literal-IP target as a private target", () => {
    const result = buildImportPlan(csv(["domain", "http://127.0.0.1"]), baseContext);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.rows[0]?.result).toBe("private_target");
  });

  it("classifies an unknown group", () => {
    const result = buildImportPlan(csv(["domain,group", "example.com,Nonexistent"]), baseContext);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.rows[0]?.result).toBe("group_not_found");
  });

  it("resolves a known group case-insensitively", () => {
    const result = buildImportPlan(csv(["domain,group", "example.com,Docs"]), {
      ...baseContext,
      ownedGroupIdByName: new Map([["docs", "group-1"]]),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.rows[0]?.result).toBe("created");
    expect(result.plan.rows[0]?.resolvedGroupId).toBe("group-1");
  });

  it("classifies rows once remaining capacity is exhausted, preserving order", () => {
    const result = buildImportPlan(csv(["domain", "one.com", "two.com", "three.com"]), {
      ...baseContext,
      remainingCapacity: 2,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.rows.map((r) => r.result)).toEqual(["created", "created", "limit_exceeded"]);
  });

  it("rejects the whole file when it exceeds the batch import limit, not a silent subset", () => {
    const result = buildImportPlan(csv(["domain", "one.com", "two.com", "three.com"]), {
      ...baseContext,
      batchImportLimit: 2,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.rows.every((r) => r.result === "batch_limit_exceeded")).toBe(true);
    expect(result.plan.validRows).toBe(0);
  });

  it("classifies an over-length field", () => {
    const result = buildImportPlan(
      csv([`domain,notes`, `example.com,${"a".repeat(301)}`]),
      baseContext,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.rows[0]?.result).toBe("field_too_long");
  });

  it("reports unsupported columns without treating them as an error", () => {
    const result = buildImportPlan(
      csv(["domain,score,plan", "example.com,90,agency"]),
      baseContext,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.unsupportedColumns).toEqual(["score", "plan"]);
    expect(result.plan.rows[0]?.result).toBe("created");
  });

  it("does not execute formula-like display-name content — stores it as literal text", () => {
    const result = buildImportPlan(
      csv(["domain,display_name", "example.com,\"=cmd|'/c calc'!A1\""]),
      baseContext,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.rows[0]?.displayName).toBe("=cmd|'/c calc'!A1");
    expect(result.plan.rows[0]?.result).toBe("created");
  });

  it("parses the monitoring column as on/off, defaulting to null when absent", () => {
    const result = buildImportPlan(
      csv(["domain,monitoring", "on.com,on", "off.com,off", "unspecified.com,"]),
      baseContext,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.rows[0]?.monitoringRequested).toBe(true);
    expect(result.plan.rows[1]?.monitoringRequested).toBe(false);
    expect(result.plan.rows[2]?.monitoringRequested).toBeNull();
  });
});
