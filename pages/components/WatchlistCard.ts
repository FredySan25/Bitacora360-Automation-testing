import type { Locator, Page } from "@playwright/test";
import { ui } from "../../support/ui";

const watchlist = ui.modules.watchlist;
const text = watchlist.todayCard;

/**
 * Watchlist card of /today: what is in progress and how many items are
 * pending and finished, or an invitation to add the first title.
 */
export class WatchlistCard {
  readonly root: Locator;
  readonly inProgressLabel: Locator;
  /** Titles in progress, up to three, plus the line that counts the rest. */
  readonly inProgressItems: Locator;
  readonly nothingInProgress: Locator;
  /** "Pendientes" and "Terminados", each a label with its count. */
  readonly countLabels: Locator;
  readonly counts: Locator;
  readonly emptyMessage: Locator;
  readonly addLink: Locator;
  readonly loadError: Locator;

  constructor(page: Page) {
    this.root = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { level: 2, name: watchlist.title, exact: true }) });
    this.inProgressLabel = this.root.getByText(text.inProgress, { exact: true });
    this.inProgressItems = this.root.getByRole("listitem");
    this.nothingInProgress = this.root.getByText(text.nothingInProgress, { exact: true });
    this.countLabels = this.root.getByRole("term");
    this.counts = this.root.getByRole("definition");
    this.emptyMessage = this.root.getByText(text.empty, { exact: true });
    this.addLink = this.root.getByRole("link", { name: text.emptyAction, exact: true });
    this.loadError = this.root.getByText(text.loadError, { exact: true });
  }

  /** A title in progress, with its type next to it. */
  inProgressItem(title: string): Locator {
    return this.inProgressItems.filter({ has: this.root.page().getByText(title, { exact: true }) });
  }

  /** The line under the titles in progress that counts the ones left out: "y 2 más". */
  moreInProgress(count: number): Locator {
    return this.root.getByText(text.more(count), { exact: true });
  }
}
