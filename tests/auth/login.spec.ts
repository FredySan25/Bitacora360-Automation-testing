import { expect, test } from "@playwright/test";
import { LoginPage } from "../../pages/LoginPage";

test.describe("Login", () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test("muestra el formulario de inicio de sesión", async () => {
    await expect(loginPage.heading).toBeVisible();
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toHaveText("Entrar");
    await expect(loginPage.registerLink).toBeVisible();
  });

  test("rechaza credenciales incorrectas", async ({ page }) => {
    await loginPage.login("no-existe@bitacora360.test", "clave-incorrecta");

    await expect(loginPage.errorAlert).toHaveText("Email o contraseña incorrectos.");
    await expect(page).toHaveURL(/\/login$/);
    // The form is usable again after the error
    await expect(loginPage.submitButton).toBeEnabled();
  });

  test("no envía el formulario con los campos vacíos", async ({ page }) => {
    await loginPage.submitButton.click();

    const emailMissing = await loginPage.emailInput.evaluate(
      (el: HTMLInputElement) => el.validity.valueMissing,
    );
    expect(emailMissing).toBe(true);
    await expect(loginPage.errorAlert).toBeHidden();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("no acepta un email con formato inválido", async ({ page }) => {
    await loginPage.login("esto-no-es-un-email", "cualquier-clave");

    const typeMismatch = await loginPage.emailInput.evaluate(
      (el: HTMLInputElement) => el.validity.typeMismatch,
    );
    expect(typeMismatch).toBe(true);
    await expect(loginPage.errorAlert).toBeHidden();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("permite mostrar y ocultar la contraseña", async () => {
    await loginPage.passwordInput.fill("secreto123");
    await expect(loginPage.passwordInput).toHaveAttribute("type", "password");

    await loginPage.passwordToggle.click();
    await expect(loginPage.passwordInput).toHaveAttribute("type", "text");
    await expect(loginPage.passwordToggle).toHaveAttribute("aria-pressed", "true");
    await expect(loginPage.passwordInput).toHaveValue("secreto123");

    await loginPage.passwordToggle.click();
    await expect(loginPage.passwordInput).toHaveAttribute("type", "password");
  });

  test("el enlace de registro lleva a /register", async ({ page }) => {
    await loginPage.registerLink.click();

    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByRole("heading", { name: "Crear cuenta" })).toBeVisible();
  });
});
