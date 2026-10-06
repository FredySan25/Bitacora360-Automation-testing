import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { HabitsPage } from "../../pages/HabitsPage";
import { ProgressPage } from "../../pages/ProgressPage";
import { ui } from "../../support/ui";

const habits = ui.modules.habits;
const progress = habits.progress;

// The headline numbers and the charts add up every habit of the test user,
// and the other specs change those in parallel: each test here creates a
// habit of its own and only reads that habit's row of the table
test.describe("Habits progress", () => {
  const today = habits.weekdays[new Date().getDay()];

  let habitsPage: HabitsPage;
  let progressPage: ProgressPage;
  let name: string;

  test.beforeEach(async ({ page }) => {
    habitsPage = new HabitsPage(page);
    progressPage = new ProgressPage(page);
    name = `E2E habit ${randomBytes(4).toString("hex")}`;
    await habitsPage.goto();
  });

  test.afterEach(async () => {
    await habitsPage.deleteCreatedHabits();
  });

  test("shows the headline numbers, the charts and the table", async () => {
    await habitsPage.createHabit(name);

    await progressPage.goto();

    for (const label of Object.values(progress.tiles)) {
      await expect(progressPage.tile(label)).toBeVisible();
    }
    for (const heading of Object.values(progress.charts)) {
      await expect(progressPage.chartHeading(heading)).toBeVisible();
    }
    await expect(progressPage.heatmap).toBeVisible();
    await expect(progressPage.row(name)).toBeVisible();
  });

  test("a new habit starts without a streak", async () => {
    await habitsPage.createHabit(name);

    await progressPage.goto();

    await expect(progressPage.currentStreak(name)).toHaveText(progress.days(0));
    await expect(progressPage.bestStreak(name)).toHaveText(progress.days(0));
    await expect(progressPage.last30Days(name)).toHaveText("0%");
  });

  test("checking a habit off today starts its streak", async () => {
    await habitsPage.createHabit(name);
    await habitsPage.toggleHabit(name);

    await progressPage.goto();

    await expect(progressPage.currentStreak(name)).toHaveText(progress.days(1));
    await expect(progressPage.bestStreak(name)).toHaveText(progress.days(1));
    // It counts from the day it was created, so today is its only scheduled day
    await expect(progressPage.last30Days(name)).toHaveText("100%");
  });

  test("a habit that skips today has nothing scheduled yet", async () => {
    await habitsPage.createHabit(name, { skipWeekdays: [today] });

    await progressPage.goto();

    await expect(progressPage.currentStreak(name)).toHaveText(progress.days(0));
    await expect(progressPage.last30Days(name)).toHaveText(progress.nothingScheduled);
  });

  test("an archived habit leaves the table", async () => {
    const archived = `${name} archived`;
    // The table needs an active habit to render at all
    await habitsPage.createHabit(name);
    await habitsPage.createHabit(archived);
    await habitsPage.editButton(archived).click();
    await habitsPage.archiveButton.click();
    await expect(habitsPage.row(archived)).toBeHidden();

    await progressPage.goto();

    await expect(progressPage.row(name)).toBeVisible();
    await expect(progressPage.row(archived)).toBeHidden();
  });
});
