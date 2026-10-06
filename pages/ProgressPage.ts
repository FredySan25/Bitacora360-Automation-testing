import { expect, type Locator, type Page } from "@playwright/test";
import { ui } from "../support/ui";

const text = ui.modules.habits.progress;

/** Progress view at /habits/progress: headline numbers, charts and the per-habit table. */
export class ProgressPage {
  readonly heatmap: Locator;
  readonly habitsTable: Locator;

  private readonly main: Locator;

  constructor(readonly page: Page) {
    this.main = page.getByRole("main");
    this.heatmap = page.getByRole("img", { name: text.heatmapLabel });
    this.habitsTable = page.getByRole("table");
  }

  /** The numbers only render once the user has an active habit, so the test creates one first. */
  async goto() {
    await this.page.goto("/habits/progress");
    await expect(this.chartHeading(text.charts.perHabit)).toBeVisible();
  }

  /** Label of a headline number. "Últimos 30 días" is also a column of the table, which is not a paragraph. */
  tile(label: string): Locator {
    return this.main.getByRole("paragraph").and(this.page.getByText(label, { exact: true }));
  }

  chartHeading(name: string): Locator {
    return this.page.getByRole("heading", { level: 2, name, exact: true });
  }

  /** Row of one habit in the per-habit table. */
  row(habitName: string): Locator {
    return this.habitsTable
      .getByRole("row")
      .filter({ has: this.page.getByRole("rowheader", { name: habitName, exact: true }) });
  }

  currentStreak(habitName: string): Locator {
    return this.row(habitName).getByRole("cell").nth(0);
  }

  bestStreak(habitName: string): Locator {
    return this.row(habitName).getByRole("cell").nth(1);
  }

  last30Days(habitName: string): Locator {
    return this.row(habitName).getByRole("cell").nth(2);
  }
}
