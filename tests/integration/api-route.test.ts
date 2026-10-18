import { NextRequest } from "next/server";
import { uuidv7 } from "uuidv7";
import { afterAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { defineRoute } from "@/lib/api/route";
import { closeDb } from "@/lib/db/client";
import { notFound } from "@/lib/errors";

afterAll(async () => {
  await closeDb();
});

const context = { params: Promise.resolve({}) };
const get = (url: string, headers: Record<string, string> = {}) => new NextRequest(`http://localhost${url}`, { headers });
const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost${url}`, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json", host: "localhost", ...headers },
  });

describe("defineRoute", () => {
  it("answers in the success envelope with a request id in the body and the header", async () => {
    const route = defineRoute({ query: z.object({ q: z.string().min(2) }) }, async ({ query }) => ({ echoed: query.q }));
    const response = await route(get("/api/x?q=nifty"), context);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, data: { echoed: "nifty" } });
    expect(response.headers.get("x-request-id")).toBe(body.requestId);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("answers 422 with field errors for invalid input", async () => {
    const route = defineRoute({ query: z.object({ q: z.string().min(2, "Type at least two characters.") }) }, async () => 1);
    const response = await route(get("/api/x?q=n"), context);
    expect(response.status).toBe(422);
    expect((await response.json()).error).toMatchObject({ code: "VALIDATION", fieldErrors: { q: "Type at least two characters." } });
  });

  it("answers 404 for a resource the caller may not see", async () => {
    const route = defineRoute({}, async () => {
      throw notFound("That portfolio");
    });
    const response = await route(get("/api/x"), context);
    expect(response.status).toBe(404);
  });

  it("answers 500 without the underlying error", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const route = defineRoute({}, async () => {
      throw new Error('relation "secret_table" does not exist');
    });
    const response = await route(get("/api/x"), context);
    const text = await response.text();
    expect(response.status).toBe(500);
    expect(text).not.toContain("secret_table");
    log.mockRestore();
  });

  it("refuses a body sent from another site, before reading it", async () => {
    const handler = vi.fn(async () => 1);
    const route = defineRoute({ body: z.object({ name: z.string() }) }, handler);
    const response = await route(post("/api/x", { name: "a" }, { "sec-fetch-site": "cross-site" }), context);
    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("answers 422 for a body that is not JSON", async () => {
    const route = defineRoute({ body: z.object({ name: z.string() }) }, async () => 1);
    const response = await route(post("/api/x", "{not json"), context);
    expect(response.status).toBe(422);
  });

  it("answers 429 with Retry-After once an address passes its limit, and stops calling the handler", async () => {
    const handler = vi.fn(async () => "ok");
    const route = defineRoute({ limit: { name: `test-${uuidv7()}`, rule: { max: 2, windowSeconds: 60 } } }, handler);
    const from = { "x-real-ip": "203.0.113.50" };
    const statuses = [];
    for (let i = 0; i < 3; i++) statuses.push((await route(get("/api/x", from), context)).status);
    expect(statuses).toEqual([200, 200, 429]);
    expect(handler).toHaveBeenCalledTimes(2);

    const refused = await route(get("/api/x", from), context);
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
    // A different address is not affected.
    expect((await route(get("/api/x", { "x-real-ip": "203.0.113.51" }), context)).status).toBe(200);
  });
});
