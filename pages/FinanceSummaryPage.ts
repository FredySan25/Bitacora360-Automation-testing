import { expect, type Locator, type Page } from "@playwright/test";
import { mockSupabaseTable } from "../support/supabase-rows";
import { ui } from "../support/ui";
import { MonthNav } from "./components/MonthNav";
import { SummaryCards } from "./components/SummaryCards";

const finance = ui.modules.finance;
const text = finance.summary;

type Totals = { income: number; expenses: number };

/** Summary of a month at /finance/summary: totals against the month before and three charts. */
export class FinanceSummaryPage {
  readonly monthNav: MonthNav;
  readonly cards: SummaryCards;
  /** Expenses by category, largest first. */
  readonly categoryRows: Locator;
  /** The month the trend is reading out and its totals: the selected one, or the one under the pointer. */
  readonly trendReadout: Locator;
  /** One button per month of the trend, oldest first. */
  readonly trendMonths: Locator;
  readonly trendSeries: Locator;
  readonly trendTable: Locator;
  readonly noTrendMessage: Locator;
  readonly ruleRows: Locator;
  readonly ruleExplanation: Locator;
  readonly noIncomeMessage: Locator;
  /** Load error. Scoped to the content: Next.js has a `role="alert"` of its own. */
  readonly alert: Locator;

  private readonly byCategory: Locator;
  private readonly trend: Locator;
  private readonly rule: Locator;

  constructor(readonly page: Page) {
    this.monthNav = new MonthNav(page);
    this.cards = new SummaryCards(page);

    this.byCategory = this.chart(text.charts.byCategory);
    this.categoryRows = this.byCategory.getByRole("listitem");

    this.trend = this.chart(text.charts.trend);
    this.trendReadout = this.trend.locator("figcaption");
    this.trendMonths = this.trend.getByRole("button");
    this.trendSeries = this.trend.getByRole("list").getByRole("listitem");
    this.trendTable = this.trend.getByRole("table", { name: text.trendTable.caption });
    this.noTrendMessage = this.trend.getByText(text.noTrend, { exact: true });

    this.rule = this.chart(text.charts.rule);
    this.ruleRows = this.rule.getByRole("listitem");
    this.ruleExplanation = this.rule.getByText(text.rule.explanation, { exact: true });
    this.noIncomeMessage = this.rule.getByText(text.rule.noIncome, { exact: true });

    this.alert = page.getByRole("main").getByRole("alert");
  }

  /** Opens the summary of a month ("1950-03"), or of the current one. */
  async goto(month?: string) {
    await this.open(month);
    // The month selector replaces the loading message once the transactions arrive
    await expect(this.monthNav.previousButton).toBeVisible();
  }

  /** Navigates without waiting for the summary, for the tests where it never arrives. */
  async open(month?: string) {
    await this.page.goto(month ? `/finance/summary?month=${month}` : "/finance/summary");
  }

  chartHeading(name: string): Locator {
    return this.page.getByRole("heading", { level: 2, name, exact: true });
  }

  /** Row of a category in the chart of expenses, by its label ("Comida"). */
  categoryRow(category: string): Locator {
    return this.categoryRows.filter({ hasText: category });
  }

  /** Message of a month without expenses, from its key ("1950-03"). */
  noExpensesMessage(month: string): Locator {
    return this.byCategory.getByText(text.noExpenses(ui.dates.monthYear(month)), { exact: true });
  }

  /** Button of a month in the trend, named after its totals. `month` is a key ("1950-03"). */
  trendMonth(month: string, totals: Totals): Locator {
    return this.trend.getByRole("button", {
      name: this.trendMonthName(month, totals),
      exact: true,
    });
  }

  /** Label of a month under the trend, from its key ("1950-03"): its short name. */
  trendAxisLabel(month: string): Locator {
    return this.trend.getByText(ui.dates.shortMonth(month), { exact: true });
  }

  /** What the button of a month announces. */
  trendMonthName(month: string, totals: Totals): string {
    return text.trendMonth(
      ui.dates.monthYear(month),
      finance.money(totals.income),
      finance.money(totals.expenses),
    );
  }

  /** Income, expenses and balance of a month in the table behind the trend, in that order. */
  trendTableCells(month: string): Locator {
    return this.trendTable
      .getByRole("row")
      .filter({
        has: this.page.getByRole("rowheader", { name: ui.dates.monthYear(month), exact: true }),
      })
      .getByRole("cell");
  }

  /** Row of the 50/30/20 split, by its label ("Necesidades"). */
  ruleRow(label: string): Locator {
    return this.ruleRows.filter({ hasText: label });
  }

  /** Makes the transactions fail to load. Call it before `open`. */
  async mockLoadError() {
    await mockSupabaseTable(this.page, "transactions", { method: "GET", status: 500, body: {} });
  }

  private chart(title: string): Locator {
    return this.page.locator("section").filter({ has: this.chartHeading(title) });
  }
}
