import { mkdirSync } from "node:fs";
import path from "node:path";

import { signIn } from "./auth";
import { test as base } from "./test";

type SignedIn = { stateFile: string; email: string };

/**
 * A signed-in browser, created ONCE per worker and reused by every test that
 * imports this `test`. The account is made through the real pages, so it is a
 * real session and not a forged cookie.
 */
export const test = base.extend<object, { signedIn: SignedIn }>({
  signedIn: [
    async ({ browser }, run, workerInfo) => {
      const tag = `${workerInfo.project.name}-${workerInfo.workerIndex}`;
      const email = `shell-${Date.now().toString(36)}-${tag}@example.in`;
      const stateFile = path.join(workerInfo.project.outputDir, ".auth", `${tag}.json`);
      mkdirSync(path.dirname(stateFile), { recursive: true });

      const context = await browser.newContext({ baseURL: workerInfo.project.use.baseURL });
      const page = await context.newPage();
      await signIn(page, email);
      await context.storageState({ path: stateFile });
      await context.close();

      await run({ stateFile, email });
    },
    { scope: "worker" },
  ],
  storageState: ({ signedIn }, run) => run(signedIn.stateFile),
});

export { expect } from "./test";
