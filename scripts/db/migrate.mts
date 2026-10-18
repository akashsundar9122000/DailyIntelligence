/*
 * Applies pending migrations as the OWNER role, and reads the result back.
 * A deliberate step, run by hand or from CI. Never from application start-up.
 */
import { describeTarget, migrate } from "./steps.mts";
import { resolveTarget } from "./target.mts";

const target = resolveTarget(process.argv.slice(2));
const result = await migrate(target.ownerUrl);
console.log(
  `migrate: ${describeTarget(target.ownerUrl)} (${target.name}) records ${result.applied} of ${result.expected} migrations`,
);
