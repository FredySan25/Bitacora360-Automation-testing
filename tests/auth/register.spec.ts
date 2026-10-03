import { expect, test } from "@playwright/test";
import { RegisterPage } from "../../pages/RegisterPage";

test.describe("Registro", () => {
  let registerPage: RegisterPage;

  test.beforeEach(async ({ page }) => {
    registerPage = new RegisterPage(page);
    await registerPage.goto();
  });

  test("muestra el formulario de registro", async () => {
    await expect(registerPage.heading).toBeVisible();
    await expect(registerPage.emailInput).toBeVisible();
    await expect(registerPage.passwordInput).toBeVisible();
    await expect(registerPage.page.getByText("Mínimo 6 caracteres.")).toBeVisible();
    await expect(registerPage.submitButton).toHaveText("Crear cuenta");
  });

  test("exige una contraseña de al menos 6 caracteres", async ({ page }) => {
    await registerPage.register("nuevo@bitacora360.test", "12345");

    const tooShort = await registerPage.passwordInput.evaluate(
      (el: HTMLInputElement) => el.validity.tooShort,
    );
    expect(tooShort).toBe(true);
    await expect(registerPage.confirmationHeading).toBeHidden();
    await expect(page).toHaveURL(/\/register$/);
  });

  test("muestra la confirmación por email tras un registro exitoso", async () => {
    const email = "nuevo@bitacora360.test";
    await registerPage.mockSignup(200, { id: "00000000-0000-0000-0000-000000000000", email });

    await registerPage.register(email, "clave-segura-123");

    await expect(registerPage.confirmationHeading).toBeVisible();
    await expect(registerPage.page.getByText(email)).toBeVisible();
    await expect(registerPage.goToLoginLink).toHaveAttribute("href", "/login");
  });

  test("avisa cuando el email ya tiene una cuenta", async () => {
    await registerPage.mockSignup(422, {
      code: 422,
      error_code: "user_already_exists",
      msg: "User already registered",
    });

    await registerPage.register("existente@bitacora360.test", "clave-segura-123");

    await expect(registerPage.errorAlert).toHaveText("Ya existe una cuenta con ese email.");
    await expect(registerPage.confirmationHeading).toBeHidden();
  });

  test("el enlace de inicio de sesión lleva a /login", async ({ page }) => {
    await registerPage.loginLink.click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
  });
});
