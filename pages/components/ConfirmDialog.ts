import { expect, type Locator, type Page } from "@playwright/test";
import { ui } from "../../support/ui";

/**
 * The modal the app opens before a destructive action. It is a native
 * `<dialog>` and not a `window.confirm`, so `answerNextDialog` does not see it.
 */
export class ConfirmDialog {
  readonly root: Locator;
  readonly title: Locator;
  readonly message: Locator;
  readonly cancelButton: Locator;
  readonly confirmButton: Locator;

  /** `confirmLabel` is the text of the button that goes ahead with the action. */
  constructor(page: Page, confirmLabel: string) {
    this.root = page.getByRole("dialog");
    this.title = this.root.getByRole("heading");
    this.message = this.root.getByRole("paragraph");
    this.cancelButton = this.root.getByRole("button", { name: ui.dialog.cancel, exact: true });
    this.confirmButton = this.root.getByRole("button", { name: confirmLabel, exact: true });
  }

  /** Goes ahead. The modal only closes once Supabase has answered. */
  async confirm() {
    await this.confirmButton.click();
    await expect(this.root).toBeHidden();
  }

  async cancel() {
    await this.cancelButton.click();
    await expect(this.root).toBeHidden();
  }

  /** Escape cancels, like the button. */
  async pressEscape() {
    await this.root.press("Escape");
    await expect(this.root).toBeHidden();
  }
}
