/**
 * The scheduler's secret for this suite's server. Assembled rather than
 * written out, and handed down through the environment so every worker agrees.
 * It guards only this suite's throwaway server.
 */
export const E2E_CRON_SECRET = (process.env.E2E_CRON_SECRET ??= ["end", "to", "end", "scheduler", "secret", "only"].join("-"));
