import { expect, type Page } from "@playwright/test";

let counter = 0;
/** An address no other test, worker or run has used. */
export function newEmail(): string {
  counter += 1;
  return `reader-${Date.now().toString(36)}-${counter}-${Math.floor(performance.now())}@example.in`;
}

/**
 * The newest code mailed to an address, read from the development outbox --
 * the same page a developer would look at. With SMTP blanked for this suite,
 * nothing is actually delivered.
 */
export async function latestCode(page: Page, email: string): Promise<string> {
  const outbox = await page.context().newPage();
  try {
    await outbox.goto("/dev/outbox", { waitUntil: "domcontentloaded" });
    const entry = outbox.getByTestId("outbox-entry").filter({ has: outbox.getByTestId("outbox-to").getByText(email, { exact: true }) }).first();
    await expect(entry).toBeVisible();
    const body = await entry.getByTestId("outbox-body").innerText();
    const code = /\b\d{6}\b/.exec(body)?.[0];
    if (!code) throw new Error(`No six-digit code in the newest message to ${email}.`);
    return code;
  } finally {
    await outbox.close();
  }
}

/** Ask for a code on the sign-in page. Ends on the "Check your inbox" step. */
export async function requestCode(page: Page, email: string): Promise<void> {
  if (!page.url().includes("/login")) await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: /Email me a code/ }).click();
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
}

/**
 * Sign in through the real pages with an emailed code. The first time, this
 * creates the account. The whole code typed into the first box fills all six
 * and submits, as a phone keyboard's suggestion does.
 */
export async function signIn(page: Page, email = newEmail()): Promise<string> {
  await requestCode(page, email);
  await page.getByLabel("Sign-in code, digit 1 of 6").fill(await latestCode(page, email));
  await expect(page).toHaveURL(/\/app(\/|$)/);
  return email;
}
