import { expect, test } from "@playwright/test";
import { DashboardShell } from "../../pages/DashboardShell";

test.describe("Watchlist", () => {
  test("carga la página del módulo", async ({ page }) => {
    await page.goto("/watchlist");

    await expect(new DashboardShell(page).pageTitle("Watchlist")).toBeVisible();
    await expect(page.getByText("Películas y series por ver.")).toBeVisible();
  });
});
