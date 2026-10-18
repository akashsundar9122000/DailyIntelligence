import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";

import { assertTestDatabase } from "../test-database";

/*
 * The first rung of the integration tier: prove the suite is talking to the
 * database it thinks it is, as the role it thinks it is. Everything above this
 * inherits the answer.
 */
const url = process.env.DATABASE_URL!;
const client = new pg.Client({ connectionString: url });
const connected = client.connect();

afterAll(async () => {
  await client.end();
});

describe("the integration database", () => {
  it("is the local test database the connection string names", async () => {
    await connected;
    const { rows } = await client.query<{ name: string }>("select current_database() as name");
    /*
     * The URL is what decides where a connection goes, so locality is asserted
     * on the URL (local host, *_test name) and the live database is then tied
     * to it by name. The server's own address is not asserted: in CI the
     * database is a container that reports its container-network address while
     * being reached through localhost.
     */
    expect(rows[0]?.name).toBe(assertTestDatabase(url));
  });

  it("is Postgres 17 or later", async () => {
    // Local development runs 17; CI and production run 18. Nothing in the
    // schema may depend on a feature only one of them has (ids are generated
    // in application code for exactly this reason).
    await connected;
    const { rows } = await client.query<{ major: number }>(
      "select current_setting('server_version_num')::int / 10000 as major",
    );
    expect(rows[0]?.major).toBeGreaterThanOrEqual(17);
  });
});
