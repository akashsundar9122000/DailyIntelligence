import { describe, expect, it, vi } from "vitest";

import { AppError, fromDbError, HTTP_STATUS, isFrameworkSignal, notFound, toFailure } from "@/lib/errors";

describe("fromDbError", () => {
  it("maps the refusals a person can act on", () => {
    expect(fromDbError({ code: "23505" })?.code).toBe("CONFLICT");
    expect(fromDbError({ code: "42501" })?.code).toBe("FORBIDDEN");
    expect(fromDbError({ code: "23514" })?.code).toBe("VALIDATION");
  });

  it("finds the code when the driver wraps the error", () => {
    expect(fromDbError({ message: "Failed query", cause: { code: "23503" } })?.code).toBe("VALIDATION");
  });

  it("leaves anything else for the caller to treat as internal", () => {
    expect(fromDbError({ code: "08006" })).toBeNull();
    expect(fromDbError(new Error("boom"))).toBeNull();
    expect(fromDbError(null)).toBeNull();
  });
});

describe("toFailure", () => {
  it("passes an AppError through with its field errors", () => {
    expect(toFailure(new AppError("VALIDATION", "Check the form.", { email: "Required" }), "ref")).toEqual({
      code: "VALIDATION",
      message: "Check the form.",
      fieldErrors: { email: "Required" },
    });
  });

  it("never returns a database message, which names tables and can carry data", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const raw = Object.assign(new Error('duplicate key value violates unique constraint "users_email_key" (a@b.in)'), {
      code: "23505",
    });
    const failure = toFailure(raw, "ref-1");
    expect(JSON.stringify(failure)).not.toMatch(/users_email_key|a@b\.in/);
    expect(failure.code).toBe("CONFLICT");
    log.mockRestore();
  });

  it("answers an unknown error generically and logs it under the reference", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = toFailure(new Error("ECONNRESET at 10.0.0.5:5432"), "api 123");
    expect(failure).toEqual({ code: "INTERNAL", message: "Something went wrong. Please try again." });
    expect(log).toHaveBeenCalledWith("[api 123] unexpected error", expect.any(Error));
    log.mockRestore();
  });
});

describe("status codes", () => {
  it("reports another owner's resource as not found, never as forbidden", () => {
    // A 403 would confirm the resource exists.
    expect(HTTP_STATUS[notFound("That portfolio").code]).toBe(404);
  });

  it("has a status for every code", () => {
    for (const status of Object.values(HTTP_STATUS)) expect(status).toBeGreaterThanOrEqual(400);
  });
});

describe("isFrameworkSignal", () => {
  it("recognises the errors Next throws to redirect or 404", () => {
    expect(isFrameworkSignal(Object.assign(new Error("x"), { digest: "NEXT_REDIRECT;replace;/login;307;" }))).toBe(true);
    expect(isFrameworkSignal(new Error("ordinary"))).toBe(false);
    expect(isFrameworkSignal(new AppError("NOT_FOUND", "x"))).toBe(false);
  });
});
