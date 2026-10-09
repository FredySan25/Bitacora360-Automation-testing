import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { FinancePage } from "../../pages/FinancePage";
import { addMonths, lastDayOf, monthKey, todayKey } from "../../support/dates";
import { ownYear } from "../../support/own-year";
import { ui } from "../../support/ui";

const finance = ui.modules.finance;
const text = finance.transactions;
const expenses = finance.expenseCategories;
const incomes = finance.incomeCategories;

// The dashboard specs run in parallel against the same test user, and this view
// adds up a whole month. Every test works in March of a year of its own, so the
// rows and the totals on screen are only the ones it registered
test.describe("Finance transactions", () => {
  let financePage: FinancePage;
  let month: string;
  let previousMonth: string;
  let note: string;

  /** A day of the test's month. */
  function day(dayOfMonth: number): string {
    return `${month}-${String(dayOfMonth).padStart(2, "0")}`;
  }

  /** A note no other transaction has, so a test can tell several rows apart. */
  function newNote(): string {
    return `E2E ${randomBytes(4).toString("hex")}`;
  }

  async function expectTotals(totals: { income: number; expenses: number; balance: number }) {
    await expect(financePage.cards.income.value).toHaveText(finance.money(totals.income));
    await expect(financePage.cards.expenses.value).toHaveText(finance.money(totals.expenses));
    await expect(financePage.cards.balance.value).toHaveText(finance.money(totals.balance));
  }

  test.beforeEach(async ({ page }, testInfo) => {
    const year = ownYear(testInfo);
    month = monthKey(year, 3);
    previousMonth = addMonths(month, -1);
    note = newNote();

    financePage = new FinancePage(page);
    await financePage.gotoOwnMonth(month);
  });

  test.afterEach(async () => {
    await financePage.deleteCreatedData();
  });

  test.describe("registering", () => {
    test("registers an expense in the month on screen", async () => {
      await financePage.createTransaction({ amount: 45.5, category: expenses.food, note });

      const row = financePage.row(note);
      await expect(row.category(expenses.food)).toBeVisible();
      // Without a date it lands on the last day of the month on screen
      await expect(row.detail(lastDayOf(month), note)).toBeVisible();
      await expect(row.amount("expense", 45.5)).toBeVisible();
      await expectTotals({ income: 0, expenses: 45.5, balance: -45.5 });

      // It was saved, not just shown
      await financePage.goto(month);
      await expect(row.amount("expense", 45.5)).toBeVisible();
      await expectTotals({ income: 0, expenses: 45.5, balance: -45.5 });
    });

    test("registers an income", async () => {
      await financePage.createTransaction({
        type: "income",
        amount: 1200,
        category: incomes.salary,
        date: day(15),
        note,
      });

      const row = financePage.row(note);
      await expect(row.category(incomes.salary)).toBeVisible();
      await expect(row.detail(day(15), note)).toBeVisible();
      await expect(row.amount("income", 1200)).toBeVisible();
      await expectTotals({ income: 1200, expenses: 0, balance: 1200 });

      await financePage.goto(month);
      await expect(row.amount("income", 1200)).toBeVisible();
    });

    test("lists the latest day first and, within a day, the last one registered", async () => {
      const [early, late, earlyAgain] = [newNote(), newNote(), newNote()];
      await financePage.createTransaction({ amount: 10, date: day(10), note: early });
      await financePage.createTransaction({ amount: 20, date: day(20), note: late });
      await financePage.createTransaction({ amount: 30, date: day(10), note: earlyAgain });

      await expect(financePage.rows).toHaveCount(3);
      await expect(financePage.rows).toContainText([late, earlyAgain, early]);

      // Supabase returns them in the same order
      await financePage.goto(month);
      await expect(financePage.rows).toHaveCount(3);
      await expect(financePage.rows).toContainText([late, earlyAgain, early]);
    });

    test("a new transaction in a past month starts on its last day", async () => {
      await financePage.newTransactionButton.click();

      const form = financePage.createForm;
      await expect(form.submitButton).toHaveText(text.createSubmit);
      await expect(form.typeOption("expense")).toBeChecked();
      await expect(form.selectedCategory).toHaveText(expenses.food);
      await expect(form.dateInput).toHaveValue(lastDayOf(month));
      // A future day is never offered, whatever the month on screen
      await expect(form.dateInput).toHaveAttribute("max", todayKey());
    });

    test("a new transaction in the current month starts on today", async () => {
      await financePage.goto();

      await financePage.newTransactionButton.click();

      await expect(financePage.createForm.dateInput).toHaveValue(todayKey());
    });

    test("the categories on offer follow the type", async () => {
      await financePage.newTransactionButton.click();
      const form = financePage.createForm;

      await expect(form.categoryOptions).toHaveText(Object.values(expenses));

      await form.typeOption("income").check();

      await expect(form.categoryOptions).toHaveText(Object.values(incomes));
      // Income has no "Comida", so the choice moves to its first category
      await expect(form.selectedCategory).toHaveText(incomes.salary);

      // Both types have "Otros", and that choice survives the change
      await form.categorySelect.selectOption({ label: incomes.other });
      await form.typeOption("expense").check();

      await expect(form.categoryOptions).toHaveText(Object.values(expenses));
      await expect(form.selectedCategory).toHaveText(expenses.other);
    });

    test("a transaction dated in another month says where it was saved", async () => {
      await financePage.createTransaction({ amount: 80, date: lastDayOf(previousMonth), note });

      await expect(financePage.savedElsewhereNotice).toHaveText(
        text.savedElsewhere(ui.dates.monthYear(previousMonth)),
      );
      await expect(financePage.emptyMessage(month)).toBeVisible();
      await expectTotals({ income: 0, expenses: 0, balance: 0 });

      await financePage.monthNav.previousButton.click();

      await expect(financePage.row(note).amount("expense", 80)).toBeVisible();
      await expect(financePage.savedElsewhereNotice).toBeHidden();
    });

    test("cancelling the form registers nothing", async () => {
      await financePage.newTransactionButton.click();
      await financePage.createForm.fill({ amount: 45.5, note });

      await financePage.createForm.cancelButton.click();

      await expect(financePage.createForm.root).toBeHidden();
      await expect(financePage.newTransactionButton).toBeVisible();
      await expect(financePage.emptyMessage(month)).toBeVisible();

      await financePage.goto(month);
      await expect(financePage.emptyMessage(month)).toBeVisible();
    });

    test("changing the month closes the form, whose day belonged to the month before", async () => {
      await financePage.newTransactionButton.click();
      await financePage.createForm.fill({ amount: 45.5, note });

      await financePage.monthNav.previousButton.click();

      await expect(financePage.createForm.root).toBeHidden();
      await expect(financePage.newTransactionButton).toBeVisible();
    });
  });

  test.describe("validation", () => {
    for (const [label, amount, problem] of [
      ["without an amount", "", "valueMissing"],
      ["of 0", "0", "rangeUnderflow"],
      ["with a negative amount", "-5", "rangeUnderflow"],
      ["with more than two decimals", "10.555", "stepMismatch"],
      ["above the largest amount the app stores", "10000000000", "rangeOverflow"],
    ] as const) {
      test(`does not register a transaction ${label}`, async () => {
        await financePage.newTransactionButton.click();
        await financePage.createForm.fill({ amount, note });

        await financePage.createForm.submitButton.click();

        const invalid = await financePage.createForm.amountInput.evaluate(
          (el: HTMLInputElement, flag) => el.validity[flag],
          problem,
        );
        expect(invalid).toBe(true);
        await expect(financePage.createForm.root).toBeVisible();
        await expect(financePage.emptyMessage(month)).toBeVisible();
      });
    }

    for (const [label, date, problem] of [
      ["without a day", "", "valueMissing"],
      ["on a future day", todayKey(1), "rangeOverflow"],
    ] as const) {
      test(`does not register a transaction ${label}`, async () => {
        await financePage.newTransactionButton.click();
        await financePage.createForm.fill({ amount: 10, date, note });

        await financePage.createForm.submitButton.click();

        const invalid = await financePage.createForm.dateInput.evaluate(
          (el: HTMLInputElement, flag) => el.validity[flag],
          problem,
        );
        expect(invalid).toBe(true);
        await expect(financePage.createForm.root).toBeVisible();
        await expect(financePage.emptyMessage(month)).toBeVisible();
      });
    }

    test("a note stops at 200 characters", async () => {
      const longest = note.padEnd(200, "x");
      await financePage.newTransactionButton.click();

      await financePage.createForm.fill({ amount: 10, note: `${longest}overflow` });

      await expect(financePage.createForm.noteInput).toHaveAttribute("maxlength", "200");
      await expect(financePage.createForm.noteInput).toHaveValue(longest);

      // A note of exactly 200 characters is saved whole
      await financePage.submitNewTransaction();
      await financePage.goto(month);
      await expect(financePage.rowAt(0).detail(lastDayOf(month), longest)).toBeVisible();
    });

    test("a note of only spaces is saved as no note", async () => {
      await financePage.createTransaction({ amount: 10, note: "   " });

      const row = financePage.rowAt(0);
      await expect(financePage.rows).toHaveCount(1);
      // The day stands alone, without the separator a note brings
      await expect(row.detail(lastDayOf(month))).toBeVisible();

      await financePage.goto(month);
      await expect(row.detail(lastDayOf(month))).toBeVisible();
      await row.editButton.click();
      await expect(financePage.editForm.noteInput).toHaveValue("");
    });

    test("the spaces around a note are left out", async () => {
      await financePage.createTransaction({ amount: 10, note: `  ${note}  ` });

      await financePage.goto(month);
      await financePage.row(note).editButton.click();

      await expect(financePage.editForm.noteInput).toHaveValue(note);
    });
  });

  test.describe("editing", () => {
    test("edits the type, the amount, the category, the day and the note", async () => {
      const edited = newNote();
      await financePage.createTransaction({
        amount: 45.5,
        category: expenses.transport,
        date: day(10),
        note,
      });

      await financePage.row(note).editButton.click();

      // The form starts with what was saved
      const form = financePage.editForm;
      await expect(form.submitButton).toHaveText(finance.saveSubmit);
      await expect(form.typeOption("expense")).toBeChecked();
      await expect(form.amountInput).toHaveValue("45.5");
      await expect(form.selectedCategory).toHaveText(expenses.transport);
      await expect(form.dateInput).toHaveValue(day(10));
      await expect(form.noteInput).toHaveValue(note);

      await form.typeOption("income").check();
      // The categories are now the ones of an income
      await expect(form.categoryOptions).toHaveText(Object.values(incomes));
      await form.fill({ amount: 1250.5, category: incomes.freelance, date: day(20), note: edited });
      await financePage.saveEdit();

      const row = financePage.row(edited);
      await expect(financePage.rows).toHaveCount(1);
      await expect(row.category(incomes.freelance)).toBeVisible();
      await expect(row.detail(day(20), edited)).toBeVisible();
      await expect(row.amount("income", 1250.5)).toBeVisible();
      await expectTotals({ income: 1250.5, expenses: 0, balance: 1250.5 });

      // The change was saved, not just shown
      await financePage.goto(month);
      await expect(financePage.rows).toHaveCount(1);
      await expect(row.category(incomes.freelance)).toBeVisible();
      await expect(row.detail(day(20), edited)).toBeVisible();
      await expect(row.amount("income", 1250.5)).toBeVisible();
    });

    test("cancelling the edit keeps the transaction as it was", async () => {
      await financePage.createTransaction({ amount: 45.5, note });

      await financePage.row(note).editButton.click();
      await financePage.editForm.fill({ amount: 999 });
      await financePage.editForm.cancelButton.click();

      await expect(financePage.editForm.root).toBeHidden();
      await expect(financePage.row(note).amount("expense", 45.5)).toBeVisible();

      await financePage.goto(month);
      await expect(financePage.row(note).amount("expense", 45.5)).toBeVisible();
    });

    test("a transaction moved to another month leaves the list", async () => {
      await financePage.createTransaction({ amount: 45.5, date: day(10), note });

      await financePage.row(note).editButton.click();
      await financePage.editForm.fill({ amount: 45.5, date: lastDayOf(previousMonth) });
      await financePage.saveEdit();

      await expect(financePage.savedElsewhereNotice).toHaveText(
        text.savedElsewhere(ui.dates.monthYear(previousMonth)),
      );
      await expect(financePage.emptyMessage(month)).toBeVisible();
      await expectTotals({ income: 0, expenses: 0, balance: 0 });

      await financePage.goto(previousMonth);
      await expect(financePage.row(note).detail(lastDayOf(previousMonth), note)).toBeVisible();
    });

    test("does not save an edit with an invalid amount", async () => {
      await financePage.createTransaction({ amount: 45.5, note });

      await financePage.row(note).editButton.click();
      await financePage.editForm.fill({ amount: 0 });
      await financePage.editForm.submitButton.click();

      const belowMinimum = await financePage.editForm.amountInput.evaluate(
        (el: HTMLInputElement) => el.validity.rangeUnderflow,
      );
      expect(belowMinimum).toBe(true);
      await expect(financePage.editForm.root).toBeVisible();

      await financePage.goto(month);
      await expect(financePage.row(note).amount("expense", 45.5)).toBeVisible();
    });
  });

  test.describe("deleting", () => {
    test("deletes a transaction after confirming in the dialog", async () => {
      const kept = newNote();
      await financePage.createTransaction({
        amount: 45.5,
        category: expenses.food,
        date: day(10),
        note,
      });
      await financePage.createTransaction({ amount: 20, date: day(11), note: kept });

      await financePage.row(note).deleteButton.click();

      const dialog = financePage.deleteDialog;
      await expect(dialog.title).toHaveText(text.deleteTitle);
      await expect(dialog.message).toHaveText(
        text.deleteMessage(expenses.food, finance.money(45.5), ui.dates.longDay(day(10))),
      );
      // The dialog opens on the answer that deletes nothing
      await expect(dialog.cancelButton).toBeFocused();

      await dialog.confirm();

      await expect(financePage.row(note).root).toBeHidden();
      await expect(financePage.row(kept).root).toBeVisible();
      await expectTotals({ income: 0, expenses: 20, balance: -20 });

      // It was deleted, not just hidden
      await financePage.goto(month);
      await expect(financePage.rows).toHaveCount(1);
      await expect(financePage.row(kept).root).toBeVisible();
    });

    for (const [label, dismiss] of [
      ["the cancel button", "cancel"],
      ["Escape", "pressEscape"],
    ] as const) {
      test(`keeps the transaction when the dialog is closed with ${label}`, async () => {
        await financePage.createTransaction({ amount: 45.5, note });

        await financePage.row(note).deleteButton.click();
        await financePage.deleteDialog[dismiss]();

        await expect(financePage.row(note).amount("expense", 45.5)).toBeVisible();
        await expectTotals({ income: 0, expenses: 45.5, balance: -45.5 });

        await financePage.goto(month);
        await expect(financePage.row(note).amount("expense", 45.5)).toBeVisible();
      });
    }
  });

  test.describe("month and totals", () => {
    test("adds up the income, the expenses and the balance of the month", async () => {
      await financePage.createTransaction({ type: "income", amount: 1000.1 });
      await financePage.createTransaction({ type: "income", amount: 250.25 });
      await financePage.createTransaction({ amount: 300.3 });
      await financePage.createTransaction({ amount: 99.99 });
      // Another month's transaction stays out of these totals
      await financePage.createTransaction({ amount: 5000, date: lastDayOf(previousMonth) });

      await expect(financePage.rows).toHaveCount(4);
      await expectTotals({ income: 1250.35, expenses: 400.29, balance: 850.06 });

      await financePage.goto(month);
      await expectTotals({ income: 1250.35, expenses: 400.29, balance: 850.06 });
    });

    test("stepping to another month shows its transactions and its totals", async ({ page }) => {
      const before = newNote();
      await financePage.createTransaction({ amount: 45.5, note });
      await financePage.createTransaction({
        type: "income",
        amount: 700,
        date: lastDayOf(previousMonth),
        note: before,
      });

      await financePage.monthNav.previousButton.click();

      await expect(financePage.monthNav.label(previousMonth)).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`/finance\\?month=${previousMonth}$`));
      await expect(financePage.row(before).amount("income", 700)).toBeVisible();
      await expect(financePage.rows).toHaveCount(1);
      await expectTotals({ income: 700, expenses: 0, balance: 700 });

      await financePage.monthNav.nextButton.click();

      await expect(financePage.monthNav.label(month)).toBeVisible();
      await expect(financePage.row(note).amount("expense", 45.5)).toBeVisible();
      await expect(financePage.rows).toHaveCount(1);
      await expectTotals({ income: 0, expenses: 45.5, balance: -45.5 });
    });

    test("a month without transactions says so and has no filters", async () => {
      await expect(financePage.emptyMessage(month)).toBeVisible();
      await expect(financePage.rows).toHaveCount(0);
      await expect(financePage.typeFilter).toBeHidden();
      await expect(financePage.categoryFilter).toBeHidden();
      await expectTotals({ income: 0, expenses: 0, balance: 0 });
    });
  });

  test.describe("filters", () => {
    test("filters by type", async () => {
      const [spent, earned] = [newNote(), newNote()];
      await financePage.createTransaction({ amount: 45.5, note: spent });
      await financePage.createTransaction({ type: "income", amount: 1200, note: earned });

      await financePage.filterByType("income");
      await expect(financePage.rows).toHaveCount(1);
      await expect(financePage.row(earned).root).toBeVisible();

      await financePage.filterByType("expense");
      await expect(financePage.rows).toHaveCount(1);
      await expect(financePage.row(spent).root).toBeVisible();

      await financePage.filterByType("all");
      await expect(financePage.rows).toHaveCount(2);
      // The filters narrow the list, not the totals of the month
      await expectTotals({ income: 1200, expenses: 45.5, balance: 1154.5 });
    });

    test("filters by category, alone and together with the type", async () => {
      const [food, transport, salary] = [newNote(), newNote(), newNote()];
      await financePage.createTransaction({ amount: 10, category: expenses.food, note: food });
      await financePage.createTransaction({
        amount: 20,
        category: expenses.transport,
        note: transport,
      });
      await financePage.createTransaction({
        type: "income",
        amount: 30,
        category: incomes.salary,
        note: salary,
      });

      await financePage.filterByCategory("expense", expenses.food);
      await expect(financePage.rows).toHaveCount(1);
      await expect(financePage.row(food).root).toBeVisible();

      // The type of that category keeps the category
      await financePage.filterByType("expense");
      await expect(financePage.rows).toHaveCount(1);
      await expect(financePage.row(food).root).toBeVisible();

      // The other type drops it: no income is "Comida"
      await financePage.filterByType("income");
      await expect(financePage.categoryFilter).toHaveValue("");
      await expect(financePage.rows).toHaveCount(1);
      await expect(financePage.row(salary).root).toBeVisible();
    });

    test("choosing a type leaves only its categories to filter by", async () => {
      await financePage.createTransaction({ amount: 10 });

      const expenseOptions = financePage.categoryFilterGroup("expense").getByRole("option");
      const incomeOptions = financePage.categoryFilterGroup("income").getByRole("option");
      await expect(expenseOptions).toHaveText(Object.values(expenses));
      await expect(incomeOptions).toHaveText(Object.values(incomes));

      await financePage.filterByType("income");

      await expect(incomeOptions).toHaveText(Object.values(incomes));
      await expect(expenseOptions).toHaveCount(0);
    });

    test("tells the catch-all category of an expense from the one of an income", async () => {
      const [spent, earned] = [newNote(), newNote()];
      await financePage.createTransaction({ amount: 10, category: expenses.other, note: spent });
      await financePage.createTransaction({
        type: "income",
        amount: 20,
        category: incomes.other,
        note: earned,
      });

      await financePage.filterByCategory("income", incomes.other);
      await expect(financePage.rows).toHaveCount(1);
      await expect(financePage.row(earned).root).toBeVisible();

      await financePage.filterByCategory("expense", expenses.other);
      await expect(financePage.rows).toHaveCount(1);
      await expect(financePage.row(spent).root).toBeVisible();
    });

    test("says when nothing matches and clears the filters", async () => {
      await financePage.createTransaction({ amount: 10, category: expenses.food, note });

      await financePage.filterByCategory("expense", expenses.transport);

      await expect(financePage.noMatchesMessage).toBeVisible();
      await expect(financePage.rows).toHaveCount(0);

      await financePage.clearFiltersButton.click();

      await expect(financePage.row(note).root).toBeVisible();
      await expect(financePage.categoryFilter).toHaveValue("");
      await expect(financePage.noMatchesMessage).toBeHidden();
    });
  });

  test.describe("when Supabase fails", () => {
    test("says that the transactions could not be loaded", async () => {
      await financePage.mockLoadError();

      await financePage.open(month);

      await expect(financePage.alert).toHaveText(text.loadError);
      await expect(financePage.newTransactionButton).toBeHidden();
    });

    test("keeps the form open when the transaction cannot be saved", async () => {
      await financePage.mockSaveError();
      await financePage.newTransactionButton.click();
      await financePage.createForm.fill({ amount: 45.5, note });

      await financePage.createForm.submitButton.click();

      await expect(financePage.alert).toHaveText(finance.saveError);
      // Nothing typed is lost
      await expect(financePage.createForm.amountInput).toHaveValue("45.5");
      await expect(financePage.createForm.noteInput).toHaveValue(note);
      await expect(financePage.emptyMessage(month)).toBeVisible();
    });

    test("cancelling the form that could not be saved clears the error", async () => {
      await financePage.mockSaveError();
      await financePage.newTransactionButton.click();
      await financePage.createForm.fill({ amount: 45.5, note });
      await financePage.createForm.submitButton.click();
      await expect(financePage.alert).toHaveText(finance.saveError);

      await financePage.createForm.cancelButton.click();

      await expect(financePage.alert).toBeHidden();
    });

    test("keeps the transaction when it cannot be deleted", async () => {
      await financePage.createTransaction({ amount: 45.5, note });
      await financePage.mockDeleteError();

      await financePage.row(note).deleteButton.click();
      await financePage.deleteDialog.confirm();

      await expect(financePage.alert).toHaveText(finance.saveError);
      await expect(financePage.row(note).amount("expense", 45.5)).toBeVisible();
      await expectTotals({ income: 0, expenses: 45.5, balance: -45.5 });
    });
  });
});
