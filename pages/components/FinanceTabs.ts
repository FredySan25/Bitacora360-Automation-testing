import type { Locator, Page } from "@playwright/test";
import { ui } from "../../support/ui";

const text = ui.modules.finance;

/** Section switcher of the finance module. Its links carry the selected month along. */
export class FinanceTabs {
  readonly root: Locator;

  constructor(page: Page) {
    this.root = page.getByRole("navigation", { name: text.tabsLabel });
  }

  tab(label: string): Locator {
    return this.root.getByRole("link", { name: label, exact: true });
  }
}
