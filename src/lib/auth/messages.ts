/**
 * What to tell a person when authentication refuses something.
 *
 * Written here rather than shown as the library sends it: its messages are for
 * developers, and several would tell an attacker more than they tell the user.
 * Whether an address has an account is never revealed: the same code flow
 * signs in an existing reader and creates a new one.
 */
type AuthError = { code?: string | undefined; status?: number | undefined; message?: string | undefined } | null | undefined;

const BY_CODE: Record<string, string> = {
  INVALID_EMAIL: "Enter a valid email address.",
  INVALID_OTP: "That code is not correct. Check it and try again.",
  OTP_EXPIRED: "That code has expired. Ask for a new one.",
  TOO_MANY_ATTEMPTS: "Too many wrong attempts. Ask for a new code.",
  ACCOUNT_NOT_LINKED: "That account uses a different sign-in. Use the email code instead.",
  EMAIL_NOT_VERIFIED: "Google has not verified that address. Use the email code instead.",
};

/** OAuth failures come back to the sign-in page as ?error=<code>. */
const OAUTH_ERRORS: Record<string, string> = {
  access_denied: "Sign-in with that provider was cancelled.",
  account_not_linked: BY_CODE.ACCOUNT_NOT_LINKED!,
  email_not_found: "That provider did not share an email address. Use the email code instead.",
  unable_to_link_account: BY_CODE.ACCOUNT_NOT_LINKED!,
};

export function authErrorMessage(error: AuthError, fallback = "That did not work. Please try again."): string {
  if (!error) return fallback;
  if (error.status === 429) return "Too many attempts. Wait a minute and try again.";
  if (error.code && BY_CODE[error.code]) return BY_CODE[error.code]!;
  if (error.status === 0 || error.status === undefined) return "Could not reach the server. Check your connection and try again.";
  return fallback;
}

export function oauthErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  return OAUTH_ERRORS[code.toLowerCase()] ?? "Sign-in with that provider did not complete. Try again, or use the email code.";
}
