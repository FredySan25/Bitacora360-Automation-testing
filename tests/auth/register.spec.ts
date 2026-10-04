import { expect, test } from "@playwright/test";
import { RegisterPage } from "../../pages/RegisterPage";
import { ui } from "../../support/ui";

test.describe("Register", () => {
  let registerPage: RegisterPage;

  test.beforeEach(async ({ page }) => {
    registerPage = new RegisterPage(page);
    await registerPage.goto();
  });

  test("shows the register form", async () => {
    await expect(registerPage.heading).toBeVisible();
    await expect(registerPage.emailInput).toBeVisible();
    await expect(registerPage.passwordInput).toBeVisible();
    await expect(registerPage.page.getByText(ui.register.passwordHint)).toBeVisible();
    await expect(registerPage.submitButton).toHaveText(ui.register.submit);
  });

  test("requires a password of at least 6 characters", async ({ page }) => {
    await registerPage.register("new@bitacora360.test", "12345");

    const tooShort = await registerPage.passwordInput.evaluate(
      (el: HTMLInputElement) => el.validity.tooShort,
    );
    expect(tooShort).toBe(true);
    await expect(registerPage.confirmationHeading).toBeHidden();
    await expect(page).toHaveURL(/\/register$/);
  });

  test("shows the email confirmation after a successful signup", async () => {
    const email = "new@bitacora360.test";
    await registerPage.mockSignup(200, { id: "00000000-0000-0000-0000-000000000000", email });

    await registerPage.register(email, "secure-password-123");

    await expect(registerPage.confirmationHeading).toBeVisible();
    await expect(registerPage.page.getByText(email)).toBeVisible();
    await expect(registerPage.goToLoginLink).toHaveAttribute("href", "/login");
    await expect(registerPage.codeInput).toBeVisible();
    await expect(registerPage.submitButton).toHaveText(ui.register.verifySubmit);
  });

  test.describe("confirmation code", () => {
    const email = "new@bitacora360.test";

    test.beforeEach(async () => {
      await registerPage.mockSignup(200, { id: "00000000-0000-0000-0000-000000000000", email });
      await registerPage.register(email, "secure-password-123");
      await expect(registerPage.confirmationHeading).toBeVisible();
    });

    test("only accepts digits in the code", async () => {
      await registerPage.codeInput.fill("12ab34");

      await expect(registerPage.codeInput).toHaveValue("1234");
    });

    test("rejects a wrong or expired code", async ({ page }) => {
      await registerPage.mockVerifyCode(403, {
        code: 403,
        error_code: "otp_expired",
        msg: "Token has expired or is invalid",
      });

      await registerPage.verifyCode("123456");

      await expect(registerPage.errorAlert).toHaveText(ui.register.invalidCode);
      await expect(page).toHaveURL(/\/register$/);
      // The form is usable again after the error
      await expect(registerPage.submitButton).toBeEnabled();
    });

    test("sends the code again on request", async () => {
      await registerPage.mockResendCode(200, {});

      await registerPage.resendCodeButton.click();

      await expect(registerPage.codeResentNotice).toHaveText(ui.register.codeResent);
    });
  });

  test("warns when the email already has an account", async () => {
    await registerPage.mockSignup(422, {
      code: 422,
      error_code: "user_already_exists",
      msg: "User already registered",
    });

    await registerPage.register("existing@bitacora360.test", "secure-password-123");

    await expect(registerPage.errorAlert).toHaveText(ui.register.emailTaken);
    await expect(registerPage.confirmationHeading).toBeHidden();
  });

  test("the login link goes to /login", async ({ page }) => {
    await registerPage.loginLink.click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: ui.login.heading })).toBeVisible();
  });
});
