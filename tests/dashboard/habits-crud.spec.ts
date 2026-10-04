import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { HabitsPage } from "../../pages/HabitsPage";
import { ui } from "../../support/ui";

const habits = ui.modules.habits;

// The dashboard specs run in parallel against the same test user, so every
// test works on a habit of its own and only looks at that habit's row
function newHabitName(): string {
  return `E2E habit ${randomBytes(4).toString("hex")}`;
}

test.describe("Habits CRUD", () => {
  const today = habits.weekdays[new Date().getDay()];

  let habitsPage: HabitsPage;
  let name: string;

  test.beforeEach(async ({ page }) => {
    habitsPage = new HabitsPage(page);
    name = newHabitName();
    await habitsPage.goto();
  });

  test.afterEach(async () => {
    await habitsPage.deleteCreatedHabits();
  });

  test("creates a habit scheduled for every day", async () => {
    await habitsPage.createHabit(name);

    // The form closes and the habit is ready to be checked off
    await expect(habitsPage.newHabitButton).toBeVisible();
    await expect(habitsPage.row(name)).toContainText(habits.everyDay);
    await expect(habitsPage.checkbox(name)).not.toBeChecked();

    // It was saved, not just shown
    await habitsPage.goto();
    await expect(habitsPage.row(name)).toBeVisible();
  });

  test("a habit that skips today is listed without a checkbox", async () => {
    await habitsPage.createHabit(name, { skipWeekdays: [today] });

    await expect(habitsPage.otherDaysHeading).toBeVisible();
    await expect(habitsPage.row(name)).toBeVisible();
    await expect(habitsPage.checkbox(name)).toBeHidden();
  });

  test("does not create a habit without a name", async () => {
    await habitsPage.newHabitButton.click();
    await expect(habitsPage.submitButton).toHaveText(habits.createSubmit);

    await habitsPage.submitButton.click();

    const nameMissing = await habitsPage.nameInput.evaluate(
      (el: HTMLInputElement) => el.validity.valueMissing,
    );
    expect(nameMissing).toBe(true);
    await expect(habitsPage.form).toBeVisible();
  });

  test("does not create a habit with no weekdays", async () => {
    await habitsPage.newHabitButton.click();
    await habitsPage.nameInput.fill(name);
    for (const day of habits.weekdays) {
      await habitsPage.weekday(day).click();
    }

    await expect(habitsPage.weekdaysAlert).toHaveText(habits.noWeekdays);

    await habitsPage.submitButton.click();

    await expect(habitsPage.form).toBeVisible();
    await expect(habitsPage.row(name)).toBeHidden();
  });

  test("checks a habit off and unchecks it", async () => {
    await habitsPage.createHabit(name);

    await habitsPage.toggleHabit(name);
    await expect(habitsPage.checkbox(name)).toBeChecked();
    await expect(habitsPage.row(name)).toContainText(habits.streak(1));

    // The completion was saved, not just shown
    await habitsPage.goto();
    await expect(habitsPage.checkbox(name)).toBeChecked();

    await habitsPage.toggleHabit(name);
    await expect(habitsPage.checkbox(name)).not.toBeChecked();
    await expect(habitsPage.row(name)).not.toContainText(habits.streak(1));
  });

  test("edits the name and the days of a habit", async () => {
    const renamed = `${name} edited`;
    await habitsPage.createHabit(name);

    await habitsPage.editButton(name).click();
    await expect(habitsPage.nameInput).toHaveValue(name);
    await expect(habitsPage.submitButton).toHaveText(habits.saveSubmit);

    await habitsPage.nameInput.fill(renamed);
    await habitsPage.weekday(today).click();
    await habitsPage.submitButton.click();

    await expect(habitsPage.row(renamed)).toBeVisible();
    await expect(habitsPage.row(name)).toBeHidden();
    // Today is no longer one of its days
    await expect(habitsPage.checkbox(renamed)).toBeHidden();

    await habitsPage.goto();
    await expect(habitsPage.row(renamed)).toBeVisible();
    await expect(habitsPage.checkbox(renamed)).toBeHidden();
  });

  test("cancelling the edit keeps the habit as it was", async () => {
    await habitsPage.createHabit(name);

    await habitsPage.editButton(name).click();
    await habitsPage.nameInput.fill(`${name} edited`);
    await habitsPage.cancelButton.click();

    await expect(habitsPage.form).toBeHidden();
    await expect(habitsPage.row(name)).toBeVisible();
  });

  test("archives a habit and restores it", async () => {
    await habitsPage.createHabit(name);

    await habitsPage.editButton(name).click();
    await habitsPage.archiveButton.click();
    await habitsPage.archivedToggle.click();

    await expect(habitsPage.archivedRow(name)).toBeVisible();
    await expect(habitsPage.row(name)).toBeHidden();

    await habitsPage.restoreButton(name).click();

    await expect(habitsPage.row(name)).toBeVisible();
    await expect(habitsPage.archivedRow(name)).toBeHidden();
  });

  test("deletes a habit after confirming", async () => {
    await habitsPage.createHabit(name);
    await habitsPage.editButton(name).click();

    const confirmMessage = habitsPage.answerNextDialog("accept");
    await habitsPage.deleteButton.click();

    expect(await confirmMessage).toBe(habits.deleteConfirm(name));
    await expect(habitsPage.form).toBeHidden();
    await expect(habitsPage.row(name)).toBeHidden();

    await habitsPage.goto();
    await expect(habitsPage.row(name)).toBeHidden();
  });

  test("keeps the habit when the deletion is not confirmed", async () => {
    await habitsPage.createHabit(name);
    await habitsPage.editButton(name).click();

    const confirmMessage = habitsPage.answerNextDialog("dismiss");
    await habitsPage.deleteButton.click();
    await confirmMessage;

    await habitsPage.goto();
    await expect(habitsPage.row(name)).toBeVisible();
  });
});
