import type { Locator, Page } from "@playwright/test";
import { ui } from "../../support/ui";

const text = ui.modules.finance.cards;

/** One headline number of a month: its amount and, in the summary, the line under it. */
export class SummaryCard {
  readonly value: Locator;
  /** Change against the month before, or what the number means. Not every view shows it. */
  readonly detail: Locator;

  constructor(readonly root: Locator) {
    // A card is three lines: its label, the number and the detail
    const lines = root.getByRole("paragraph");
    this.value = lines.nth(1);
    this.detail = lines.nth(2);
  }
}

/** Income, expenses and balance of the selected month; the summary adds the savings rate. */
export class SummaryCards {
  readonly income: SummaryCard;
  readonly expenses: SummaryCard;
  readonly balance: SummaryCard;
  readonly savingsRate: SummaryCard;

  constructor(private readonly page: Page) {
    this.income = this.card(text.income);
    this.expenses = this.card(text.expenses);
    this.balance = this.card(text.balance);
    this.savingsRate = this.card(text.savingsRate);
  }

  private card(label: string): SummaryCard {
    return new SummaryCard(
      this.page.getByRole("main").getByRole("group", { name: label, exact: true }),
    );
  }
}
