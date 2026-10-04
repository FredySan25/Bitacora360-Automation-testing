import { expect, test } from "@playwright/test";
import { LoginPage } from "../../pages/LoginPage";
import { ui } from "../../support/ui";

test.describe("Login", () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test("shows the login form", async () => {
    await expect(loginPage.heading).toBeVisible();
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toHaveText(ui.login.submit);
    await expect(loginPage.registerLink).toBeVisible();
  });

  test("rejects wrong credentials", async ({ page }) => {
    await loginPage.login("does-not-exist@bitacora360.test", "wrong-password");

    await expect(loginPage.errorAlert).toHaveText(ui.login.invalidCredentials);
    await expect(page).toHaveURL(/\/login$/);
    // The form is usable again after the error
    await expect(loginPage.submitButton).toBeEnabled();
  });

  test("does not submit the form with empty fields", async ({ page }) => {
    await loginPage.submitButton.click();

    const emailMissing = await loginPage.emailInput.evaluate(
      (el: HTMLInputElement) => el.validity.valueMissing,
    );
    expect(emailMissing).toBe(true);
    await expect(loginPage.errorAlert).toBeHidden();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("does not accept an email with an invalid format", async ({ page }) => {
    await loginPage.login("not-an-email", "any-password");

    const typeMismatch = await loginPage.emailInput.evaluate(
      (el: HTMLInputElement) => el.validity.typeMismatch,
    );
    expect(typeMismatch).toBe(true);
    await expect(loginPage.errorAlert).toBeHidden();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("lets the user show and hide the password", async () => {
    await loginPage.passwordInput.fill("secret123");
    await expect(loginPage.passwordInput).toHaveAttribute("type", "password");

    await loginPage.passwordToggle.click();
    await expect(loginPage.passwordInput).toHaveAttribute("type", "text");
    await expect(loginPage.passwordToggle).toHaveAttribute("aria-pressed", "true");
    await expect(loginPage.passwordInput).toHaveValue("secret123");

    await loginPage.passwordToggle.click();
    await expect(loginPage.passwordInput).toHaveAttribute("type", "password");
  });

  test("an invalid confirmation link lands on /login with a notice", async ({ page }) => {
    await page.goto("/auth/confirm");

    await expect(page).toHaveURL(/\/login\?error=confirmation_link$/);
    await expect(loginPage.errorAlert).toHaveText(ui.login.confirmationLinkInvalid);
  });

  test("the register link goes to /register", async ({ page }) => {
    await loginPage.registerLink.click();

    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByRole("heading", { name: ui.register.heading })).toBeVisible();
  });
});
