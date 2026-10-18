import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { closeDb } from "@/lib/db/client";
import { checkHealth } from "@/lib/services/health";

afterAll(async () => {
  await closeDb();
});
afterEach(() => vi.unstubAllEnvs());

describe("the health check", () => {
  it("is healthy when connected as the runtime role", async () => {
    expect(await checkHealth()).toMatchObject({
      ok: true,
      database: "ok",
      runtimeRole: "di_app",
      rowSecurityEnforced: true,
    });
  });

  it("is unhealthy when connected as a role that bypasses row-level security", async () => {
    // The misconfiguration this check exists for: every query would work, every
    // test would pass, and no policy would be protecting anything.
    vi.stubEnv("DATABASE_URL", process.env.DATABASE_URL_TEST_OWNER!);
    vi.resetModules();
    const fresh = await import("@/lib/services/health");
    const health = await fresh.checkHealth();
    expect(health).toMatchObject({ ok: false, database: "ok", rowSecurityEnforced: false });
    await (await import("@/lib/db/client")).closeDb();
  });

  it("reports an unconfigured database as such, without throwing", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.resetModules();
    const fresh = await import("@/lib/services/health");
    expect(await fresh.checkHealth()).toMatchObject({ ok: false, database: "unconfigured" });
  });

  it("reports an unreachable database as such, without throwing", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("DATABASE_URL", "postgresql://di_app@127.0.0.1:1/dailyintel_test");
    vi.resetModules();
    const fresh = await import("@/lib/services/health");
    expect(await fresh.checkHealth()).toMatchObject({ ok: false, database: "unreachable", runtimeRole: null });
    await (await import("@/lib/db/client")).closeDb();
    log.mockRestore();
  });
});
