import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { FinanceMonthCard } from "../../pages/components/FinanceMonthCard";
import { DashboardShell } from "../../pages/DashboardShell";
import { FinancePage } from "../../pages/FinancePage";
import { ui } from "../../support/ui";

const finance = ui.modules.finance;

const CARDS = [
  { module: "habits", path: "/habits" },
  { module: "finance", path: "/finance" },
  { module: "watchlist", path: "/watchlist" },
] as const;

test.describe("Today", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/today");
  });

  test("shows the summary of the three modules", async ({ page }) => {
    const shell = new DashboardShell(page);

    await expect(shell.pageTitle(ui.modules.today.title)).toBeVisible();
    for (const card of CARDS) {
      await expect(
        page.getByRole("heading", { level: 2, name: ui.modules[card.module].title }),
      ).toBeVisible();
    }
  });

  for (const card of CARDS) {
    test(`the ${card.module} card links to ${card.path}`, async ({ page }) => {
      const { title } = ui.modules[card.module];

      await page.getByRole("link", { name: ui.modules.today.cardLink(title) }).click();

      await expect(page).toHaveURL(new RegExp(`${card.path}$`));
      await expect(new DashboardShell(page).pageTitle(title)).toBeVisible();
    });
  }
});

// The card adds up the current month of the test user, which the other specs
// write to in parallel: with real data only its structure is checked, and the
// states that need a month without transactions come from a mock
test.describe("Today: finance card", () => {
  let financePage: FinancePage;
  let card: FinanceMonthCard;

  test.beforeEach(async ({ page }) => {
    financePage = new FinancePage(page);
    card = new FinanceMonthCard(page);
  });

  test.afterEach(async () => {
    await financePage.deleteCreatedData();
  });

  test("shows the balance of the month once it has a transaction", async ({ page }) => {
    await financePage.goto();
    await financePage.createTransaction({
      amount: 12.34,
      note: `E2E ${randomBytes(4).toString("hex")}`,
    });

    await page.goto("/today");

    await expect(card.balanceLabel).toBeVisible();
    await expect(card.totalLabels).toHaveText([
      finance.todayCard.incomeLabel,
      finance.todayCard.expensesLabel,
    ]);
    await expect(card.totalAmounts).toHaveText([finance.moneyPattern, finance.moneyPattern]);
    // The balance on top and the two totals
    await expect(card.amounts).toHaveCount(3);
    await expect(card.emptyMessage).toBeHidden();
  });

  test("invites to register the first expense in a month without transactions", async ({
    page,
  }) => {
    await financePage.mockNoTransactions();

    await page.goto("/today");

    await expect(card.emptyMessage).toBeVisible();
    await expect(card.balanceLabel).toBeHidden();

    await card.registerLink.click();

    await expect(page).toHaveURL(/\/finance$/);
    await expect(new DashboardShell(page).pageTitle(finance.title)).toBeVisible();
  });

  test("says that the transactions could not be loaded", async ({ page }) => {
    await financePage.mockLoadError();

    await page.goto("/today");

    await expect(card.loadError).toBeVisible();
    await expect(card.balanceLabel).toBeHidden();
  });
});
