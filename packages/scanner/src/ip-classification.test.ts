import { describe, expect, it } from "vitest";
import { classifyIpAddress, isSafePublicAddress } from "./ip-classification";

describe("classifyIpAddress", () => {
  it.each([
    ["8.8.8.8", "public"],
    ["1.1.1.1", "public"],
    ["127.0.0.1", "loopback"],
    ["10.0.0.1", "private"],
    ["172.16.0.1", "private"],
    ["172.31.255.255", "private"],
    ["172.15.0.1", "public"],
    ["172.32.0.1", "public"],
    ["192.168.1.1", "private"],
    ["169.254.169.254", "cloud_metadata"],
    ["169.254.1.1", "cloud_metadata"],
    ["100.64.0.1", "private"],
    ["224.0.0.1", "multicast"],
    ["240.0.0.1", "reserved"],
    ["0.0.0.0", "reserved"],
    ["999.1.1.1", "invalid"],
  ])("classifies IPv4 %s as %s", (address, expected) => {
    expect(classifyIpAddress(address)).toBe(expected);
  });

  it.each([
    ["::1", "loopback"],
    ["fe80::1", "link_local"],
    ["fc00::1", "private"],
    ["fd12:3456::1", "private"],
    ["ff02::1", "multicast"],
    ["2606:4700:4700::1111", "public"],
    ["::ffff:127.0.0.1", "loopback"],
    ["::ffff:10.0.0.1", "private"],
    ["::ffff:8.8.8.8", "public"],
  ])("classifies IPv6 %s as %s", (address, expected) => {
    expect(classifyIpAddress(address)).toBe(expected);
  });

  it("treats only public addresses as safe", () => {
    expect(isSafePublicAddress("8.8.8.8")).toBe(true);
    expect(isSafePublicAddress("127.0.0.1")).toBe(false);
    expect(isSafePublicAddress("169.254.169.254")).toBe(false);
  });
});
