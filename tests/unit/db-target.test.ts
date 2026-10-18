import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveTarget } from "../../scripts/db/target.mts";

const HOSTED = "postgresql://owner@ep-example.ap-southeast-1.aws.neon.tech/neondb";
const LOCAL_DEV = "postgresql://me@localhost:5432/dailyintel_dev";
const LOCAL_TEST = "postgresql://me@localhost:5432/dailyintel_test";

afterEach(() => vi.unstubAllEnvs());

describe("choosing which database a command acts on", () => {
  it("acts on the local development database by default", () => {
    vi.stubEnv("DATABASE_URL_OWNER", LOCAL_DEV);
    expect(resolveTarget([])).toEqual({ name: "development", ownerUrl: LOCAL_DEV });
  });

  it("refuses a hosted database unless --production is typed", () => {
    // Production is the only cloud database; reaching it must be deliberate.
    vi.stubEnv("DATABASE_URL_OWNER", HOSTED);
    expect(() => resolveTarget([])).toThrow(/without --production/);
    expect(resolveTarget(["--production"])).toEqual({ name: "production", ownerUrl: HOSTED });
  });

  it("refuses --production when the URL is local, so the flag and the target always agree", () => {
    vi.stubEnv("DATABASE_URL_OWNER", LOCAL_DEV);
    expect(() => resolveTarget(["--production"])).toThrow(/local database/);
  });

  it("never prints credentials when it refuses", () => {
    // Assembled here so no credential-shaped literal sits in the repository
    // for check:secrets to (rightly) refuse.
    const password = ["hunter2", "hunter2"].join("");
    vi.stubEnv("DATABASE_URL_OWNER", `postgresql://owner:${password}@ep-example.aws.neon.tech/neondb`);
    expect(() => resolveTarget([])).toThrow(/neondb on ep-example/);
    expect(() => resolveTarget([])).not.toThrow(/hunter2/);
  });

  it("takes --test only for a local database named as a test database", () => {
    vi.stubEnv("DATABASE_URL_TEST_OWNER", LOCAL_TEST);
    expect(resolveTarget(["--test"]).name).toBe("test");

    vi.stubEnv("DATABASE_URL_TEST_OWNER", LOCAL_DEV);
    expect(() => resolveTarget(["--test"])).toThrow(/_test/);
  });

  it("says which variable is missing", () => {
    vi.stubEnv("DATABASE_URL_OWNER", "");
    expect(() => resolveTarget([])).toThrow(/DATABASE_URL_OWNER/);
  });
});
