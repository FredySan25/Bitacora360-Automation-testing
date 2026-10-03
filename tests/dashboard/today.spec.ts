import { expect, test } from "@playwright/test";
import { DashboardShell } from "../../pages/DashboardShell";
import { ui } from "../../support/ui";

const CARDS = [
  { module: "habits", path: "/habits" },
  { module: "finance", path: "/finance" },
  { module: "watchlist", path: "/watchlist" },
] as const;

test.describe("Today", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/today");
  });

  test("shows the summary of the three modules", async ({ page }) => {
    const shell = new DashboardShell(page);

    await expect(shell.pageTitle(ui.modules.today.title)).toBeVisible();
    for (const card of CARDS) {
      await expect(
        page.getByRole("heading", { level: 2, name: ui.modules[card.module].title }),
      ).toBeVisible();
    }
  });

  for (const card of CARDS) {
    test(`the ${card.module} card links to ${card.path}`, async ({ page }) => {
      const { title } = ui.modules[card.module];

      await page.getByRole("link", { name: ui.modules.today.cardLink(title) }).click();

      await expect(page).toHaveURL(new RegExp(`${card.path}$`));
      await expect(new DashboardShell(page).pageTitle(title)).toBeVisible();
    });
  }
});
