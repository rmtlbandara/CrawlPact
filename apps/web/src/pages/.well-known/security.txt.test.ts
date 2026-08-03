import { describe, expect, it } from "vitest";
import { GET } from "./security.txt";
import { TRUST_CONFIG } from "../../lib/trust-config";

describe("/.well-known/security.txt", () => {
  const site = new URL("https://crawlpact.com");
  // @ts-expect-error - only `site` is used by this handler.
  const response = GET({ site });
  const bodyPromise = response instanceof Response ? response.text() : Promise.resolve("");

  it("returns text/plain", () => {
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("Content-Type")).toContain("text/plain");
  });

  it("includes every required RFC 9116 field with the approved values", async () => {
    const body = await bodyPromise;
    expect(body).toContain(`Contact: mailto:${TRUST_CONFIG.securityContact}`);
    expect(body).toContain("Canonical: https://crawlpact.com/.well-known/security.txt");
    expect(body).toContain("Policy: https://crawlpact.com/security");
    expect(body).toContain("Preferred-Languages: en");
    expect(body).toContain(`Expires: ${TRUST_CONFIG.securityTxtExpiry}`);
  });

  it("has a future Expires date", async () => {
    const body = await bodyPromise;
    const match = body.match(/Expires: (.+)/);
    expect(match).not.toBeNull();
    expect(new Date(match![1]).getTime()).toBeGreaterThan(Date.now());
  });
});
