import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CSP_HEADER_VALUE,
  HSTS_VALUE,
  PERMISSIONS_POLICY_VALUE,
  REFERRER_POLICY_VALUE,
  X_CONTENT_TYPE_OPTIONS_VALUE,
  X_FRAME_OPTIONS_VALUE,
} from "./security-headers";

/**
 * `apps/web/public/_headers` is a static file Cloudflare reads directly for
 * prerendered routes — it can't import security-headers.ts, so this test is
 * the only thing keeping it from silently drifting away from what
 * middleware.ts actually sends on SSR routes. If this fails, update
 * `public/_headers` to match the shared constants (or vice versa,
 * deliberately, if the constants are the ones that changed).
 */
describe("public/_headers matches lib/security-headers.ts", () => {
  const headersFilePath = fileURLToPath(new URL("../../public/_headers", import.meta.url));
  const headersFileContent = readFileSync(headersFilePath, "utf-8");

  it("has the same Content-Security-Policy", () => {
    expect(headersFileContent).toContain(`Content-Security-Policy: ${CSP_HEADER_VALUE}`);
  });

  it("has the same X-Content-Type-Options", () => {
    expect(headersFileContent).toContain(`X-Content-Type-Options: ${X_CONTENT_TYPE_OPTIONS_VALUE}`);
  });

  it("has the same X-Frame-Options", () => {
    expect(headersFileContent).toContain(`X-Frame-Options: ${X_FRAME_OPTIONS_VALUE}`);
  });

  it("has the same Referrer-Policy", () => {
    expect(headersFileContent).toContain(`Referrer-Policy: ${REFERRER_POLICY_VALUE}`);
  });

  it("has the same Permissions-Policy", () => {
    expect(headersFileContent).toContain(`Permissions-Policy: ${PERMISSIONS_POLICY_VALUE}`);
  });

  it("has the same Strict-Transport-Security", () => {
    expect(headersFileContent).toContain(`Strict-Transport-Security: ${HSTS_VALUE}`);
  });
});
