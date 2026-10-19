import { expect, type Locator } from "@playwright/test";

/**
 * Open a menu and wait for the item, pressing again if the first press came
 * before the page was interactive. A press during hydration is lost (the
 * button has no handler yet), which passes on a fast machine and fails on a
 * busy CI runner. A real person simply presses again; so does this.
 */
export async function openMenuTo(trigger: Locator, item: Locator): Promise<void> {
  await expect(async () => {
    if (!(await item.isVisible())) await trigger.click();
    await expect(item).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 20_000 });
}
