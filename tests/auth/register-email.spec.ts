import { expect, test } from "@playwright/test";
import { DashboardShell } from "../../pages/DashboardShell";
import { RegisterPage } from "../../pages/RegisterPage";
import { hasMailsac } from "../../support/env";
import { newInboxAddress, waitForConfirmationEmail } from "../../support/mailsac";
import { deleteUser, hasSupabaseAdmin } from "../../support/supabase-admin";
import { ui } from "../../support/ui";

// Unlike register.spec.ts, nothing is mocked here: Supabase creates a real user
// and sends a real email, which the tests read from a Mailsac inbox.
test.describe("Register with a real confirmation email", () => {
  test.skip(!hasMailsac(), "Requires MAILSAC_API_KEY in .env");

  let registerPage: RegisterPage;
  let email: string;
  let userId: string | undefined;

  test.beforeEach(async ({ page }) => {
    // The email can take a while to reach the inbox
    test.setTimeout(120_000);

    registerPage = new RegisterPage(page);
    email = newInboxAddress();
    userId = undefined;

    await registerPage.goto();
    userId = await registerPage.registerAndGetUserId(email, "secure-password-123");
    await expect(registerPage.confirmationHeading).toBeVisible();
  });

  test.afterEach(async () => {
    if (userId && hasSupabaseAdmin()) {
      await deleteUser(userId);
    }
  });

  test("confirms the account with the code from the email", async ({ page }) => {
    const { code } = await waitForConfirmationEmail(email);

    await registerPage.verifyCode(code);

    await expect(page).toHaveURL(/\/today$/);
    await expect(new DashboardShell(page).pageTitle(ui.modules.today.title)).toBeVisible();
  });

  test("confirms the account with the link from the email", async ({ page }) => {
    const { link } = await waitForConfirmationEmail(email);

    // The link points to the Site URL of the Supabase project; following only
    // its path keeps the test on the app under test
    const { pathname, search } = new URL(link);
    await page.goto(pathname + search);

    await expect(page).toHaveURL(/\/today$/);
    await expect(new DashboardShell(page).pageTitle(ui.modules.today.title)).toBeVisible();
  });
});
