import { expect, test } from "@playwright/test";
import { FinancePage } from "../../pages/FinancePage";
import { FinanceSummaryPage } from "../../pages/FinanceSummaryPage";
import { addMonths, monthKey } from "../../support/dates";
import { ownYear } from "../../support/own-year";
import { ui } from "../../support/ui";

const finance = ui.modules.finance;
const text = finance.summary;
const cards = finance.cards;
const expenses = finance.expenseCategories;

// The summary adds up the selected month and looks back on the five before it.
// Every test works in December of a year of its own, so that whole window holds
// nothing but the transactions the test registered
test.describe("Finance summary", () => {
  let financePage: FinancePage;
  let summaryPage: FinanceSummaryPage;
  let month: string;
  let previousMonth: string;
  /** Name of the month before, as the comparisons put it. */
  let previousName: string;

  /** A day in the middle of a month, counted back from the test's month. */
  function midMonth(monthsBack = 0): string {
    return `${addMonths(month, -monthsBack)}-15`;
  }

  test.beforeEach(async ({ page }, testInfo) => {
    month = monthKey(ownYear(testInfo), 12);
    previousMonth = addMonths(month, -1);
    previousName = ui.dates.month(previousMonth);

    financePage = new FinancePage(page);
    summaryPage = new FinanceSummaryPage(page);
    // The transactions are registered in the first tab
    await financePage.gotoOwnMonth(month);
  });

  test.afterEach(async () => {
    await financePage.deleteCreatedData();
  });

  test("a month without transactions has every section empty", async () => {
    await summaryPage.goto(month);

    for (const heading of Object.values(text.charts)) {
      await expect(summaryPage.chartHeading(heading)).toBeVisible();
    }
    await expect(summaryPage.cards.income.value).toHaveText(finance.money(0));
    await expect(summaryPage.cards.income.detail).toHaveText(cards.noIncomeIn(previousName));
    await expect(summaryPage.cards.expenses.value).toHaveText(finance.money(0));
    await expect(summaryPage.cards.expenses.detail).toHaveText(cards.noExpensesIn(previousName));
    await expect(summaryPage.cards.balance.value).toHaveText(finance.money(0));
    await expect(summaryPage.cards.balance.detail).toHaveText(cards.noTransactionsIn(previousName));
    await expect(summaryPage.cards.savingsRate.value).toHaveText(cards.noRate);
    await expect(summaryPage.cards.savingsRate.detail).toHaveText(cards.rateWithoutIncome);

    await expect(summaryPage.noExpensesMessage(month)).toBeVisible();
    await expect(summaryPage.noTrendMessage).toBeVisible();
    await expect(summaryPage.noIncomeMessage).toBeVisible();
  });

  test("compares the totals with the month before", async () => {
    await financePage.createTransaction({ type: "income", amount: 1500, date: midMonth() });
    await financePage.createTransaction({ amount: 300, date: midMonth() });
    await financePage.createTransaction({ type: "income", amount: 1000, date: midMonth(1) });
    await financePage.createTransaction({ amount: 400, date: midMonth(1) });

    await summaryPage.goto(month);

    await expect(summaryPage.cards.income.value).toHaveText(finance.money(1500));
    await expect(summaryPage.cards.income.detail).toHaveText(
      cards.change(finance.signedPercent(50), previousName),
    );
    await expect(summaryPage.cards.expenses.value).toHaveText(finance.money(300));
    await expect(summaryPage.cards.expenses.detail).toHaveText(
      cards.change(finance.signedPercent(-25), previousName),
    );
    await expect(summaryPage.cards.balance.value).toHaveText(finance.money(1200));
    await expect(summaryPage.cards.balance.detail).toHaveText(
      cards.change(finance.signedMoney(600), previousName),
    );
    await expect(summaryPage.cards.savingsRate.value).toHaveText(finance.percent(80));
    await expect(summaryPage.cards.savingsRate.detail).toHaveText(cards.rateOfIncome);

    // The month before is compared with its own previous month, which is empty
    await summaryPage.monthNav.previousButton.click();

    await expect(summaryPage.monthNav.label(previousMonth)).toBeVisible();
    await expect(summaryPage.cards.income.value).toHaveText(finance.money(1000));
    await expect(summaryPage.cards.income.detail).toHaveText(
      cards.noIncomeIn(ui.dates.month(addMonths(month, -2))),
    );
    await expect(summaryPage.cards.savingsRate.value).toHaveText(finance.percent(60));
  });

  test("says when a total is the same as the month before, or lower", async () => {
    await financePage.createTransaction({ type: "income", amount: 1000, date: midMonth() });
    await financePage.createTransaction({ amount: 250, date: midMonth() });
    await financePage.createTransaction({ type: "income", amount: 1000, date: midMonth(1) });

    await summaryPage.goto(month);

    await expect(summaryPage.cards.income.detail).toHaveText(cards.sameAs(previousName));
    // Nothing was spent the month before, so there is no percentage to give
    await expect(summaryPage.cards.expenses.detail).toHaveText(cards.noExpensesIn(previousName));
    await expect(summaryPage.cards.balance.value).toHaveText(finance.money(750));
    await expect(summaryPage.cards.balance.detail).toHaveText(
      cards.change(finance.signedMoney(-250), previousName),
    );
    await expect(summaryPage.cards.savingsRate.value).toHaveText(finance.percent(75));
  });

  test("a month that spent more than it earned has a negative savings rate", async () => {
    await financePage.createTransaction({ type: "income", amount: 100, date: midMonth() });
    await financePage.createTransaction({
      amount: 150,
      category: expenses.food,
      date: midMonth(),
    });

    await summaryPage.goto(month);

    await expect(summaryPage.cards.balance.value).toHaveText(finance.money(-50));
    await expect(summaryPage.cards.savingsRate.value).toHaveText(finance.percent(-50));
    await expect(summaryPage.cards.savingsRate.detail).toHaveText(cards.rateOverspent);
    await expect(summaryPage.ruleRow(text.rule.needs)).toContainText(
      text.rule.share(finance.percent(150), finance.money(150), finance.percent(50)),
    );
    await expect(summaryPage.ruleRow(text.rule.savings)).toContainText(
      text.rule.share(finance.percent(-50), finance.money(-50), finance.percent(20)),
    );
  });

  test("lists the expenses by category, the largest first, with its share", async () => {
    await financePage.createTransaction({ amount: 100, category: expenses.transport });
    await financePage.createTransaction({ amount: 200, category: expenses.food });
    await financePage.createTransaction({ amount: 150, category: expenses.entertainment });
    // Two expenses of a category are one bar
    await financePage.createTransaction({ amount: 50, category: expenses.food });
    // Neither an income nor another month's expense is part of the chart
    await financePage.createTransaction({ type: "income", amount: 900 });
    await financePage.createTransaction({
      amount: 700,
      category: expenses.health,
      date: midMonth(1),
    });

    await summaryPage.goto(month);

    await expect(summaryPage.categoryRows).toHaveCount(3);
    await expect(summaryPage.categoryRows).toContainText([
      expenses.food,
      expenses.entertainment,
      expenses.transport,
    ]);
    await expect(summaryPage.categoryRow(expenses.food)).toContainText(
      text.categoryShare(finance.money(250), finance.percent(50)),
    );
    await expect(summaryPage.categoryRow(expenses.entertainment)).toContainText(
      text.categoryShare(finance.money(150), finance.percent(30)),
    );
    await expect(summaryPage.categoryRow(expenses.transport)).toContainText(
      text.categoryShare(finance.money(100), finance.percent(20)),
    );
    await expect(summaryPage.noExpensesMessage(month)).toBeHidden();
  });

  test("plots the six months that end on the selected one", async () => {
    const first = addMonths(month, -5);
    await financePage.createTransaction({ type: "income", amount: 1500, date: midMonth() });
    await financePage.createTransaction({ amount: 300, date: midMonth() });
    await financePage.createTransaction({ type: "income", amount: 1000, date: midMonth(1) });
    await financePage.createTransaction({ amount: 400, date: midMonth(1) });
    await financePage.createTransaction({ amount: 50, date: midMonth(5) });
    // One month too far back to be plotted
    await financePage.createTransaction({ amount: 999, date: midMonth(6) });

    await summaryPage.goto(month);

    const nothing = { income: 0, expenses: 0 };
    const plotted = [
      summaryPage.trendMonthName(first, { income: 0, expenses: 50 }),
      summaryPage.trendMonthName(addMonths(month, -4), nothing),
      summaryPage.trendMonthName(addMonths(month, -3), nothing),
      summaryPage.trendMonthName(addMonths(month, -2), nothing),
      summaryPage.trendMonthName(previousMonth, { income: 1000, expenses: 400 }),
      summaryPage.trendMonthName(month, { income: 1500, expenses: 300 }),
    ];
    await expect(summaryPage.trendMonths).toHaveCount(plotted.length);
    for (const [index, name] of plotted.entries()) {
      await expect(summaryPage.trendMonths.nth(index)).toHaveAccessibleName(name);
    }
    for (let monthsBack = 0; monthsBack < plotted.length; monthsBack++) {
      await expect(summaryPage.trendAxisLabel(addMonths(month, -monthsBack))).toBeVisible();
    }
    await expect(summaryPage.trendSeries).toHaveText(text.trendSeries);

    // Left alone, the chart reads out the selected month
    await expect(summaryPage.trendReadout).toContainText(ui.dates.monthYear(month));
    await expect(summaryPage.trendReadout).toContainText(
      text.trendReadout(finance.money(1500), finance.money(300), finance.money(1200)),
    );

    await summaryPage.trendMonth(previousMonth, { income: 1000, expenses: 400 }).hover();

    await expect(summaryPage.trendReadout).toContainText(ui.dates.monthYear(previousMonth));
    await expect(summaryPage.trendReadout).toContainText(
      text.trendReadout(finance.money(1000), finance.money(400), finance.money(600)),
    );

    // The same numbers are there as a table
    await expect(summaryPage.trendTable.getByRole("columnheader")).toHaveText(
      text.trendTable.columns,
    );
    await expect(summaryPage.trendTable.getByRole("rowheader")).toHaveCount(6);
    await expect(summaryPage.trendTableCells(month)).toHaveText([
      finance.money(1500),
      finance.money(300),
      finance.money(1200),
    ]);
    await expect(summaryPage.trendTableCells(first)).toHaveText([
      finance.money(0),
      finance.money(50),
      finance.money(-50),
    ]);
  });

  test("keeps the trend when only the earlier months have transactions", async () => {
    await financePage.createTransaction({ type: "income", amount: 500, date: midMonth(1) });

    await summaryPage.goto(month);

    await expect(summaryPage.cards.income.value).toHaveText(finance.money(0));
    await expect(summaryPage.cards.income.detail).toHaveText(
      cards.change(finance.signedPercent(-100), previousName),
    );
    await expect(summaryPage.cards.balance.detail).toHaveText(
      cards.change(finance.signedMoney(-500), previousName),
    );
    await expect(summaryPage.trendMonth(previousMonth, { income: 500, expenses: 0 })).toBeVisible();
    await expect(summaryPage.noTrendMessage).toBeHidden();
    await expect(summaryPage.noExpensesMessage(month)).toBeVisible();
    await expect(summaryPage.noIncomeMessage).toBeVisible();
  });

  test("splits the income by the 50/30/20 rule", async () => {
    await financePage.createTransaction({ type: "income", amount: 1000 });
    // Needs: food and transport
    await financePage.createTransaction({ amount: 300, category: expenses.food });
    await financePage.createTransaction({ amount: 100, category: expenses.transport });
    // Wants
    await financePage.createTransaction({ amount: 250, category: expenses.entertainment });

    await summaryPage.goto(month);

    await expect(summaryPage.ruleRows).toHaveCount(3);
    await expect(summaryPage.ruleRows).toContainText([
      text.rule.needs,
      text.rule.wants,
      text.rule.savings,
    ]);
    await expect(summaryPage.ruleRow(text.rule.needs)).toContainText(
      text.rule.share(finance.percent(40), finance.money(400), finance.percent(50)),
    );
    await expect(summaryPage.ruleRow(text.rule.wants)).toContainText(
      text.rule.share(finance.percent(25), finance.money(250), finance.percent(30)),
    );
    // Savings is what is left of the income
    await expect(summaryPage.ruleRow(text.rule.savings)).toContainText(
      text.rule.share(finance.percent(35), finance.money(350), finance.percent(20)),
    );
    await expect(summaryPage.ruleExplanation).toBeVisible();
    await expect(summaryPage.noIncomeMessage).toBeHidden();
  });

  test("says that the summary could not be loaded", async () => {
    await summaryPage.mockLoadError();

    await summaryPage.open(month);

    await expect(summaryPage.alert).toHaveText(text.loadError);
    await expect(summaryPage.monthNav.previousButton).toBeHidden();
  });
});
