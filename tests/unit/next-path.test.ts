import { describe, expect, it } from "vitest";

import { authErrorMessage, oauthErrorMessage } from "@/lib/auth/messages";
import { DEFAULT_AFTER_SIGN_IN, safeNextPath } from "@/lib/auth/next-path";

describe("safeNextPath", () => {
  it("keeps a path on this site, with its query and fragment", () => {
    expect(safeNextPath("/app/hot")).toBe("/app/hot");
    expect(safeNextPath("/app/hot?scope=india#top")).toBe("/app/hot?scope=india#top");
  });

  it("falls back when nothing is given", () => {
    expect(safeNextPath(undefined)).toBe(DEFAULT_AFTER_SIGN_IN);
    expect(safeNextPath("")).toBe(DEFAULT_AFTER_SIGN_IN);
  });

  it("refuses every way of naming another site", () => {
    // Each of these is read by a browser as an absolute URL to somewhere else.
    for (const hostile of [
      "https://evil.example/app",
      "//evil.example/app",
      "/\\evil.example",
      "\\\\evil.example",
      "javascript:alert(1)",
      "data:text/html,x",
      "evil.example",
      "/\tevil",
      "/app\n//evil.example",
    ]) {
      expect(safeNextPath(hostile), hostile).toBe(DEFAULT_AFTER_SIGN_IN);
    }
  });

  it("normalises a path that tries to climb out", () => {
    expect(safeNextPath("/app/../../etc")).toBe("/etc");
    expect(safeNextPath("/app/../../etc").startsWith("/")).toBe(true);
  });
});

describe("authErrorMessage", () => {
  it("never says whether an address has an account", () => {
    // One flow signs in and signs up; a sentence that differed would tell an attacker which addresses exist.
    for (const code of ["INVALID_OTP", "OTP_EXPIRED", "TOO_MANY_ATTEMPTS", "INVALID_EMAIL"]) {
      expect(authErrorMessage({ code, status: 400 })).not.toMatch(/no account|not found|does not exist|already/i);
    }
    expect(authErrorMessage({ code: "INVALID_OTP", status: 400 })).toBe("That code is not correct. Check it and try again.");
  });

  it("never shows the library's own text", () => {
    expect(authErrorMessage({ code: "SOMETHING_NEW", status: 500, message: "relation users does not exist" })).toBe(
      "That did not work. Please try again.",
    );
  });

  it("explains a rate limit and a lost connection in plain words", () => {
    expect(authErrorMessage({ status: 429 })).toMatch(/Wait a minute/);
    expect(authErrorMessage({ status: 0 })).toMatch(/connection/);
  });

  it("explains a provider's failure without repeating what the provider sent", () => {
    expect(oauthErrorMessage(undefined)).toBeNull();
    expect(oauthErrorMessage("access_denied")).toMatch(/cancelled/);
    expect(oauthErrorMessage("<script>alert(1)</script>")).toBe("Sign-in with that provider did not complete. Try again, or use the email code.");
  });
});
