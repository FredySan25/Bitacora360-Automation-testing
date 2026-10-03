import { expect, test as setup } from "@playwright/test";
import { DashboardShell } from "../pages/DashboardShell";
import { LoginPage } from "../pages/LoginPage";
import { getTestUser, STORAGE_STATE } from "../support/env";
import { ui } from "../support/ui";

setup("log in with the test user", async ({ page }) => {
  const user = getTestUser();
  const loginPage = new LoginPage(page);

  await loginPage.goto();
  await loginPage.login(user.email, user.password);

  await expect(page).toHaveURL(/\/today$/);
  await expect(new DashboardShell(page).pageTitle(ui.modules.today.title)).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});
