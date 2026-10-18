/*
 * Creates or refreshes the NOBYPASSRLS application role. Connects as the owner,
 * because role management is not something the app role may do to itself.
 */
import { APP_ROLE, AUTH_ROLE, applyRoles, describeTarget } from "./steps.mts";
import { resolveTarget } from "./target.mts";

const target = resolveTarget(process.argv.slice(2));
await applyRoles(target.ownerUrl, process.env.APP_DB_PASSWORD || undefined, process.env.AUTH_DB_PASSWORD || undefined);
console.log(`roles: ${APP_ROLE} and ${AUTH_ROLE} ready on ${describeTarget(target.ownerUrl)} (${target.name}; NOBYPASSRLS, DML only)`);
