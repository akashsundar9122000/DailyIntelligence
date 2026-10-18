import { describe, expect, it, vi } from "vitest";

// The module reads request headers through next/headers; the pure helpers under
// test take a header reader instead, so nothing here needs a real request.
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

import { assertSameOriginHeaders, clientIp, isSecureRequest } from "@/lib/http/request";

const h = (values: Record<string, string>) => new Headers(values);

describe("isSecureRequest", () => {
  it("follows the transport the proxy reports", () => {
    expect(isSecureRequest(h({ "x-forwarded-proto": "https" }))).toBe(true);
    expect(isSecureRequest(h({ "x-forwarded-proto": "http" }))).toBe(false);
    expect(isSecureRequest(h({ "x-forwarded-proto": "https, http" }))).toBe(true);
  });

  it("does not call a plain-http request secure because the build is a production one", () => {
    // Safari drops a Secure cookie sent over http; sign-in then loops silently.
    vi.stubEnv("NODE_ENV", "production");
    expect(isSecureRequest(h({}))).toBe(false);
    expect(isSecureRequest(h({}), "http://localhost:4610")).toBe(false);
    vi.unstubAllEnvs();
  });

  it("falls back to the configured origin only when the proxy says nothing", () => {
    expect(isSecureRequest(h({}), "https://example.in")).toBe(true);
    expect(isSecureRequest(h({ "x-forwarded-proto": "http" }), "https://example.in")).toBe(false);
  });
});

describe("clientIp", () => {
  it("prefers the address the platform set", () => {
    expect(clientIp(h({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "10.9.9.9" }))).toBe("203.0.113.7");
  });

  it("takes the last forwarded hop, not the first, which the client can write", () => {
    expect(clientIp(h({ "x-forwarded-for": "1.2.3.4, 203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("has a stable answer when nothing is known", () => {
    expect(clientIp(h({}))).toBe("unknown");
  });
});

describe("assertSameOriginHeaders", () => {
  it("accepts a request from this site", () => {
    expect(() =>
      assertSameOriginHeaders(h({ "sec-fetch-site": "same-origin", origin: "https://app.example.in", host: "app.example.in" })),
    ).not.toThrow();
  });

  it("accepts a request with no browser metadata, such as a server-side call", () => {
    expect(() => assertSameOriginHeaders(h({ host: "app.example.in" }))).not.toThrow();
  });

  it("refuses a request another site initiated", () => {
    expect(() => assertSameOriginHeaders(h({ "sec-fetch-site": "cross-site", host: "app.example.in" }))).toThrow(/did not come from this site/);
    expect(() => assertSameOriginHeaders(h({ origin: "https://evil.example", host: "app.example.in" }))).toThrow();
    expect(() => assertSameOriginHeaders(h({ origin: "null", host: "app.example.in" }))).toThrow();
  });

  it("compares against the forwarded host behind a proxy", () => {
    expect(() =>
      assertSameOriginHeaders(h({ origin: "https://app.example.in", host: "internal:3000", "x-forwarded-host": "app.example.in" })),
    ).not.toThrow();
  });
});
