import type { Page } from "@playwright/test";

/** Answers the next `window.confirm` and resolves to the message it showed. */
export function answerNextDialog(page: Page, answer: "accept" | "dismiss"): Promise<string> {
  return new Promise((resolve) => {
    page.once("dialog", async (dialog) => {
      const message = dialog.message();
      await (answer === "accept" ? dialog.accept() : dialog.dismiss());
      resolve(message);
    });
  });
}
