import { expect, test as setup } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage";
import { getTestUser, STORAGE_STATE } from "../support/env";

setup("iniciar sesión con el usuario de pruebas", async ({ page }) => {
  const user = getTestUser();
  const loginPage = new LoginPage(page);

  await loginPage.goto();
  await loginPage.login(user.email, user.password);

  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole("heading", { level: 1, name: "Entrada del día" })).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});
