import { expect, test } from "@playwright/test";
import { DashboardShell } from "../../pages/DashboardShell";
import { ui } from "../../support/ui";

const habits = ui.modules.habits;

const TABS = [
  { label: habits.tabs.progress, path: "/habits/progress" },
  { label: habits.tabs.gym, path: "/habits/gym" },
  { label: habits.tabs.daily, path: "/habits" },
];

test.describe("Habits", () => {
  test("the tabs switch sections and mark the active one", async ({ page }) => {
    const shell = new DashboardShell(page);
    const tabs = page.getByRole("navigation", { name: habits.tabsLabel });
    await page.goto("/habits");

    await expect(shell.pageTitle(habits.title)).toBeVisible();
    await expect(tabs.getByRole("link", { name: habits.tabs.daily })).toHaveAttribute(
      "aria-current",
      "page",
    );

    for (const tab of TABS) {
      await tabs.getByRole("link", { name: tab.label }).click();

      await expect(page).toHaveURL(new RegExp(`${tab.path}$`));
      await expect(tabs.getByRole("link", { name: tab.label })).toHaveAttribute(
        "aria-current",
        "page",
      );
      // The sidebar keeps the habits link active across the three sections
      await expect(shell.navLink(habits.navLink)).toHaveAttribute("aria-current", "page");
    }
  });
});
