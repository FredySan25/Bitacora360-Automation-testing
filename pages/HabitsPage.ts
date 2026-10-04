import { expect, type Locator, type Page } from "@playwright/test";
import { ui } from "../support/ui";

const text = ui.modules.habits;

type CreatedHabit = { id: string; endpoint: string; headers: Record<string, string> };

/** Daily checklist at /habits: the habit rows and the form that creates and edits them. */
export class HabitsPage {
  readonly newHabitButton: Locator;
  readonly form: Locator;
  readonly nameInput: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;
  readonly archiveButton: Locator;
  readonly deleteButton: Locator;
  readonly weekdaysAlert: Locator;
  readonly otherDaysHeading: Locator;
  readonly archivedSection: Locator;
  readonly archivedToggle: Locator;

  private readonly createdHabits: CreatedHabit[] = [];

  constructor(readonly page: Page) {
    this.newHabitButton = page.getByRole("button", { name: text.newHabit });
    // Creating and editing use the same form, and the tests open one at a time
    this.form = page.locator("form");
    this.nameInput = this.form.getByLabel(text.nameLabel);
    this.submitButton = this.form.locator('button[type="submit"]');
    this.cancelButton = this.form.getByRole("button", { name: text.cancel });
    this.archiveButton = this.form.getByRole("button", { name: text.archive });
    this.deleteButton = this.form.getByRole("button", { name: text.delete });
    this.weekdaysAlert = this.form.getByRole("alert");
    this.otherDaysHeading = page.getByRole("heading", { name: text.otherDays });
    this.archivedSection = page.locator("details");
    this.archivedToggle = this.archivedSection.locator("summary");
  }

  async goto() {
    await this.page.goto("/habits");
    // The board replaces its loading message once the habits arrive, so by then React has hydrated
    await expect(this.newHabitButton).toBeVisible();
  }

  /** Row of an active habit. Archived habits are listed apart, see `archivedRow`. */
  row(name: string): Locator {
    return this.page.getByRole("listitem").filter({ has: this.editButton(name) });
  }

  /** Only habits scheduled for the day on screen have a checkbox. */
  checkbox(name: string): Locator {
    return this.page.getByRole("checkbox", { name, exact: true });
  }

  editButton(name: string): Locator {
    return this.page.getByRole("button", { name: text.editHabit(name), exact: true });
  }

  /** Toggle of one day in the form, by its full name ("Lunes"). */
  weekday(name: string): Locator {
    return this.form.getByRole("button", { name, exact: true });
  }

  archivedRow(name: string): Locator {
    return this.archivedSection.getByRole("listitem").filter({ hasText: name });
  }

  restoreButton(name: string): Locator {
    return this.archivedRow(name).getByRole("button", { name: text.restore });
  }

  /**
   * Creates a habit through the form, leaving out the days in `skipWeekdays`,
   * and remembers it so `deleteCreatedHabits` can remove it afterwards.
   */
  async createHabit(name: string, { skipWeekdays = [] }: { skipWeekdays?: string[] } = {}) {
    await this.newHabitButton.click();
    await this.nameInput.fill(name);
    for (const day of skipWeekdays) {
      await this.weekday(day).click();
    }

    const insertResponse = this.page.waitForResponse(
      (response) =>
        response.url().includes("/rest/v1/habits") && response.request().method() === "POST",
    );
    await this.submitButton.click();

    const response = await insertResponse;
    if (!response.ok()) {
      throw new Error(
        `Supabase answered ${response.status()} creating habit "${name}": ${await response.text()}`,
      );
    }

    const request = response.request();
    const { apikey, authorization } = await request.allHeaders();
    const { origin, pathname } = new URL(request.url());
    const { id } = await response.json();
    this.createdHabits.push({ id, endpoint: origin + pathname, headers: { apikey, authorization } });
  }

  /** Checks or unchecks a habit and waits for the save: the checkbox changes before Supabase answers. */
  async toggleHabit(name: string) {
    const saveResponse = this.page.waitForResponse(
      (response) =>
        response.url().includes("/rest/v1/habit_completions") &&
        ["POST", "DELETE"].includes(response.request().method()),
    );
    await this.checkbox(name).click();
    await saveResponse;
  }

  /** Answers the next `window.confirm` and resolves to the message it showed. */
  answerNextDialog(answer: "accept" | "dismiss"): Promise<string> {
    return new Promise((resolve) => {
      this.page.once("dialog", async (dialog) => {
        const message = dialog.message();
        await (answer === "accept" ? dialog.accept() : dialog.dismiss());
        resolve(message);
      });
    });
  }

  /**
   * Deletes the habits created with `createHabit` straight through the Supabase
   * API, with the credentials of the browser session. Works no matter where the
   * test left them: renamed, archived or already deleted.
   */
  async deleteCreatedHabits() {
    for (const habit of this.createdHabits.splice(0)) {
      const response = await this.page.request.delete(`${habit.endpoint}?id=eq.${habit.id}`, {
        headers: habit.headers,
      });

      if (!response.ok()) {
        throw new Error(
          `Supabase answered ${response.status()} deleting habit ${habit.id}: ${await response.text()}`,
        );
      }
    }
  }
}
