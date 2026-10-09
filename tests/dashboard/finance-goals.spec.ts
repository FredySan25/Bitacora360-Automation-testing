import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { type GoalCard, GoalsPage } from "../../pages/GoalsPage";
import { currentMonthKey, todayKey } from "../../support/dates";
import { ui } from "../../support/ui";

const finance = ui.modules.finance;
const text = finance.goals;

// The dashboard specs run in parallel against the same test user, and this
// screen lists every goal of the user: each test works on a goal of its own
// and only looks at that goal's card
test.describe("Finance savings goals", () => {
  let goalsPage: GoalsPage;
  let name: string;

  function newGoalName(): string {
    return `E2E goal ${randomBytes(4).toString("hex")}`;
  }

  /** Checks the open list of contributions of a goal, top to bottom. The days are "2026-10-08" keys. */
  async function expectContributions(card: GoalCard, expected: { day: string; amount: number }[]) {
    await expect(card.contributionRows).toHaveCount(expected.length);
    for (const [index, { day, amount }] of expected.entries()) {
      const row = card.contributionRows.nth(index);
      await expect(row.getByText(ui.dates.mediumDay(day), { exact: true })).toBeVisible();
      await expect(row.getByText(finance.money(amount), { exact: true })).toBeVisible();
    }
  }

  test.beforeEach(async ({ page }) => {
    goalsPage = new GoalsPage(page);
    name = newGoalName();
    await goalsPage.goto();
  });

  test.afterEach(async () => {
    await goalsPage.deleteCreatedData();
  });

  test.describe("goals", () => {
    test("creates a goal without a deadline", async () => {
      await goalsPage.newGoalButton.click();
      await expect(goalsPage.createForm.submitButton).toHaveText(text.createSubmit);
      await goalsPage.createForm.cancelButton.click();

      const card = await goalsPage.createGoal({ name, target: 1000 });

      await expect(card.savedOf(0, 1000)).toBeVisible();
      await expect(card.remaining(1000)).toBeVisible();
      await expect(card.progressBar).toHaveAttribute("aria-valuenow", "0");
      await expect(card.progressBar).toHaveAttribute("aria-valuetext", finance.percent(0));
      await expect(card.deadline).toBeHidden();
      await expect(card.contributionsToggle).toBeHidden();
      // The card is ready for a contribution dated today, never later
      await expect(card.contributionDateInput).toHaveValue(todayKey());
      await expect(card.contributionDateInput).toHaveAttribute("max", todayKey());

      // It was saved, not just shown
      await goalsPage.goto();
      await expect(card.savedOf(0, 1000)).toBeVisible();
    });

    test("a goal with a deadline says how much to save each month", async () => {
      // Four months from now, whatever the day of the month it is today
      const deadline = `${currentMonthKey(4)}-15`;

      const card = await goalsPage.createGoal({ name, target: 1000, date: deadline });

      await expect(card.deadline).toHaveText(text.deadline(ui.dates.mediumDay(deadline)));
      await expect(card.monthlySaving(250)).toBeVisible();

      // What is already saved lowers the monthly amount
      await goalsPage.contribute(card, 400);
      await expect(card.monthlySaving(150)).toBeVisible();
    });

    test("a goal past its deadline says so until it is reached", async () => {
      const card = await goalsPage.createGoal({ name, target: 100, date: todayKey(-1) });

      await expect(card.root).toContainText(text.deadlinePassed);

      await goalsPage.contribute(card, 100);

      await expect(card.reachedBadge).toBeVisible();
      await expect(card.root).not.toContainText(text.deadlinePassed);
    });

    test("does not create a goal without a name", async () => {
      await goalsPage.newGoalButton.click();
      await goalsPage.createForm.fill({ target: 1000 });

      await goalsPage.createForm.submitButton.click();

      const nameMissing = await goalsPage.createForm.nameInput.evaluate(
        (el: HTMLInputElement) => el.validity.valueMissing,
      );
      expect(nameMissing).toBe(true);
      await expect(goalsPage.createForm.root).toBeVisible();
    });

    test("does not create a goal with a name of only spaces", async () => {
      await goalsPage.newGoalButton.click();
      await goalsPage.createForm.fill({ name: "   ", target: 1000 });

      await goalsPage.createForm.submitButton.click();

      const onlySpaces = await goalsPage.createForm.nameInput.evaluate(
        (el: HTMLInputElement) => el.validity.patternMismatch,
      );
      expect(onlySpaces).toBe(true);
      await expect(goalsPage.createForm.root).toBeVisible();
    });

    test("the name of a goal stops at 60 characters", async () => {
      const longest = name.padEnd(60, "x");
      await goalsPage.newGoalButton.click();

      await goalsPage.createForm.fill({ name: `${longest}overflow` });

      await expect(goalsPage.createForm.nameInput).toHaveAttribute("maxlength", "60");
      await expect(goalsPage.createForm.nameInput).toHaveValue(longest);
    });

    for (const [label, target, problem] of [
      ["without a target", "", "valueMissing"],
      ["with a target of 0", "0", "rangeUnderflow"],
      ["with a negative target", "-100", "rangeUnderflow"],
      ["with a target of more than two decimals", "100.555", "stepMismatch"],
    ] as const) {
      test(`does not create a goal ${label}`, async () => {
        await goalsPage.newGoalButton.click();
        await goalsPage.createForm.fill({ name, target });

        await goalsPage.createForm.submitButton.click();

        const invalid = await goalsPage.createForm.targetInput.evaluate(
          (el: HTMLInputElement, flag) => el.validity[flag],
          problem,
        );
        expect(invalid).toBe(true);
        await expect(goalsPage.createForm.root).toBeVisible();
        await expect(goalsPage.card(name).root).toBeHidden();
      });
    }

    test("cancelling the form creates nothing", async () => {
      await goalsPage.newGoalButton.click();
      await goalsPage.createForm.fill({ name, target: 1000 });

      await goalsPage.createForm.cancelButton.click();

      await expect(goalsPage.createForm.root).toBeHidden();
      await expect(goalsPage.card(name).root).toBeHidden();

      await goalsPage.goto();
      await expect(goalsPage.card(name).root).toBeHidden();
    });

    test("edits the name, the target and the deadline, and keeps what was saved", async () => {
      const renamed = newGoalName();
      const deadline = `${currentMonthKey(4)}-15`;
      const card = await goalsPage.createGoal({ name, target: 1000 });
      await goalsPage.contribute(card, 250);

      await card.editButton.click();

      // The form starts with what was saved
      const form = goalsPage.editForm;
      await expect(form.submitButton).toHaveText(finance.saveSubmit);
      await expect(form.nameInput).toHaveValue(name);
      await expect(form.targetInput).toHaveValue("1000");
      await expect(form.targetDateInput).toHaveValue("");

      await form.fill({ name: renamed, target: 500, date: deadline });
      await goalsPage.saveEdit();

      const edited = goalsPage.card(renamed);
      await expect(card.root).toBeHidden();
      // The contribution is still there, now against the new target
      await expect(edited.savedOf(250, 500)).toBeVisible();
      await expect(edited.progressBar).toHaveAttribute("aria-valuenow", "50");
      await expect(edited.deadline).toHaveText(text.deadline(ui.dates.mediumDay(deadline)));

      // The change was saved, not just shown
      await goalsPage.goto();
      await expect(edited.savedOf(250, 500)).toBeVisible();
      await expect(edited.deadline).toHaveText(text.deadline(ui.dates.mediumDay(deadline)));
      await expect(card.root).toBeHidden();
    });

    test("an edit can take the deadline away", async () => {
      const card = await goalsPage.createGoal({ name, target: 1000, date: todayKey(-1) });
      await expect(card.deadline).toBeVisible();

      await card.editButton.click();
      await goalsPage.editForm.fill({ date: "" });
      await goalsPage.saveEdit();

      await expect(card.savedOf(0, 1000)).toBeVisible();
      await expect(card.deadline).toBeHidden();

      await goalsPage.goto();
      await expect(card.savedOf(0, 1000)).toBeVisible();
      await expect(card.deadline).toBeHidden();
    });

    test("cancelling the edit keeps the goal as it was", async () => {
      const card = await goalsPage.createGoal({ name, target: 1000 });

      await card.editButton.click();
      await goalsPage.editForm.fill({ name: newGoalName(), target: 5 });
      await goalsPage.editForm.cancelButton.click();

      await expect(goalsPage.editForm.root).toBeHidden();
      await expect(card.savedOf(0, 1000)).toBeVisible();

      await goalsPage.goto();
      await expect(card.savedOf(0, 1000)).toBeVisible();
    });

    test("deletes a goal after confirming in the dialog", async () => {
      const card = await goalsPage.createGoal({ name, target: 1000 });

      await card.deleteButton.click();

      const dialog = goalsPage.deleteDialog;
      await expect(dialog.title).toHaveText(text.deleteTitle(name));
      await expect(dialog.message).toHaveText(text.deleteMessage(0));

      await dialog.confirm();

      await expect(card.root).toBeHidden();

      // It was deleted, not just hidden
      await goalsPage.goto();
      await expect(card.root).toBeHidden();
    });

    test("the dialog says how many contributions go with the goal", async () => {
      const card = await goalsPage.createGoal({ name, target: 1000 });
      await goalsPage.contribute(card, 100);

      await card.deleteButton.click();
      await expect(goalsPage.deleteDialog.message).toHaveText(text.deleteMessage(1));
      await goalsPage.deleteDialog.cancel();

      await goalsPage.contribute(card, 50);
      await card.deleteButton.click();
      await expect(goalsPage.deleteDialog.message).toHaveText(text.deleteMessage(2));

      await goalsPage.deleteDialog.confirm();

      await goalsPage.goto();
      await expect(card.root).toBeHidden();
    });

    for (const [label, dismiss] of [
      ["the cancel button", "cancel"],
      ["Escape", "pressEscape"],
    ] as const) {
      test(`keeps the goal when the dialog is closed with ${label}`, async () => {
        const card = await goalsPage.createGoal({ name, target: 1000 });

        await card.deleteButton.click();
        await goalsPage.deleteDialog[dismiss]();

        await expect(card.savedOf(0, 1000)).toBeVisible();

        await goalsPage.goto();
        await expect(card.savedOf(0, 1000)).toBeVisible();
      });
    }
  });

  test.describe("contributions", () => {
    test("a contribution moves the goal forward", async () => {
      const card = await goalsPage.createGoal({ name, target: 1000 });

      await goalsPage.contribute(card, 250);

      await expect(card.savedOf(250, 1000)).toBeVisible();
      await expect(card.remaining(750)).toBeVisible();
      await expect(card.progressBar).toHaveAttribute("aria-valuenow", "25");
      await expect(card.progressBar).toHaveAttribute("aria-valuetext", finance.percent(25));
      await expect(card.reachedBadge).toBeHidden();

      // The list of contributions starts closed
      await expect(card.contributionsToggle).toHaveText(text.contributions(1));
      await expect(card.contributionRows).toBeHidden();
      await card.contributionsToggle.click();
      await expectContributions(card, [{ day: todayKey(), amount: 250 }]);

      // It was saved, not just shown
      await goalsPage.goto();
      await expect(card.savedOf(250, 1000)).toBeVisible();
      await expect(card.contributionsToggle).toHaveText(text.contributions(1));
    });

    test("a goal is only met once the whole target is saved", async () => {
      const card = await goalsPage.createGoal({ name, target: 1000 });

      await goalsPage.contribute(card, 999.99);

      // One cent short is not 100 %
      await expect(card.progressBar).toHaveAttribute("aria-valuenow", "99");
      await expect(card.remaining(0.01)).toBeVisible();
      await expect(card.reachedBadge).toBeHidden();

      await goalsPage.contribute(card, 0.01);

      await expect(card.savedOf(1000, 1000)).toBeVisible();
      await expect(card.progressBar).toHaveAttribute("aria-valuenow", "100");
      await expect(card.reachedBadge).toBeVisible();
      await expect(card.remaining(0)).toBeHidden();

      // Saving past the target keeps the bar at 100
      await goalsPage.contribute(card, 50);

      await expect(card.savedOf(1050, 1000)).toBeVisible();
      await expect(card.progressBar).toHaveAttribute("aria-valuenow", "100");
      await expect(card.reachedBadge).toBeVisible();

      await goalsPage.goto();
      await expect(card.savedOf(1050, 1000)).toBeVisible();
      await expect(card.reachedBadge).toBeVisible();
    });

    test("lists the contributions of the latest day first", async () => {
      const [today, yesterday] = [todayKey(), todayKey(-1)];
      const card = await goalsPage.createGoal({ name, target: 1000 });
      await goalsPage.contribute(card, 100);
      await goalsPage.contribute(card, 50, yesterday);
      // The form keeps the day it was given, so the next one says its own
      await goalsPage.contribute(card, 25, today);

      await card.contributionsToggle.click();

      // On the same day, the last one registered goes first
      const listed = [
        { day: today, amount: 25 },
        { day: today, amount: 100 },
        { day: yesterday, amount: 50 },
      ];
      await expectContributions(card, listed);
      await expect(card.savedOf(175, 1000)).toBeVisible();

      // Supabase returns them in the same order
      await goalsPage.goto();
      await card.contributionsToggle.click();
      await expectContributions(card, listed);
    });

    for (const [label, amount, problem] of [
      ["without an amount", "", "valueMissing"],
      ["of 0", "0", "rangeUnderflow"],
      ["with a negative amount", "-10", "rangeUnderflow"],
    ] as const) {
      test(`does not add a contribution ${label}`, async () => {
        const card = await goalsPage.createGoal({ name, target: 1000 });
        await card.contributionInput.fill(amount);

        await card.contributeButton.click();

        const invalid = await card.contributionInput.evaluate(
          (el: HTMLInputElement, flag) => el.validity[flag],
          problem,
        );
        expect(invalid).toBe(true);
        await expect(card.savedOf(0, 1000)).toBeVisible();
        await expect(card.contributionsToggle).toBeHidden();
      });
    }

    for (const [label, day, problem] of [
      ["without a day", "", "valueMissing"],
      ["on a future day", todayKey(1), "rangeOverflow"],
    ] as const) {
      test(`does not add a contribution ${label}`, async () => {
        const card = await goalsPage.createGoal({ name, target: 1000 });
        await card.contributionInput.fill("100");
        await card.contributionDateInput.fill(day);

        await card.contributeButton.click();

        const invalid = await card.contributionDateInput.evaluate(
          (el: HTMLInputElement, flag) => el.validity[flag],
          problem,
        );
        expect(invalid).toBe(true);
        await expect(card.savedOf(0, 1000)).toBeVisible();
        await expect(card.contributionsToggle).toBeHidden();
      });
    }

    test("removes a contribution after confirming in the dialog", async () => {
      const today = todayKey();
      const card = await goalsPage.createGoal({ name, target: 1000 });
      await goalsPage.contribute(card, 250);
      await goalsPage.contribute(card, 100);
      await card.contributionsToggle.click();

      await card.deleteContributionButton(250, today).click();

      const dialog = goalsPage.deleteDialog;
      await expect(dialog.title).toHaveText(text.deleteContributionTitle);
      await expect(dialog.message).toHaveText(
        text.deleteContributionMessage(finance.money(250), name),
      );

      await dialog.confirm();

      await expect(card.savedOf(100, 1000)).toBeVisible();
      await expect(card.contributionsToggle).toHaveText(text.contributions(1));
      await expectContributions(card, [{ day: today, amount: 100 }]);

      // It was deleted, not just hidden
      await goalsPage.goto();
      await expect(card.savedOf(100, 1000)).toBeVisible();
      await expect(card.contributionsToggle).toHaveText(text.contributions(1));
    });

    test("removing the contribution that reached the target reopens the goal", async () => {
      const card = await goalsPage.createGoal({ name, target: 100 });
      await goalsPage.contribute(card, 100);
      await expect(card.reachedBadge).toBeVisible();

      await card.contributionsToggle.click();
      await card.deleteContributionButton(100, todayKey()).click();
      await goalsPage.deleteDialog.confirm();

      await expect(card.reachedBadge).toBeHidden();
      await expect(card.remaining(100)).toBeVisible();
      // Without contributions there is no list to open
      await expect(card.contributionsToggle).toBeHidden();
    });

    test("keeps the contribution when the dialog is closed without confirming", async () => {
      const card = await goalsPage.createGoal({ name, target: 1000 });
      await goalsPage.contribute(card, 250);
      await card.contributionsToggle.click();

      await card.deleteContributionButton(250, todayKey()).click();
      await goalsPage.deleteDialog.cancel();
      await expect(card.savedOf(250, 1000)).toBeVisible();

      await card.deleteContributionButton(250, todayKey()).click();
      await goalsPage.deleteDialog.pressEscape();
      await expect(card.savedOf(250, 1000)).toBeVisible();

      await goalsPage.goto();
      await expect(card.savedOf(250, 1000)).toBeVisible();
    });
  });

  test.describe("without goals, or without Supabase", () => {
    test("invites to create the first goal", async () => {
      // The other tests keep goals of the same user, so the list comes empty from a mock
      await goalsPage.mockNoGoals();

      await goalsPage.goto();

      await expect(goalsPage.emptyMessage).toBeVisible();
      await expect(goalsPage.newGoalButton).toBeVisible();
    });

    test("keeps the form open when the goal cannot be saved", async () => {
      await goalsPage.mockSaveError();
      await goalsPage.newGoalButton.click();
      await goalsPage.createForm.fill({ name, target: 1000 });

      await goalsPage.createForm.submitButton.click();

      await expect(goalsPage.alert).toHaveText(finance.saveError);
      // Nothing typed is lost
      await expect(goalsPage.createForm.nameInput).toHaveValue(name);
      await expect(goalsPage.createForm.targetInput).toHaveValue("1000");
      await expect(goalsPage.card(name).root).toBeHidden();
    });

    test("keeps the amount when the contribution cannot be saved", async () => {
      const card = await goalsPage.createGoal({ name, target: 1000 });
      await goalsPage.mockContributionError();
      await card.contributionInput.fill("250");

      await card.contributeButton.click();

      await expect(goalsPage.alert).toHaveText(finance.saveError);
      await expect(card.contributionInput).toHaveValue("250");
      await expect(card.savedOf(0, 1000)).toBeVisible();
      await expect(card.contributionsToggle).toBeHidden();
    });

    test("says that the goals could not be loaded", async () => {
      await goalsPage.mockLoadError();

      await goalsPage.open();

      await expect(goalsPage.alert).toHaveText(text.loadError);
      await expect(goalsPage.newGoalButton).toBeHidden();
    });
  });
});
