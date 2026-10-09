import { expect, test } from "@playwright/test";
import { BudgetsPage, type BudgetState } from "../../pages/BudgetsPage";
import { FinancePage } from "../../pages/FinancePage";
import { addMonths, monthKey } from "../../support/dates";
import { ownYear } from "../../support/own-year";
import { ui } from "../../support/ui";

const finance = ui.modules.finance;
const text = finance.budgets;
const categories = Object.values(finance.expenseCategories);

// A budget reaches every month after the one it was created in, and deleting
// it deletes it for the whole user. That makes budgets the one thing these
// tests cannot keep to a month of their own, so:
// - this is the only spec that creates budgets, and its tests run one at a time
// - each worker sticks to one category, which keeps repeated runs of the spec
//   (--repeat-each) from stepping on each other
// - the category is cleaned before and after every test
test.describe.configure({ mode: "serial" });

test.describe("Finance budgets", () => {
  let budgetsPage: BudgetsPage;
  let financePage: FinancePage;
  /** The category this worker keeps its budgets in. */
  let category: string;
  /** Another expense category, for spending that must not count. */
  let otherCategory: string;
  /** March of a year of the test's own, so what was spent is only what the test registered. */
  let month: string;

  test.beforeEach(async ({ page }, testInfo) => {
    category = categories[testInfo.parallelIndex % categories.length];
    otherCategory = categories[(testInfo.parallelIndex + 1) % categories.length];
    const year = ownYear(testInfo);
    month = monthKey(year, 3);

    budgetsPage = new BudgetsPage(page);
    financePage = new FinancePage(page);
    await budgetsPage.goto(month);
    // What a run that was killed may have left behind: this worker's category
    // taken, or spending in this year
    const staleBudgets = await budgetsPage.deleteBudgets(category);
    const staleSpending = await financePage.deleteTransactionsOf(year);
    if (staleBudgets || staleSpending) await budgetsPage.goto(month);
  });

  test.afterEach(async () => {
    await budgetsPage.deleteBudgets(category);
    await financePage.deleteCreatedData();
  });

  /** Registers an expense in the test's month and comes back to the budgets. */
  async function spend(amount: number) {
    await financePage.goto(month);
    await financePage.createTransaction({ amount, category });
    await budgetsPage.goto(month);
  }

  test("creates a budget that starts on the month on screen", async () => {
    await budgetsPage.newBudgetButton.click();
    await expect(budgetsPage.createForm.submitButton).toHaveText(text.createSubmit);
    await expect(budgetsPage.createForm.appliesFrom(month)).toBeVisible();
    await budgetsPage.createForm.cancelButton.click();
    await expect(budgetsPage.createForm.root).toBeHidden();

    await budgetsPage.createBudget(category, 300);

    const row = budgetsPage.row(category);
    await expect(row.spentOf(0, 300)).toBeVisible();
    await expect(row.state("ok")).toBeVisible();
    await expect(row.usage(0, "ok", 300)).toBeVisible();
    await expect(row.progressBar).toHaveAttribute("aria-valuenow", "0");

    // It was saved, not just shown
    await budgetsPage.goto(month);
    await expect(row.spentOf(0, 300)).toBeVisible();
  });

  test("a category with a budget is not offered for another one", async () => {
    await budgetsPage.newBudgetButton.click();
    await expect(budgetsPage.createForm.categoryOption(category)).toHaveCount(1);
    await budgetsPage.createForm.cancelButton.click();

    await budgetsPage.createBudget(category, 300);
    await budgetsPage.newBudgetButton.click();

    await expect(budgetsPage.createForm.categoryOption(category)).toHaveCount(0);
    // The other categories are still there to choose from
    await expect(budgetsPage.createForm.categoryOption(otherCategory)).toHaveCount(1);
  });

  for (const [label, limit, problem] of [
    ["without a limit", "", "valueMissing"],
    ["with a limit of 0", "0", "rangeUnderflow"],
    ["with a negative limit", "-50", "rangeUnderflow"],
    ["with a limit of more than two decimals", "50.555", "stepMismatch"],
  ] as const) {
    test(`does not create a budget ${label}`, async () => {
      await budgetsPage.newBudgetButton.click();
      await budgetsPage.createForm.categorySelect.selectOption({ label: category });
      await budgetsPage.createForm.limitInput.fill(limit);

      await budgetsPage.createForm.submitButton.click();

      const invalid = await budgetsPage.createForm.limitInput.evaluate(
        (el: HTMLInputElement, flag) => el.validity[flag],
        problem,
      );
      expect(invalid).toBe(true);
      await expect(budgetsPage.createForm.root).toBeVisible();
      await expect(budgetsPage.row(category).root).toBeHidden();
    });
  }

  test("edits the limit of a budget", async () => {
    await budgetsPage.createBudget(category, 300);

    await budgetsPage.row(category).editButton.click();

    // The form starts with the limit, and the category is not up for change
    const form = budgetsPage.editForm;
    await expect(form.submitButton).toHaveText(finance.saveSubmit);
    await expect(form.limitInput).toHaveValue("300");
    await expect(form.categorySelect).toBeDisabled();
    await expect(form.selectedCategory).toHaveText(category);
    await form.cancelButton.click();

    await budgetsPage.editLimit(category, 450.5);

    const row = budgetsPage.row(category);
    await expect(row.spentOf(0, 450.5)).toBeVisible();

    await budgetsPage.goto(month);
    await expect(row.spentOf(0, 450.5)).toBeVisible();
  });

  test("cancelling the edit keeps the limit", async () => {
    await budgetsPage.createBudget(category, 300);

    await budgetsPage.row(category).editButton.click();
    await budgetsPage.editForm.limitInput.fill("999");
    await budgetsPage.editForm.cancelButton.click();

    await expect(budgetsPage.editForm.root).toBeHidden();
    await expect(budgetsPage.row(category).spentOf(0, 300)).toBeVisible();

    await budgetsPage.goto(month);
    await expect(budgetsPage.row(category).spentOf(0, 300)).toBeVisible();
  });

  test("opening one form closes the other, and so does changing the month", async () => {
    await budgetsPage.createBudget(category, 300);

    await budgetsPage.row(category).editButton.click();
    await expect(budgetsPage.editForm.root).toBeVisible();

    await budgetsPage.newBudgetButton.click();
    await expect(budgetsPage.createForm.root).toBeVisible();
    await expect(budgetsPage.editForm.root).toBeHidden();

    await budgetsPage.row(category).editButton.click();
    await expect(budgetsPage.editForm.root).toBeVisible();
    await expect(budgetsPage.createForm.root).toBeHidden();

    await budgetsPage.monthNav.nextButton.click();
    await expect(budgetsPage.monthNav.label(addMonths(month, 1))).toBeVisible();
    await expect(budgetsPage.editForm.root).toBeHidden();
    await expect(budgetsPage.row(category).spentOf(0, 300)).toBeVisible();
  });

  test("deletes a budget after confirming in the dialog", async () => {
    await budgetsPage.createBudget(category, 300);

    await budgetsPage.row(category).deleteButton.click();

    const dialog = budgetsPage.deleteDialog;
    await expect(dialog.title).toHaveText(text.deleteTitle(category));
    await expect(dialog.message).toHaveText(text.deleteMessage);

    await dialog.confirm();

    await expect(budgetsPage.row(category).root).toBeHidden();
    // The category is free for a new budget again
    await budgetsPage.newBudgetButton.click();
    await expect(budgetsPage.createForm.categoryOption(category)).toHaveCount(1);

    // It was deleted, not just hidden
    await budgetsPage.goto(month);
    await expect(budgetsPage.row(category).root).toBeHidden();
  });

  for (const [label, dismiss] of [
    ["the cancel button", "cancel"],
    ["Escape", "pressEscape"],
  ] as const) {
    test(`keeps the budget when the dialog is closed with ${label}`, async () => {
      await budgetsPage.createBudget(category, 300);

      await budgetsPage.row(category).deleteButton.click();
      await budgetsPage.deleteDialog[dismiss]();

      await expect(budgetsPage.row(category).spentOf(0, 300)).toBeVisible();

      await budgetsPage.goto(month);
      await expect(budgetsPage.row(category).spentOf(0, 300)).toBeVisible();
    });
  }

  // Against a limit of 100. The bar stops at 100, the text does not.
  for (const { spent, state, percent, bar, difference } of [
    { spent: 79.99, state: "ok", percent: 79, bar: 79, difference: 20.01 },
    { spent: 80, state: "warning", percent: 80, bar: 80, difference: 20 },
    { spent: 100, state: "warning", percent: 100, bar: 100, difference: 0 },
    { spent: 100.01, state: "over", percent: 101, bar: 100, difference: 0.01 },
    { spent: 250, state: "over", percent: 250, bar: 100, difference: 150 },
  ] satisfies {
    spent: number;
    state: BudgetState;
    percent: number;
    bar: number;
    difference: number;
  }[]) {
    test(`spending ${spent} of a limit of 100 leaves the budget "${state}" at ${percent} %`, async () => {
      await budgetsPage.createBudget(category, 100);

      await spend(spent);

      const row = budgetsPage.row(category);
      await expect(row.spentOf(spent, 100)).toBeVisible();
      // The state is written out, not left to the color of the bar
      await expect(row.state(state)).toBeVisible();
      await expect(row.usage(percent, state, difference)).toBeVisible();
      await expect(row.progressBar).toHaveAttribute("aria-valuenow", String(bar));
      await expect(row.progressBar).toHaveAttribute(
        "aria-valuetext",
        text.progress(finance.percent(percent), text.states[state]),
      );
    });
  }

  test("only the expenses of its category count against a budget", async () => {
    await budgetsPage.createBudget(category, 100);
    await financePage.goto(month);
    await financePage.createTransaction({ amount: 60, category: otherCategory });
    await financePage.createTransaction({ type: "income", amount: 500 });
    await financePage.createTransaction({ amount: 25, category });
    // Spending of another month is not this month's
    await financePage.createTransaction({
      amount: 40,
      category,
      date: `${addMonths(month, -1)}-15`,
    });

    await budgetsPage.goto(month);

    await expect(budgetsPage.row(category).spentOf(25, 100)).toBeVisible();
    await expect(budgetsPage.row(category).usage(25, "ok", 75)).toBeVisible();
  });

  test("a budget applies to the months after it and not to the ones before", async () => {
    await budgetsPage.createBudget(category, 300);

    await budgetsPage.goto(addMonths(month, 2));
    await expect(budgetsPage.row(category).spentOf(0, 300)).toBeVisible();

    await budgetsPage.goto(addMonths(month, -1));
    await expect(budgetsPage.row(category).root).toBeHidden();
    // So the category is still free there
    await budgetsPage.newBudgetButton.click();
    await expect(budgetsPage.createForm.categoryOption(category)).toHaveCount(1);
  });

  test("a limit changed in a later month leaves the earlier months as they were", async () => {
    const later = addMonths(month, 2);
    await budgetsPage.createBudget(category, 300);

    await budgetsPage.goto(later);
    await budgetsPage.row(category).editButton.click();
    await expect(budgetsPage.editForm.appliesFrom(later)).toBeVisible();
    await budgetsPage.editForm.cancelButton.click();
    await budgetsPage.editLimit(category, 500);
    await expect(budgetsPage.row(category).spentOf(0, 500)).toBeVisible();

    // The new limit holds from that month on
    await budgetsPage.goto(addMonths(later, 1));
    await expect(budgetsPage.row(category).spentOf(0, 500)).toBeVisible();

    // The months before keep the limit they had
    await budgetsPage.goto(addMonths(later, -1));
    await expect(budgetsPage.row(category).spentOf(0, 300)).toBeVisible();
    await budgetsPage.goto(month);
    await expect(budgetsPage.row(category).spentOf(0, 300)).toBeVisible();
  });

  test("deleting a budget removes it from every month", async () => {
    const later = addMonths(month, 2);
    await budgetsPage.createBudget(category, 300);
    await budgetsPage.goto(later);
    await budgetsPage.editLimit(category, 500);

    await budgetsPage.row(category).deleteButton.click();
    await budgetsPage.deleteDialog.confirm();

    await expect(budgetsPage.row(category).root).toBeHidden();
    await budgetsPage.goto(month);
    await expect(budgetsPage.row(category).root).toBeHidden();
  });

  test("a month without budgets says so", async () => {
    // Other budgets of the test user may reach this month, so the list comes empty from a mock
    await budgetsPage.mockNoBudgets();

    await budgetsPage.goto(month);

    await expect(budgetsPage.emptyMessage(month)).toBeVisible();
    await expect(budgetsPage.newBudgetButton).toBeVisible();
  });

  test("keeps the form open when the budget cannot be saved", async () => {
    await budgetsPage.mockSaveError();
    await budgetsPage.newBudgetButton.click();
    await budgetsPage.createForm.categorySelect.selectOption({ label: category });
    await budgetsPage.createForm.limitInput.fill("300");

    await budgetsPage.createForm.submitButton.click();

    await expect(budgetsPage.alert).toHaveText(finance.saveError);
    // Nothing typed is lost
    await expect(budgetsPage.createForm.limitInput).toHaveValue("300");
    await expect(budgetsPage.createForm.selectedCategory).toHaveText(category);
    await expect(budgetsPage.row(category).root).toBeHidden();
  });

  test("says that the budgets could not be loaded", async () => {
    await budgetsPage.mockLoadError();

    await budgetsPage.open(month);

    await expect(budgetsPage.alert).toHaveText(text.loadError);
    await expect(budgetsPage.newBudgetButton).toBeHidden();
  });
});
