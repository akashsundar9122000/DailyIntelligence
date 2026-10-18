/**
 * Only a local database whose name ends in `_test` may be used by a test run.
 *
 * A PURE FUNCTION in its own module rather than a helper inside a reset script,
 * so the integration config and the unit tests can both import it without
 * importing a file whose side effect is truncating a database.
 *
 * Two conditions, both required. The name alone is not enough: production is a
 * hosted database, and a hosted database that somebody named `app_test` would
 * pass a name check and be emptied.
 */
export function assertTestDatabase(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // The URL is not echoed: a malformed connection string usually still
    // contains its password.
    throw new Error("Refusing to use the test database: DATABASE_URL_TEST is not a valid connection string.");
  }

  const name = parsed.pathname.replace(/^\//, "");
  if (!name.endsWith("_test")) {
    throw new Error(`Refusing to use "${name}": only a database whose name ends in _test may be used by tests.`);
  }

  const host = parsed.hostname;
  if (host !== "localhost" && host !== "127.0.0.1" && host !== "::1" && host !== "[::1]") {
    throw new Error(`Refusing to use a test database on "${host}": tests run against a local Postgres only.`);
  }
  return name;
}
