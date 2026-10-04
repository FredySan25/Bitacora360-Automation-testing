import type { Locator, Page } from "@playwright/test";
import { waitForHydration } from "../support/hydration";
import { ui } from "../support/ui";

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
  readonly codeInput: Locator;
  readonly resendCodeButton: Locator;
  readonly codeResentNotice: Locator;

  constructor(readonly page: Page) {
    this.form = page.locator("form");
    this.heading = page.getByRole("heading", { name: ui.register.heading });
    this.emailInput = page.getByLabel(ui.auth.emailLabel);
    this.passwordInput = page.getByLabel(ui.auth.passwordLabel, { exact: true });
    this.submitButton = this.form.locator('button[type="submit"]');
    this.errorAlert = this.form.getByRole("alert");
    this.loginLink = page.getByRole("link", { name: ui.register.loginLink });
    this.confirmationHeading = page.getByRole("heading", {
      name: ui.register.confirmationHeading,
    });
    this.goToLoginLink = page.getByRole("link", { name: ui.register.goToLoginLink });
    this.codeInput = page.getByLabel(ui.register.codeLabel);
    this.resendCodeButton = page.getByRole("button", { name: ui.register.resendCode });
    this.codeResentNotice = this.form.getByRole("status");
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

  /** Registers against the real Supabase and returns the id of the user it created. */
  async registerAndGetUserId(email: string, password: string): Promise<string> {
    const signupResponse = this.page.waitForResponse(
      (response) =>
        response.url().includes("/auth/v1/signup") && response.request().method() === "POST",
    );
    await this.register(email, password);

    const body = await (await signupResponse).json();
    return body.user?.id ?? body.id;
  }

  /** The code step replaces the signup form with its own, so the submit button is the same locator. */
  async verifyCode(code: string) {
    await this.codeInput.fill(code);
    await this.submitButton.click();
  }

  /**
   * Answers the Supabase signup call with a canned response, so the tests
   * neither create real users nor send confirmation emails.
   */
  async mockSignup(status: number, body: Record<string, unknown>) {
    await this.mockAuthCall("signup", status, body);
  }

  /** Answers the Supabase call that checks the confirmation code. */
  async mockVerifyCode(status: number, body: Record<string, unknown>) {
    await this.mockAuthCall("verify", status, body);
  }

  /** Answers the Supabase call that sends the confirmation email again. */
  async mockResendCode(status: number, body: Record<string, unknown>) {
    await this.mockAuthCall("resend", status, body);
  }

  private async mockAuthCall(endpoint: string, status: number, body: Record<string, unknown>) {
    await this.page.route(`**/auth/v1/${endpoint}*`, (route) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify(body),
      }),
    );
  }
}
