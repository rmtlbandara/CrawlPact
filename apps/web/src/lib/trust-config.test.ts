import { describe, expect, it } from "vitest";
import { TRUST_CONFIG } from "./trust-config";

describe("TRUST_CONFIG approved values", () => {
  it("has the approved operator name, with no corporate suffix", () => {
    expect(TRUST_CONFIG.legalEntityName).toBe("CrawlPact");
  });

  it("does not publish any operating country or jurisdiction", () => {
    expect(TRUST_CONFIG).not.toHaveProperty("governingJurisdiction");
    expect(JSON.stringify(TRUST_CONFIG)).not.toMatch(/sri lanka/i);
  });

  it("has the approved contact addresses", () => {
    expect(TRUST_CONFIG.privacyContact).toBe("info@crawlpact.com");
    expect(TRUST_CONFIG.securityContact).toBe("info@crawlpact.com");
    expect(TRUST_CONFIG.supportContact).toBe("support@crawlpact.com");
    expect(TRUST_CONFIG.correctionsContact).toBe("support@crawlpact.com");
    expect(TRUST_CONFIG.billingContact).toBe("support@crawlpact.com");
  });

  it("keeps registered address and registration number null (not approved for publication)", () => {
    expect(TRUST_CONFIG.registeredAddress).toBeNull();
    expect(TRUST_CONFIG.registrationNumber).toBeNull();
  });

  it("does not contain any placeholder value", () => {
    const values = JSON.stringify(TRUST_CONFIG);
    for (const placeholder of [
      "[Company Name]",
      "[Address]",
      "[Registration Number]",
      "[Jurisdiction]",
      "TODO",
      "example@example.com",
    ]) {
      expect(values).not.toContain(placeholder);
    }
  });

  it("has a future security.txt expiry", () => {
    expect(new Date(TRUST_CONFIG.securityTxtExpiry).getTime()).toBeGreaterThan(Date.now());
  });
});
