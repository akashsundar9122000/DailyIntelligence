import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

let requestHeaders = new Headers();
vi.mock("next/headers", () => ({ headers: async () => requestHeaders }));

import { publicAction } from "@/lib/actions/_define";
import { AppError } from "@/lib/errors";

const schema = z.object({ email: z.email("Enter a valid email address.") });

beforeEach(() => {
  requestHeaders = new Headers({ "sec-fetch-site": "same-origin", origin: "https://app.example.in", host: "app.example.in" });
});

describe("publicAction", () => {
  it("returns the handler's result in the success envelope", async () => {
    const action = publicAction(schema, async (input) => ({ accepted: input.email }));
    await expect(action({ email: "a@example.in" })).resolves.toEqual({ ok: true, data: { accepted: "a@example.in" } });
  });

  it("reports invalid input by field without running the handler", async () => {
    const handler = vi.fn(async () => "ran");
    const result = await publicAction(schema, handler)({ email: "nope" });
    expect(result).toMatchObject({ ok: false, code: "VALIDATION", fieldErrors: { email: "Enter a valid email address." } });
    expect(handler).not.toHaveBeenCalled();
  });

  it("refuses a cross-site call before parsing anything", async () => {
    requestHeaders = new Headers({ "sec-fetch-site": "cross-site", host: "app.example.in" });
    const handler = vi.fn(async () => "ran");
    const result = await publicAction(schema, handler)({ email: "a@example.in" });
    expect(result).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("turns a known failure into a typed result", async () => {
    const action = publicAction(schema, async () => {
      throw new AppError("CONFLICT", "That email is already registered.");
    });
    expect(await action({ email: "a@example.in" })).toMatchObject({
      ok: false,
      code: "CONFLICT",
      message: "That email is already registered.",
    });
  });

  it("hides an unexpected failure behind a reference", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const action = publicAction(schema, async () => {
      throw new Error("connect ECONNREFUSED 10.0.0.5:5432");
    });
    const result = await action({ email: "a@example.in" });
    expect(result).toMatchObject({ ok: false, code: "INTERNAL" });
    expect(JSON.stringify(result)).not.toContain("ECONNREFUSED");
    expect(result.ok ? "" : result.reference).toMatch(/^[0-9a-f-]{36}$/);
    log.mockRestore();
  });

  it("lets a redirect thrown by the handler through", async () => {
    const signal = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/app;307;" });
    const action = publicAction(schema, async () => {
      throw signal;
    });
    await expect(action({ email: "a@example.in" })).rejects.toBe(signal);
  });
});
