/*
 * Which database a command acts on, chosen by a flag and never by default.
 *
 *   (no flag)       the local development database   DATABASE_URL_OWNER
 *   --test          the local test database          DATABASE_URL_TEST_OWNER
 *   --production    the hosted production database   DATABASE_URL_OWNER, from
 *                                                    .env.neon.local
 *
 * Production is the only cloud database this project has, so a mistake there is
 * live. A hosted URL is therefore refused unless --production is typed, and a
 * local one is refused when it is: the flag and the target must agree.
 */
import { assertTestDatabase } from "../../tests/test-database";
import { describeTarget, isLocal } from "./steps.mts";

export type Target = { name: "development" | "test" | "production"; ownerUrl: string };

export function resolveTarget(argv: string[]): Target {
  const test = argv.includes("--test");
  const production = argv.includes("--production");
  if (test && production) throw new Error("Choose one of --test or --production.");

  if (test) {
    const ownerUrl = process.env.DATABASE_URL_TEST_OWNER;
    if (!ownerUrl) throw new Error("DATABASE_URL_TEST_OWNER is not set. See .env.example.");
    assertTestDatabase(ownerUrl);
    return { name: "test", ownerUrl };
  }

  const ownerUrl = process.env.DATABASE_URL_OWNER;
  if (!ownerUrl) throw new Error("DATABASE_URL_OWNER is not set. See .env.example.");

  if (production) {
    if (isLocal(ownerUrl)) {
      throw new Error("--production was given but DATABASE_URL_OWNER is a local database. Load .env.neon.local.");
    }
    return { name: "production", ownerUrl };
  }

  if (!isLocal(ownerUrl)) {
    throw new Error(
      `Refusing to touch ${describeTarget(ownerUrl)} without --production. ` +
        "Development commands act on a local database only.",
    );
  }
  return { name: "development", ownerUrl };
}
