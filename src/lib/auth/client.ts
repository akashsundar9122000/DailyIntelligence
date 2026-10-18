"use client";

import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * The browser's handle on the authentication endpoints. No base URL: requests
 * go to this page's own origin, whichever host is serving it, which is what
 * keeps the session cookie first-party.
 */
export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
});
