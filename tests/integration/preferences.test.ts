import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { closeDb } from "@/lib/db/client";
import { execRows, withSystem, withUser } from "@/lib/db/scope";
import { getPreferences } from "@/lib/queries/preferences";
import { updatePreferences } from "@/lib/services/preferences";
import { DEFAULT_PREFERENCES } from "@/lib/settings/preferences";

import { createVerifiedUser } from "./auth-helpers";

afterAll(async () => {
  await closeDb();
});

const storedFor = async (userId: string) =>
  (await withSystem("test", (tx) => execRows<{ preferences: Record<string, unknown> }>(tx, sql`select preferences from user_settings where user_id = ${userId}::uuid`)))[0]?.preferences;

describe("preferences", () => {
  it("are the defaults for a user who has never saved any, with no row written", async () => {
    const { userId } = await createVerifiedUser();
    expect(await getPreferences(userId)).toEqual(DEFAULT_PREFERENCES);
    expect(await storedFor(userId)).toBeUndefined();
  });

  it("save a change, return what the row now holds, and store only the difference", async () => {
    const { userId } = await createVerifiedUser();
    const result = await updatePreferences(userId, { mode: "dark", textSize: 112 });
    expect(result).toEqual({ ...DEFAULT_PREFERENCES, mode: "dark", textSize: 112 });
    // Read back from the table, independently of the function's return value.
    expect(await storedFor(userId)).toEqual({ mode: "dark", textSize: 112 });
  });

  it("save a palette and high contrast, and keep Aurora unstored as the default it is", async () => {
    const { userId } = await createVerifiedUser();
    await updatePreferences(userId, { palette: "newspaper", contrast: true });
    expect(await storedFor(userId)).toEqual({ palette: "newspaper", contrast: true });
    await updatePreferences(userId, { palette: "aurora", contrast: false });
    expect(await storedFor(userId)).toEqual({});
  });

  it("keep a reader who chose Night before themes existed on Newspaper, and rewrite the row in the new keys on their next save", async () => {
    const { userId } = await createVerifiedUser();
    await updatePreferences(userId, { textSize: 112 });
    // Written as the table's owner: updatePreferences() only ever writes the
    // new keys, and the system scope only reads this table -- an update
    // through it changes nothing and says nothing.
    const pg = (await import("pg")).default;
    const owner = new pg.Client({ connectionString: process.env.DATABASE_URL_TEST_OWNER });
    await owner.connect();
    await owner.query(`update user_settings set preferences = '{"theme":"dark","textSize":112}'::jsonb where user_id = $1`, [userId]);
    await owner.end();
    // Read back, so the test proves it set up what it meant to.
    expect(await storedFor(userId)).toEqual({ theme: "dark", textSize: 112 });

    expect(await getPreferences(userId)).toEqual({ ...DEFAULT_PREFERENCES, palette: "newspaper", mode: "dark", textSize: 112 });

    await updatePreferences(userId, { density: "compact" });
    // Read back: the legacy key is gone and their choice survives in the new ones.
    expect(await storedFor(userId)).toEqual({ palette: "newspaper", mode: "dark", textSize: 112, density: "compact" });
  });

  it("merge a later change with an earlier one rather than replacing it", async () => {
    const { userId } = await createVerifiedUser();
    await updatePreferences(userId, { defaultScope: "india" });
    await updatePreferences(userId, { density: "compact" });
    expect(await storedFor(userId)).toEqual({ defaultScope: "india", density: "compact" });
  });

  it("remove a key from storage when it is set back to its default", async () => {
    const { userId } = await createVerifiedUser();
    await updatePreferences(userId, { defaultScope: "global", readingStyle: "deep" });
    await updatePreferences(userId, { defaultScope: DEFAULT_PREFERENCES.defaultScope });
    expect(await storedFor(userId)).toEqual({ readingStyle: "deep" });
  });

  it("keep both of two changes made at the same moment", async () => {
    // Without the row lock each would read the old object and the later write would undo the earlier.
    const { userId } = await createVerifiedUser();
    await Promise.all([
      updatePreferences(userId, { mode: "dark" }),
      updatePreferences(userId, { readingHistory: false }),
      updatePreferences(userId, { landingPage: "/app/hot" }),
    ]);
    expect(await storedFor(userId)).toEqual({ mode: "dark", readingHistory: false, landingPage: "/app/hot" });
  });

  it("belong to one user: another cannot read or change them", async () => {
    const first = await createVerifiedUser();
    const second = await createVerifiedUser();
    await updatePreferences(first.userId, { contrast: true });

    const seen = await withUser(second.userId, (tx) => execRows(tx, sql`select 1 from user_settings where user_id = ${first.userId}::uuid`));
    expect(seen).toEqual([]);

    await withUser(second.userId, (tx) =>
      tx.execute(sql`update user_settings set preferences = '{"mode":"dark"}'::jsonb where user_id = ${first.userId}::uuid`),
    );
    expect(await storedFor(first.userId)).toEqual({ contrast: true });

    await expect(
      withUser(second.userId, (tx) => tx.execute(sql`insert into user_settings (user_id, preferences) values (${first.userId}::uuid, '{}'::jsonb)`)),
    ).rejects.toThrow();
  });

  it("are deleted with the account", async () => {
    const { userId } = await createVerifiedUser();
    await updatePreferences(userId, { mode: "dark" });
    const pg = (await import("pg")).default;
    const owner = new pg.Client({ connectionString: process.env.DATABASE_URL_TEST_OWNER });
    await owner.connect();
    await owner.query("delete from users where id = $1", [userId]);
    await owner.end();
    expect(await storedFor(userId)).toBeUndefined();
  });
});
