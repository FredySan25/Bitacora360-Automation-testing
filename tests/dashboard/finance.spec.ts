import { expect, test } from "@playwright/test";
import { DashboardShell } from "../../pages/DashboardShell";
import { ui } from "../../support/ui";

test.describe("Finance", () => {
  test("loads the module page", async ({ page }) => {
    await page.goto("/finance");

    await expect(new DashboardShell(page).pageTitle(ui.modules.finance.title)).toBeVisible();
    await expect(page.getByText(ui.modules.finance.description)).toBeVisible();
  });
});
