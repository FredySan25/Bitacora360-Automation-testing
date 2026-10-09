import type { Locator, Page } from "@playwright/test";
import { ui } from "../../support/ui";

const text = ui.modules.finance.monthNav;

/** Month selector shared by the finance views. The month it shows lives in the URL (`?month=`). */
export class MonthNav {
  readonly previousButton: Locator;
  readonly nextButton: Locator;
  /** Only there while a past month is on screen. */
  readonly currentMonthButton: Locator;

  constructor(private readonly page: Page) {
    this.previousButton = page.getByRole("button", { name: text.previous, exact: true });
    this.nextButton = page.getByRole("button", { name: text.next, exact: true });
    this.currentMonthButton = page.getByRole("button", { name: text.current, exact: true });
  }

  /** The selected month, from its key ("1950-03"). Other texts name the month too, but none is a paragraph of its own. */
  label(month: string): Locator {
    return this.page
      .getByRole("main")
      .getByRole("paragraph")
      .and(this.page.getByText(ui.dates.monthYear(month), { exact: true }));
  }
}
