import { describe, expect, it } from "vitest";
import { ApiError } from "./errors";
import { fail, ok } from "./envelope";

describe("envelope", () => {
  it("builds a success envelope", () => {
    const response = ok({ hello: "world" }, "req_1");
    expect(response).toEqual({ ok: true, data: { hello: "world" }, requestId: "req_1" });
  });

  it("builds a failure envelope from an ApiError", () => {
    const error = new ApiError("AUDIT_TARGET_UNSAFE", "Unsafe target", { host: "127.0.0.1" });
    const response = fail(error, "req_2");
    expect(response).toEqual({
      ok: false,
      error: {
        code: "AUDIT_TARGET_UNSAFE",
        message: "Unsafe target",
        requestId: "req_2",
        details: { host: "127.0.0.1" },
      },
    });
  });
});
