import { describe, expect, it } from "vitest";
import { validateTarget } from "./target-validation";
import type { DnsResolver } from "./dns-resolve";

function mockResolver(addresses: string[]): DnsResolver {
  return async () =>
    addresses.length > 0 ? { ok: true, addresses } : { ok: false, reason: "no_records" };
}

const failingResolver: DnsResolver = async () => ({ ok: false, reason: "resolver_error" });

describe("validateTarget", () => {
  it("accepts a target resolving to a public address", async () => {
    const result = await validateTarget("https://example.com", {
      resolver: mockResolver(["93.184.216.34"]),
    });
    expect(result).toEqual({
      safe: true,
      hostname: "example.com",
      resolvedAddresses: ["93.184.216.34"],
    });
  });

  it("rejects embedded credentials", async () => {
    const result = await validateTarget("https://user:pass@example.com", {
      resolver: mockResolver(["93.184.216.34"]),
    });
    expect(result).toMatchObject({ safe: false, reason: "embedded_credentials" });
  });

  it("rejects a non-default port", async () => {
    const result = await validateTarget("https://example.com:8443", {
      resolver: mockResolver(["93.184.216.34"]),
    });
    expect(result).toMatchObject({ safe: false, reason: "unsupported_port" });
  });

  it("accepts an explicit default port", async () => {
    const result = await validateTarget("https://example.com:443", {
      resolver: mockResolver(["93.184.216.34"]),
    });
    expect(result.safe).toBe(true);
  });

  it("rejects a target on the admin blocklist by exact hostname", async () => {
    const result = await validateTarget("https://evil.example", {
      resolver: mockResolver(["93.184.216.34"]),
      blocklist: ["evil.example"],
    });
    expect(result).toMatchObject({ safe: false, reason: "blocked_target" });
  });

  it("rejects a target on the admin blocklist by subdomain", async () => {
    const result = await validateTarget("https://sub.evil.example", {
      resolver: mockResolver(["93.184.216.34"]),
      blocklist: ["evil.example"],
    });
    expect(result).toMatchObject({ safe: false, reason: "blocked_target" });
  });

  it("does not block an unrelated domain that merely contains the blocklist string", async () => {
    const result = await validateTarget("https://notevil.example", {
      resolver: mockResolver(["93.184.216.34"]),
      blocklist: ["evil.example"],
    });
    expect(result.safe).toBe(true);
  });

  it("rejects when DNS resolution fails", async () => {
    const result = await validateTarget("https://nonexistent.example", {
      resolver: failingResolver,
    });
    expect(result).toMatchObject({ safe: false, reason: "dns_resolution_failed" });
  });

  it("rejects a hostname resolving to a private IPv4 address", async () => {
    const result = await validateTarget("https://internal.example", {
      resolver: mockResolver(["10.0.0.5"]),
    });
    expect(result).toMatchObject({ safe: false, reason: "unsafe_resolved_address" });
  });

  it("rejects a hostname resolving to the cloud metadata address", async () => {
    const result = await validateTarget("https://metadata.example", {
      resolver: mockResolver(["169.254.169.254"]),
    });
    expect(result).toMatchObject({ safe: false, reason: "unsafe_resolved_address" });
  });

  it("rejects a hostname resolving to a loopback IPv6 address", async () => {
    const result = await validateTarget("https://loop.example", {
      resolver: mockResolver(["::1"]),
    });
    expect(result).toMatchObject({ safe: false, reason: "unsafe_resolved_address" });
  });

  it("rejects when ANY resolved address (of multiple) is unsafe", async () => {
    const result = await validateTarget("https://multi.example", {
      resolver: mockResolver(["93.184.216.34", "10.0.0.1"]),
    });
    expect(result).toMatchObject({ safe: false, reason: "unsafe_resolved_address" });
  });
});
