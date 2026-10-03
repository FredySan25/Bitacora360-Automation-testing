import { expect, test } from "@playwright/test";
import { DashboardShell } from "../../pages/DashboardShell";
import { ui } from "../../support/ui";

test.describe("Watchlist", () => {
  test("loads the module page", async ({ page }) => {
    await page.goto("/watchlist");

    await expect(new DashboardShell(page).pageTitle(ui.modules.watchlist.title)).toBeVisible();
    await expect(page.getByText(ui.modules.watchlist.description)).toBeVisible();
  });
});
