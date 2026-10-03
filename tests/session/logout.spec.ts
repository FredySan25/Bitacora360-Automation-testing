import { expect, test } from "@playwright/test";
import { DashboardShell } from "../../pages/DashboardShell";
import { LoginPage } from "../../pages/LoginPage";
import { getTestUser, hasTestUser } from "../../support/env";

test.describe("Logout", () => {
  test.skip(!hasTestUser(), "Requiere E2E_USER_EMAIL y E2E_USER_PASSWORD en .env");

  test("cerrar sesión regresa a /login y vuelve a proteger el dashboard", async ({ page }) => {
    const user = getTestUser();
    const loginPage = new LoginPage(page);
    const shell = new DashboardShell(page);

    // Logs in through the UI instead of reusing the saved session
    await loginPage.goto();
    await loginPage.login(user.email, user.password);
    await expect(page).toHaveURL(/\/today$/);

    await shell.logoutButton.click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(loginPage.heading).toBeVisible();

    await page.goto("/today");
    await expect(page).toHaveURL(/\/login$/);
  });
});
