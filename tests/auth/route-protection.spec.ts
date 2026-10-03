import { expect, test } from "@playwright/test";
import { ui } from "../../support/ui";

const PROTECTED_ROUTES = [
  "/today",
  "/habits",
  "/habits/progress",
  "/habits/gym",
  "/finance",
  "/watchlist",
];

test.describe("Route protection without a session", () => {
  for (const route of PROTECTED_ROUTES) {
    test(`${route} redirects to /login`, async ({ page }) => {
      await page.goto(route);

      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("heading", { name: ui.login.heading })).toBeVisible();
    });
  }

  test("the root redirects to /login", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/login$/);
  });
});
