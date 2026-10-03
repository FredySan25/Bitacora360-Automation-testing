import type { Locator, Page } from "@playwright/test";
import { waitForHydration } from "../support/hydration";

export class LoginPage {
  readonly form: Locator;
  readonly heading: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly passwordToggle: Locator;
  readonly submitButton: Locator;
  readonly errorAlert: Locator;
  readonly registerLink: Locator;

  constructor(readonly page: Page) {
    this.form = page.locator("form");
    this.heading = page.getByRole("heading", { name: "Iniciar sesión" });
    this.emailInput = page.getByLabel("Email");
    // exact: the show/hide toggle is also labelled "... contraseña"
    this.passwordInput = page.getByLabel("Contraseña", { exact: true });
    this.passwordToggle = page.getByRole("button", { name: /(Mostrar|Ocultar) contraseña/ });
    this.submitButton = this.form.locator('button[type="submit"]');
    // scoped to the form: Next.js adds its own role="alert" route announcer
    this.errorAlert = this.form.getByRole("alert");
    this.registerLink = page.getByRole("link", { name: "Regístrate" });
  }

  async goto() {
    await this.page.goto("/login");
    await waitForHydration(this.form);
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
