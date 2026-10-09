import type { Locator, Page } from "@playwright/test";
import { ui } from "../../support/ui";

const finance = ui.modules.finance;
const text = finance.todayCard;

/** Finance card of /today: the balance of the current month, or an invitation to register the first expense. */
export class FinanceMonthCard {
  readonly root: Locator;
  readonly balanceLabel: Locator;
  /** Income and expenses of the month, each a label with its amount. */
  readonly totalLabels: Locator;
  readonly totalAmounts: Locator;
  /** Every amount on the card: the balance and the two totals. */
  readonly amounts: Locator;
  readonly emptyMessage: Locator;
  readonly registerLink: Locator;
  readonly loadError: Locator;

  constructor(page: Page) {
    this.root = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { level: 2, name: finance.title, exact: true }) });
    this.balanceLabel = this.root.getByText(text.balanceLabel, { exact: true });
    this.totalLabels = this.root.getByRole("term");
    this.totalAmounts = this.root.getByRole("definition");
    this.amounts = this.root.getByText(finance.moneyPattern);
    this.emptyMessage = this.root.getByText(text.empty, { exact: true });
    this.registerLink = this.root.getByRole("link", { name: text.emptyAction, exact: true });
    this.loadError = this.root.getByText(text.loadError, { exact: true });
  }
}
