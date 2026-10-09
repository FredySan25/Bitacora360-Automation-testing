import { expect, test } from "@playwright/test";
import { BudgetsPage } from "../../pages/BudgetsPage";
import { FinanceTabs } from "../../pages/components/FinanceTabs";
import { MonthNav } from "../../pages/components/MonthNav";
import { DashboardShell } from "../../pages/DashboardShell";
import { FinancePage } from "../../pages/FinancePage";
import { FinanceSummaryPage } from "../../pages/FinanceSummaryPage";
import { GoalsPage } from "../../pages/GoalsPage";
import { addMonths, currentMonthKey } from "../../support/dates";
import { ui } from "../../support/ui";

const finance = ui.modules.finance;

const TABS = [
  { label: finance.tabs.budgets, path: "/finance/budgets" },
  { label: finance.tabs.summary, path: "/finance/summary" },
  { label: finance.tabs.goals, path: "/finance/goals" },
  { label: finance.tabs.transactions, path: "/finance" },
];

test.describe("Finance", () => {
  test("loads the module page", async ({ page }) => {
    await page.goto("/finance");

    await expect(new DashboardShell(page).pageTitle(ui.modules.finance.title)).toBeVisible();
    await expect(page.getByText(ui.modules.finance.description)).toBeVisible();
  });

  test("the tabs switch sections and mark the active one", async ({ page }) => {
    const shell = new DashboardShell(page);
    const tabs = new FinanceTabs(page);
    await new FinancePage(page).goto();

    await expect(shell.pageTitle(finance.title)).toBeVisible();
    await expect(tabs.tab(finance.tabs.transactions)).toHaveAttribute("aria-current", "page");

    for (const tab of TABS) {
      await tabs.tab(tab.label).click();

      await expect(page).toHaveURL(new RegExp(`${tab.path}$`));
      await expect(tabs.tab(tab.label)).toHaveAttribute("aria-current", "page");
      // The title and the sidebar stay on finance across the four sections
      await expect(shell.pageTitle(finance.title)).toBeVisible();
      await expect(shell.navLink(finance.navLink)).toHaveAttribute("aria-current", "page");
    }
  });

  // None of these tests writes anything, and they only read the name of the
  // month on screen: whatever the test user has in those months does not matter
  test.describe("selected month", () => {
    const thisMonth = currentMonthKey();
    const lastMonth = currentMonthKey(-1);
    const pastMonth = currentMonthKey(-7);

    test("follows from tab to tab and survives a reload", async ({ page }) => {
      const tabs = new FinanceTabs(page);
      const financePage = new FinancePage(page);
      const budgetsPage = new BudgetsPage(page);
      const summaryPage = new FinanceSummaryPage(page);
      await financePage.goto(pastMonth);
      await expect(financePage.monthNav.label(pastMonth)).toBeVisible();

      await tabs.tab(finance.tabs.budgets).click();
      await expect(page).toHaveURL(new RegExp(`/finance/budgets\\?month=${pastMonth}$`));
      await expect(budgetsPage.monthNav.label(pastMonth)).toBeVisible();

      await tabs.tab(finance.tabs.summary).click();
      await expect(page).toHaveURL(new RegExp(`/finance/summary\\?month=${pastMonth}$`));
      await expect(summaryPage.monthNav.label(pastMonth)).toBeVisible();

      // The goals are not tied to a month, but the tab keeps it for the way back
      await tabs.tab(finance.tabs.goals).click();
      await expect(page).toHaveURL(new RegExp(`/finance/goals\\?month=${pastMonth}$`));
      await expect(new GoalsPage(page).newGoalButton).toBeVisible();

      await tabs.tab(finance.tabs.transactions).click();
      await expect(page).toHaveURL(new RegExp(`/finance\\?month=${pastMonth}$`));
      await expect(financePage.monthNav.label(pastMonth)).toBeVisible();

      await page.reload();
      await financePage.waitUntilLoaded();
      await expect(page).toHaveURL(new RegExp(`/finance\\?month=${pastMonth}$`));
      await expect(financePage.monthNav.label(pastMonth)).toBeVisible();
    });

    test("steps back and forward, never past the current month", async ({ page }) => {
      const financePage = new FinancePage(page);
      const { monthNav } = financePage;
      await financePage.goto();

      await expect(monthNav.label(thisMonth)).toBeVisible();
      await expect(monthNav.nextButton).toBeDisabled();
      await expect(monthNav.currentMonthButton).toBeHidden();

      await monthNav.previousButton.click();

      await expect(monthNav.label(lastMonth)).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`/finance\\?month=${lastMonth}$`));
      await expect(monthNav.nextButton).toBeEnabled();
      await expect(monthNav.currentMonthButton).toBeVisible();

      await monthNav.nextButton.click();

      // The current month needs no parameter
      await expect(monthNav.label(thisMonth)).toBeVisible();
      await expect(page).toHaveURL(/\/finance$/);
      await expect(monthNav.nextButton).toBeDisabled();
    });

    test("comes back to the current month in one step", async ({ page }) => {
      const financePage = new FinancePage(page);
      await financePage.goto(pastMonth);

      await financePage.monthNav.currentMonthButton.click();

      await expect(financePage.monthNav.label(thisMonth)).toBeVisible();
      await expect(page).toHaveURL(/\/finance$/);
      await expect(financePage.monthNav.currentMonthButton).toBeHidden();
    });

    for (const [label, value] of [
      ["a month that has not started", addMonths(thisMonth, 1)],
      ["a month that does not exist", `${thisMonth.slice(0, 4)}-13`],
      ["a day instead of a month", `${thisMonth}-01`],
      // A Date reads the years 0 to 99 as 1900 to 1999
      ["a year below 1000", "0050-03"],
      ["something that is not a month", "last"],
    ]) {
      test(`${label} in the URL falls back to the current month`, async ({ page }) => {
        const financePage = new FinancePage(page);

        await page.goto(`/finance?month=${value}`);
        await financePage.waitUntilLoaded();

        await expect(financePage.monthNav.label(thisMonth)).toBeVisible();
        await expect(financePage.monthNav.nextButton).toBeDisabled();
        await expect(financePage.monthNav.currentMonthButton).toBeHidden();
      });
    }

    for (const [view, path] of [
      ["the budgets", "/finance/budgets"],
      ["the summary", "/finance/summary"],
    ]) {
      test(`${view} step through the months too`, async ({ page }) => {
        const monthNav = new MonthNav(page);
        await page.goto(path);

        await expect(monthNav.label(thisMonth)).toBeVisible();
        await expect(monthNav.nextButton).toBeDisabled();

        await monthNav.previousButton.click();

        await expect(monthNav.label(lastMonth)).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`${path}\\?month=${lastMonth}$`));

        await monthNav.currentMonthButton.click();

        await expect(monthNav.label(thisMonth)).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`${path}$`));
      });
    }
  });
});
