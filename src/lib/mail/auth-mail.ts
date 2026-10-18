import { brand } from "@/config/brand";

import type { MailContent } from "./templates";

export const CODE_MINUTES = 10;

const IGNORE = "If you did not ask for this, you can ignore this message. Nobody can use the code without access to your inbox.";

/** The code that signs a reader in, and creates the account the first time. */
export function signInCodeMail(code: string): MailContent {
  return {
    subject: `${code} is your ${brand.name} sign-in code`,
    heading: "Your sign-in code",
    paragraphs: [`Enter this code to sign in. It works for ${CODE_MINUTES} minutes and only once.`],
    code,
    footnote: IGNORE,
  };
}

/** The code that confirms it is still you before something that cannot be undone. */
export function confirmCodeMail(code: string): MailContent {
  return {
    subject: `${code} is your ${brand.name} confirmation code`,
    heading: "Confirm it is you",
    paragraphs: [`Enter this code to confirm the change you asked for. It works for ${CODE_MINUTES} minutes.`],
    code,
    footnote: "If you did not ask for this, someone may be using a device you are signed in on. Sign out of your other devices from Settings.",
  };
}

export function emailChangeCodeMail(code: string): MailContent {
  return {
    subject: `${code} is your ${brand.name} email change code`,
    heading: "Confirm your new email address",
    paragraphs: [`Enter this code to finish changing your email address. It works for ${CODE_MINUTES} minutes.`],
    code,
    footnote: IGNORE,
  };
}

export function accountDeletedMail(): MailContent {
  return {
    subject: `Your ${brand.name} account was deleted`,
    heading: "Your account was deleted",
    paragraphs: [
      "Your account, your interests, your saved stories and your reading history have been deleted, as you asked. This cannot be undone.",
      "You are welcome to come back at any time.",
    ],
    footnote: "If you did not ask for this, reply to this message straight away.",
  };
}
