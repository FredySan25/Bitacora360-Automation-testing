import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { FinanceMonthCard } from "../../pages/components/FinanceMonthCard";
import { WatchlistCard } from "../../pages/components/WatchlistCard";
import { DashboardShell } from "../../pages/DashboardShell";
import { FinancePage } from "../../pages/FinancePage";
import { WatchlistPage } from "../../pages/WatchlistPage";
import { todayKey } from "../../support/dates";
import { ui } from "../../support/ui";

const finance = ui.modules.finance;
const watchlist = ui.modules.watchlist;

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

// The card reads every item of the test user, which the other specs change in
// parallel: with real data only its structure is checked, and what it shows
// for a given list comes from a mock
test.describe("Today: watchlist card", () => {
  let watchlistPage: WatchlistPage;
  let card: WatchlistCard;

  test.beforeEach(async ({ page }) => {
    watchlistPage = new WatchlistPage(page);
    card = new WatchlistCard(page);
  });

  test.afterEach(async () => {
    await watchlistPage.deleteCreatedData();
  });

  test("counts the pending and finished items once the list has one", async ({ page }) => {
    await watchlistPage.goto();
    await watchlistPage.addItem({ title: `E2E watch ${randomBytes(4).toString("hex")}` });

    await page.goto("/today");

    await expect(card.inProgressLabel).toBeVisible();
    await expect(card.countLabels).toHaveText([
      watchlist.todayCard.pendingLabel,
      watchlist.todayCard.doneLabel,
    ]);
    await expect(card.counts).toHaveText([/^\d+$/, /^\d+$/]);
    await expect(card.emptyMessage).toBeHidden();
  });

  test("shows up to three titles in progress and counts the rest", async ({ page }) => {
    const inProgress = [
      { title: "E2E first", type: "movie" },
      { title: "E2E second", type: "book" },
      { title: "E2E third", type: "series" },
      { title: "E2E fourth", type: "movie" },
    ] as const;
    await watchlistPage.mockItems([
      ...inProgress.map((item) => ({ ...item, status: "in_progress" as const })),
      { title: "E2E pending 1", type: "movie", status: "pending" },
      { title: "E2E pending 2", type: "book", status: "pending" },
      { title: "E2E done", type: "series", status: "done", finishedOn: todayKey(), rating: 4 },
    ]);

    await page.goto("/today");

    // The newest first
    for (const { title, type } of inProgress.slice(0, 3)) {
      await expect(card.inProgressItem(title)).toContainText(watchlist.types[type].label);
    }
    await expect(card.inProgressItem(inProgress[3].title)).toBeHidden();
    await expect(card.moreInProgress(1)).toBeVisible();
    await expect(card.inProgressItems).toHaveCount(4);
    await expect(card.nothingInProgress).toBeHidden();
    await expect(card.countLabels).toHaveText([
      watchlist.todayCard.pendingLabel,
      watchlist.todayCard.doneLabel,
    ]);
    await expect(card.counts).toHaveText(["2", "1"]);
  });

  test("says when nothing is in progress", async ({ page }) => {
    await watchlistPage.mockItems([
      { title: "E2E pending", type: "movie", status: "pending" },
      { title: "E2E done", type: "book", status: "done", finishedOn: todayKey() },
    ]);

    await page.goto("/today");

    await expect(card.nothingInProgress).toBeVisible();
    await expect(card.inProgressItems).toHaveCount(0);
    await expect(card.counts).toHaveText(["1", "1"]);
  });

  test("invites to add the first title when the list is empty", async ({ page }) => {
    await watchlistPage.mockNoItems();

    await page.goto("/today");

    await expect(card.emptyMessage).toBeVisible();
    await expect(card.inProgressLabel).toBeHidden();
    await expect(card.counts).toHaveCount(0);

    await card.addLink.click();

    await expect(page).toHaveURL(/\/watchlist$/);
    await expect(new DashboardShell(page).pageTitle(watchlist.title)).toBeVisible();
  });

  test("says that the list could not be loaded", async ({ page }) => {
    await watchlistPage.mockLoadError();

    await page.goto("/today");

    await expect(card.loadError).toBeVisible();
    await expect(card.emptyMessage).toBeHidden();
    await expect(card.inProgressLabel).toBeHidden();
  });
});
