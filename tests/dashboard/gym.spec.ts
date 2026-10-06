import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { GymPage } from "../../pages/GymPage";
import { answerNextDialog } from "../../support/dialogs";
import { ui } from "../../support/ui";

const gym = ui.modules.habits.gym;

/** Day in the form of a date input ("2026-01-15"), counted from today in the local time zone. */
function dateKey(daysFromToday = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

// The dashboard specs run in parallel against the same test user, so every
// test works on a workout and an exercise of its own and only looks at those
test.describe("Gym log", () => {
  let gymPage: GymPage;
  let title: string;
  let exercise: string;

  test.beforeEach(async ({ page }) => {
    const id = randomBytes(4).toString("hex");
    title = `E2E workout ${id}`;
    exercise = `E2E exercise ${id}`;

    gymPage = new GymPage(page);
    await gymPage.goto();
  });

  test.afterEach(async () => {
    await gymPage.deleteCreatedData();
  });

  test("registers a workout for today", async () => {
    await expect(gymPage.dateInput).toHaveValue(dateKey());

    const card = await gymPage.createWorkout(title);

    await expect(card.root).toBeVisible();
    await expect(card.noSetsMessage).toBeVisible();
    // The form is ready for the next workout
    await expect(gymPage.titleInput).toHaveValue("");

    // It was saved, not just shown
    await gymPage.goto();
    await gymPage.showWorkout(title);
    await expect(card.root).toBeVisible();
  });

  test("a workout without a title gets a default one", async () => {
    const card = await gymPage.createWorkout();

    await expect(card.root.getByRole("heading", { level: 3 })).toHaveText(gym.defaultTitle);
  });

  test("does not register a workout on a future day", async () => {
    await gymPage.dateInput.fill(dateKey(1));
    await gymPage.titleInput.fill(title);

    await gymPage.createButton.click();

    const afterToday = await gymPage.dateInput.evaluate(
      (el: HTMLInputElement) => el.validity.rangeOverflow,
    );
    expect(afterToday).toBe(true);
    await expect(gymPage.cardHeading(title)).toBeHidden();
  });

  test("does not register a workout without a day", async () => {
    await gymPage.dateInput.fill("");
    await gymPage.titleInput.fill(title);

    await gymPage.createButton.click();

    const dayMissing = await gymPage.dateInput.evaluate(
      (el: HTMLInputElement) => el.validity.valueMissing,
    );
    expect(dayMissing).toBe(true);
    await expect(gymPage.cardHeading(title)).toBeHidden();
  });

  test("logs sets and groups them under their exercise", async () => {
    const card = await gymPage.createWorkout(title);

    await gymPage.addSet(card, { exercise, reps: 10, weight: 60 });

    await expect(card.exerciseHeading(exercise)).toBeVisible();
    await expect(card.set(gym.weightedSet(10, "60"))).toBeVisible();
    await expect(card.noSetsMessage).toBeHidden();
    // The form keeps the exercise, so the next set of it is one step away
    await expect(card.exerciseInput).toHaveValue(exercise);

    await gymPage.addSet(card, { exercise, reps: 8, weight: 62.5 });

    await expect(card.set(gym.weightedSet(8, "62,5"))).toBeVisible();
    await expect(card.exerciseHeading(exercise)).toHaveCount(1);

    // The sets were saved, not just shown
    await gymPage.goto();
    await gymPage.showWorkout(title);
    await expect(card.set(gym.weightedSet(10, "60"))).toBeVisible();
    await expect(card.set(gym.weightedSet(8, "62,5"))).toBeVisible();
  });

  test("a set without a weight is shown in reps only", async () => {
    const card = await gymPage.createWorkout(title);

    await gymPage.addSet(card, { exercise, reps: 12 });

    await expect(card.set(gym.bodyweightSet(12))).toBeVisible();
  });

  for (const [label, reps, problem] of [
    ["without reps", "", "valueMissing"],
    ["of 0 reps", "0", "rangeUnderflow"],
    ["of 1001 reps", "1001", "rangeOverflow"],
  ] as const) {
    test(`does not log a set ${label}`, async () => {
      const card = await gymPage.createWorkout(title);
      await card.exerciseInput.fill(exercise);
      await card.repsInput.fill(reps);

      await card.addSetButton.click();

      const invalid = await card.repsInput.evaluate(
        (el: HTMLInputElement, flag) => el.validity[flag],
        problem,
      );
      expect(invalid).toBe(true);
      await expect(card.noSetsMessage).toBeVisible();
    });
  }

  test("does not log a set without an exercise", async () => {
    const card = await gymPage.createWorkout(title);
    await card.repsInput.fill("10");

    await card.addSetButton.click();

    const exerciseMissing = await card.exerciseInput.evaluate(
      (el: HTMLInputElement) => el.validity.valueMissing,
    );
    expect(exerciseMissing).toBe(true);
    await expect(card.noSetsMessage).toBeVisible();
  });

  test("does not log a set with a negative weight", async () => {
    const card = await gymPage.createWorkout(title);
    await card.exerciseInput.fill(exercise);
    await card.repsInput.fill("10");
    await card.weightInput.fill("-5");

    await card.addSetButton.click();

    const belowZero = await card.weightInput.evaluate(
      (el: HTMLInputElement) => el.validity.rangeUnderflow,
    );
    expect(belowZero).toBe(true);
    await expect(card.noSetsMessage).toBeVisible();
  });

  test("deletes a set", async () => {
    const set = gym.weightedSet(10, "60");
    const card = await gymPage.createWorkout(title);
    await gymPage.addSet(card, { exercise, reps: 10, weight: 60 });

    await card.deleteSetButton(set).click();

    await expect(card.set(set)).toBeHidden();
    await expect(card.noSetsMessage).toBeVisible();

    await gymPage.goto();
    await gymPage.showWorkout(title);
    await expect(card.noSetsMessage).toBeVisible();
  });

  test("deletes a workout with sets after confirming", async ({ page }) => {
    const card = await gymPage.createWorkout(title);
    await gymPage.addSet(card, { exercise, reps: 10, weight: 60 });

    const confirmMessage = answerNextDialog(page, "accept");
    await card.deleteButton.click();

    expect(await confirmMessage).toBe(gym.deleteWorkoutConfirm);
    await expect(card.root).toBeHidden();

    await gymPage.goto();
    await gymPage.showAllWorkouts();
    await expect(card.root).toBeHidden();
  });

  test("keeps the workout when the deletion is not confirmed", async ({ page }) => {
    const card = await gymPage.createWorkout(title);
    await gymPage.addSet(card, { exercise, reps: 10, weight: 60 });

    const confirmMessage = answerNextDialog(page, "dismiss");
    await card.deleteButton.click();
    await confirmMessage;

    await gymPage.goto();
    await gymPage.showWorkout(title);
    await expect(card.set(gym.weightedSet(10, "60"))).toBeVisible();
  });

  test("deletes a workout without sets without asking", async () => {
    const card = await gymPage.createWorkout(title);

    // Playwright dismisses a dialog nobody listens for, which would keep the workout
    await card.deleteButton.click();

    await expect(card.root).toBeHidden();

    await gymPage.goto();
    await gymPage.showAllWorkouts();
    await expect(card.root).toBeHidden();
  });

  test("shows the best mark of an exercise", async () => {
    const card = await gymPage.createWorkout(title);
    await gymPage.addSet(card, { exercise, reps: 10, weight: 60 });
    await gymPage.addSet(card, { exercise, reps: 5, weight: 80 });

    await gymPage.progressExerciseSelect.selectOption({ label: exercise });

    // The heaviest set of the day is the one plotted
    await expect(gymPage.progressReadout).toContainText(gym.weightedSet(5, "80"));
    await expect(gymPage.progressReadout).toContainText(gym.bestMark("80 kg"));
  });

  test("the progress of a bodyweight exercise is measured in reps", async () => {
    const card = await gymPage.createWorkout(title);
    await gymPage.addSet(card, { exercise, reps: 12 });
    await gymPage.addSet(card, { exercise, reps: 15 });

    await gymPage.progressExerciseSelect.selectOption({ label: exercise });

    await expect(gymPage.progressReadout).toContainText(gym.bestMark("15 reps"));
  });
});
