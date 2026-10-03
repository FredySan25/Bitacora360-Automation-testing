import { expect, type Locator } from "@playwright/test";

/**
 * Waits until React has hydrated the element. Before that the page is plain
 * server HTML: text typed into a form never reaches React state and click
 * handlers are not attached yet, which makes tests flaky against `next dev`.
 */
export async function waitForHydration(locator: Locator) {
  await expect
    .poll(() =>
      locator.evaluate((el) =>
        Object.keys(el).some((key) => key.startsWith("__reactProps$")),
      ),
    )
    .toBe(true);
}
