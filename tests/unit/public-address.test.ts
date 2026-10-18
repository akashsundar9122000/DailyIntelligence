import { describe, expect, it } from "vitest";

import { isPublicAddress, readWebhookUrl } from "@/lib/net/public-address";

describe("isPublicAddress", () => {
  it("accepts ordinary public addresses", () => {
    for (const address of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "172.15.0.1", "172.32.0.1", "100.63.255.255"]) expect(isPublicAddress(address), address).toBe(true);
  });

  it("refuses loopback, private, link-local and metadata addresses", () => {
    for (const address of ["127.0.0.1", "127.255.255.254", "10.0.0.1", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255", "192.0.2.1", "198.18.0.1"]) {
      expect(isPublicAddress(address), address).toBe(false);
    }
  });

  it("refuses every IPv6 address, private or public, in any spelling", () => {
    // Private ones; an IPv4 address carried inside an IPv6 one, dotted and in hex (NAT64, mapped,
    // compatible, 6to4); and ordinary public ones. None is sent to: see the note on isPublicAddress.
    for (const address of [
      "::1", "::", "0:0:0:0:0:0:0:1", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "2001:db8::1",
      "::ffff:127.0.0.1", "::ffff:10.0.0.1", "::ffff:169.254.169.254", "::ffff:7f00:1", "::ffff:8.8.8.8",
      "64:ff9b::10.0.0.1", "64:ff9b::a9fe:a9fe", "64:ff9b:1::a9fe:a9fe", "::7f00:1", "::127.0.0.1", "2002:a9fe:a9fe::1",
      "2606:4700:4700::1111", "2a00:1450:4001::200e",
    ]) {
      expect(isPublicAddress(address), address).toBe(false);
    }
  });

  it("refuses anything that is not an address at all", () => {
    for (const text of ["", "localhost", "example.com", "1.2.3", "999.1.1.1", "0x7f.0.0.1", "2130706433"]) expect(isPublicAddress(text), text).toBe(false);
  });
});

describe("readWebhookUrl", () => {
  it("accepts an https address on the standard port", () => {
    expect(readWebhookUrl(" https://hooks.example.com/candles?x=1 ")).toMatchObject({ ok: true });
    expect(readWebhookUrl("https://example.com:443/hook")).toMatchObject({ ok: true });
  });

  it("refuses anything else, and says why", () => {
    const error = (text: string) => {
      const result = readWebhookUrl(text);
      return result.ok ? null : result.error;
    };
    expect(error("not a url")).toBe("Enter a full address, beginning https://.");
    expect(error("http://example.com/hook")).toContain("must begin https://");
    expect(error("ftp://example.com/hook")).toContain("must begin https://");
    expect(error("https://user:pass@example.com/hook")).toContain("user name or a password");
    expect(error("https://example.com:8443/hook")).toBe("The address must use the standard port.");
    expect(error("https://127.0.0.1/hook")).toBe("That address is not on the public internet.");
    expect(error("https://169.254.169.254/latest/meta-data")).toBe("That address is not on the public internet.");
    expect(error("https://[::1]/hook")).toBe("That address is not on the public internet.");
    expect(error("https://[::127.0.0.1]/hook")).toBe("That address is not on the public internet.");
    expect(error("https://[64:ff9b::a9fe:a9fe]/hook")).toBe("That address is not on the public internet.");
    expect(error("https://[2606:4700:4700::1111]/hook")).toBe("That address is not on the public internet.");
    expect(error("https://localhost/hook")).toBe("Enter a full host name, such as example.com.");
    expect(error("https://db.internal/hook")).toBe("That address is not on the public internet.");
    expect(error("https://printer.local/hook")).toBe("That address is not on the public internet.");
  });
});
