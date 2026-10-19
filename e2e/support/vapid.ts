import webpush from "web-push";

/**
 * A push key pair for this run only. Made once and handed down through the
 * environment, because the Playwright config is evaluated again in every
 * worker and a fresh pair there would not match the server's. It signs nothing
 * that leaves this machine: no push service is reached from the suite.
 */
function pair(): { publicKey: string; privateKey: string } {
  if (process.env.E2E_VAPID_PUBLIC && process.env.E2E_VAPID_PRIVATE) return { publicKey: process.env.E2E_VAPID_PUBLIC, privateKey: process.env.E2E_VAPID_PRIVATE };
  const keys = webpush.generateVAPIDKeys();
  process.env.E2E_VAPID_PUBLIC = keys.publicKey;
  process.env.E2E_VAPID_PRIVATE = keys.privateKey;
  return keys;
}

export const E2E_VAPID = pair();
