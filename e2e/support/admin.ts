/**
 * The address the suite's server treats as an administrator's.
 *
 * Made once per run and handed down through the environment: the Playwright
 * config is evaluated again in every worker, and an address built from the
 * clock there would be a different one each time. A new address each run, so a
 * database left over from the last run cannot already hold the account.
 */
export const E2E_ADMIN_EMAIL = (process.env.E2E_ADMIN_EMAIL ??= `e2e-admin-${Date.now().toString(36)}@example.in`);
