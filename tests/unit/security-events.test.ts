import { describe, expect, it } from "vitest";

import { deviceLabel, networkPrefix } from "@/lib/auth/security-events";

describe("what the security log keeps about a request", () => {
  it("keeps a network prefix, never a whole address", () => {
    expect(networkPrefix("203.0.113.57")).toBe("203.0.x.x");
    expect(networkPrefix("2401:4900:1c2b:8f00::1")).toBe("2401:4900:1c2b::");
    expect(networkPrefix(null)).toBeNull();
    expect(networkPrefix("unknown")).toBeNull();
  });

  it("keeps a browser and platform family, never the full user agent", () => {
    expect(deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1")).toBe("Safari on iOS");
    expect(deviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36 Edg/140.0")).toBe("Edge on Windows");
    expect(deviceLabel("Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36")).toBe("Chrome on Android");
    expect(deviceLabel("curl/8.7.1")).toBe("Browser on unknown platform");
    expect(deviceLabel(undefined)).toBeNull();
  });
});
