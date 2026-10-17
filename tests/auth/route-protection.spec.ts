import { expect, test } from "@playwright/test";
import { searchCatalog } from "../../pages/WatchlistPage";
import { ui } from "../../support/ui";

const PROTECTED_ROUTES = [
  "/today",
  "/habits",
  "/habits/progress",
  "/habits/gym",
  "/finance",
  "/finance/budgets",
  "/finance/summary",
  "/finance/goals",
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

  // It answers before searching, so no catalog is reached
  test("the catalog search of the watchlist answers 401", async ({ request }) => {
    const response = await searchCatalog(request, { type: "movie", q: "Spirited Away" });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });
});
