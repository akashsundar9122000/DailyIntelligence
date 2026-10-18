import { describe, expect, it } from "vitest";

import { assertTestDatabase } from "../test-database";

describe("assertTestDatabase", () => {
  it("accepts a local database whose name ends in _test", () => {
    expect(assertTestDatabase("postgresql://someone@localhost:5432/dailyintel_test")).toBe("dailyintel_test");
    expect(assertTestDatabase("postgresql://127.0.0.1/dailyintel_test?sslmode=disable")).toBe("dailyintel_test");
  });

  it("refuses a database that is not named as a test database", () => {
    expect(() => assertTestDatabase("postgresql://localhost:5432/dailyintel_dev")).toThrow(/_test/);
    expect(() => assertTestDatabase("postgresql://localhost:5432/neondb")).toThrow(/_test/);
  });

  it("refuses a hosted database even when its name ends in _test", () => {
    expect(() => assertTestDatabase("postgresql://u@ep-example.aws.neon.tech/app_test")).toThrow(/local Postgres/);
  });

  it("does not echo a malformed connection string, which may hold a password", () => {
    const attempt = () => assertTestDatabase("not a url :hunter2@");
    expect(attempt).toThrow(/not a valid connection string/);
    expect(attempt).not.toThrow(/hunter2/);
  });
});
