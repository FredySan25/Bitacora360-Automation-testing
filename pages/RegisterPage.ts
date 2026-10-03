import type { Locator, Page } from "@playwright/test";
import { waitForHydration } from "../support/hydration";

export class RegisterPage {
  readonly form: Locator;
  readonly heading: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorAlert: Locator;
  readonly loginLink: Locator;
  readonly confirmationHeading: Locator;
  readonly goToLoginLink: Locator;

  constructor(readonly page: Page) {
    this.form = page.locator("form");
    this.heading = page.getByRole("heading", { name: "Crear cuenta" });
    this.emailInput = page.getByLabel("Email");
    this.passwordInput = page.getByLabel("Contraseña", { exact: true });
    this.submitButton = this.form.locator('button[type="submit"]');
    this.errorAlert = this.form.getByRole("alert");
    this.loginLink = page.getByRole("link", { name: "Inicia sesión" });
    this.confirmationHeading = page.getByRole("heading", { name: "Revisa tu email" });
    this.goToLoginLink = page.getByRole("link", { name: "Ir a iniciar sesión" });
  }

  async goto() {
    await this.page.goto("/register");
    await waitForHydration(this.form);
  }

  async register(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  /**
   * Answers the Supabase signup call with a canned response, so the tests
   * neither create real users nor send confirmation emails.
   */
  async mockSignup(status: number, body: Record<string, unknown>) {
    await this.page.route("**/auth/v1/signup*", (route) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify(body),
      }),
    );
  }
}
