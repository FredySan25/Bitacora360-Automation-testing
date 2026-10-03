import { expect, test } from "@playwright/test";
import { DashboardShell } from "../../pages/DashboardShell";
import { getTestUser } from "../../support/env";
import { ui } from "../../support/ui";

const MODULES = [
  { path: "/habits", text: ui.modules.habits },
  { path: "/finance", text: ui.modules.finance },
  { path: "/watchlist", text: ui.modules.watchlist },
  { path: "/today", text: ui.modules.today },
];

test.describe("Dashboard navigation", () => {
  test("the sidebar leads to each module and marks the active one", async ({ page }) => {
    const shell = new DashboardShell(page);
    await page.goto("/today");

    for (const module of MODULES) {
      await shell.navLink(module.text.navLink).click();

      await expect(page).toHaveURL(new RegExp(`${module.path}$`));
      await expect(shell.pageTitle(module.text.title)).toBeVisible();
      await expect(shell.navLink(module.text.navLink)).toHaveAttribute("aria-current", "page");
    }
  });

  test("shows the user's email in the sidebar", async ({ page }) => {
    const shell = new DashboardShell(page);
    await page.goto("/today");

    await expect(shell.sidebar.getByText(getTestUser().email)).toBeVisible();
    await expect(shell.logoutButton).toBeVisible();
  });

  test("with an active session, /login and /register redirect to /today", async ({ page }) => {
    for (const authPath of ["/login", "/register"]) {
      await page.goto(authPath);

      await expect(page).toHaveURL(/\/today$/);
    }
  });

  test("with an active session, the root redirects to /today", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/today$/);
  });
});
