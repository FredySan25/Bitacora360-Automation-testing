import { expect, type Locator, type Page } from "@playwright/test";
import { mockSupabaseTable, SupabaseRows } from "../support/supabase-rows";
import { ui } from "../support/ui";
import { ConfirmDialog } from "./components/ConfirmDialog";

const finance = ui.modules.finance;
const text = finance.goals;

const GOALS = "savings_goals";
const CONTRIBUTIONS = "savings_contributions";

/** What a test fills in. Anything left out keeps the value the form starts with. */
export type GoalData = {
  name?: string;
  target?: number | string;
  /** Deadline as a date input takes it ("2027-02-15"); an empty string clears it. */
  date?: string;
};

/** The form that creates a savings goal and the one that edits it: same fields, another button. */
export class GoalForm {
  readonly nameInput: Locator;
  readonly targetInput: Locator;
  readonly targetDateInput: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;

  constructor(readonly root: Locator) {
    this.nameInput = root.getByLabel(text.nameLabel, { exact: true });
    this.targetInput = root.getByLabel(text.targetLabel, { exact: true });
    this.targetDateInput = root.getByLabel(text.targetDateLabel, { exact: true });
    this.submitButton = root.locator('button[type="submit"]');
    this.cancelButton = root.getByRole("button", { name: finance.cancel, exact: true });
  }

  async fill(data: GoalData) {
    if (data.name !== undefined) await this.nameInput.fill(data.name);
    if (data.target !== undefined) await this.targetInput.fill(String(data.target));
    if (data.date !== undefined) await this.targetDateInput.fill(data.date);
  }
}

/** One savings goal: how far it is, the form that adds a contribution and the contributions so far. */
export class GoalCard {
  readonly root: Locator;
  readonly editButton: Locator;
  readonly deleteButton: Locator;
  readonly progressBar: Locator;
  readonly reachedBadge: Locator;
  /** The line with the deadline. A goal without one does not have it. */
  readonly deadline: Locator;
  readonly contributionInput: Locator;
  readonly contributionDateInput: Locator;
  readonly contributeButton: Locator;
  /** Opens and closes the list of contributions. Only there once the goal has one. */
  readonly contributionsToggle: Locator;
  /** Contributions so far, the latest day first. Hidden until the list is opened. */
  readonly contributionRows: Locator;

  constructor(cards: Locator, page: Page, name: string) {
    this.root = cards.filter({
      has: page.getByRole("heading", { level: 3, name, exact: true }),
    });
    this.editButton = this.root.getByRole("button", { name: text.edit(name), exact: true });
    this.deleteButton = this.root.getByRole("button", { name: text.delete(name), exact: true });
    this.progressBar = this.root.getByRole("progressbar", {
      name: text.progressBar(name),
      exact: true,
    });
    this.reachedBadge = this.root.getByText(text.reached, { exact: true });
    this.deadline = this.root.getByText(text.deadline(""));
    this.contributionInput = this.root.getByLabel(text.contributionLabel, { exact: true });
    this.contributionDateInput = this.root.getByLabel(text.contributionDateLabel, { exact: true });
    this.contributeButton = this.root.getByRole("button", { name: text.contribute, exact: true });

    const contributions = this.root.locator("details");
    this.contributionsToggle = contributions.locator("summary");
    this.contributionRows = contributions.getByRole("listitem");
  }

  /** "$250.00 de $1,000.00" */
  savedOf(saved: number, target: number): Locator {
    return this.root.getByText(text.savedOf(finance.money(saved), finance.money(target)), {
      exact: true,
    });
  }

  /** What is still missing. A goal that was reached shows `reachedBadge` instead. */
  remaining(amount: number): Locator {
    return this.root.getByText(text.remaining(finance.money(amount)), { exact: true });
  }

  /** How much to set aside each month to reach the goal by its deadline. */
  monthlySaving(amount: number): Locator {
    return this.root.getByText(text.monthlySaving(finance.money(amount)), { exact: true });
  }

  /** Button that removes a contribution, by its amount and its day ("2026-10-08"). */
  deleteContributionButton(amount: number, day: string): Locator {
    return this.root.getByRole("button", {
      name: text.deleteContribution(finance.money(amount), ui.dates.mediumDay(day)),
      exact: true,
    });
  }
}

/** Savings goals at /finance/goals: the cards, their contributions and the form that creates and edits them. */
export class GoalsPage {
  readonly deleteDialog: ConfirmDialog;
  readonly newGoalButton: Locator;
  readonly createForm: GoalForm;
  readonly editForm: GoalForm;
  readonly emptyMessage: Locator;
  /** Load and save errors. Scoped to the content: Next.js has a `role="alert"` of its own. */
  readonly alert: Locator;

  private readonly main: Locator;
  private readonly supabase: SupabaseRows;

  constructor(readonly page: Page) {
    this.main = page.getByRole("main");
    this.supabase = SupabaseRows.of(page);
    this.deleteDialog = new ConfirmDialog(page, finance.confirmDelete);

    this.newGoalButton = page.getByRole("button", { name: text.newGoal, exact: true });
    this.createForm = new GoalForm(
      page
        .locator("section")
        .filter({ has: page.getByRole("heading", { name: text.newGoal, exact: true }) })
        .locator("form"),
    );
    // Every card has a form for contributions too; only the one that edits a goal asks for a name
    this.editForm = new GoalForm(
      this.main
        .getByRole("listitem")
        .locator("form")
        .filter({ has: page.getByLabel(text.nameLabel, { exact: true }) }),
    );
    this.emptyMessage = this.main.getByText(text.empty, { exact: true });
    this.alert = this.main.getByRole("alert");
  }

  async goto() {
    await this.open();
    // The button replaces the loading message once the goals arrive, so by then React has hydrated
    await expect(this.newGoalButton).toBeVisible();
  }

  /** Navigates without waiting for the goals, for the tests where they never arrive. */
  async open() {
    await this.page.goto("/finance/goals");
  }

  /** Card of the goal with that name. The tests give every goal a name of its own. */
  card(name: string): GoalCard {
    // The contributions inside a card are list items too, but only a card has a title
    return new GoalCard(this.main.getByRole("listitem"), this.page, name);
  }

  /** Creates a goal through the form and remembers it so `deleteCreatedData` can remove it afterwards. */
  async createGoal(data: GoalData & { name: string; target: number | string }): Promise<GoalCard> {
    await this.newGoalButton.click();
    await this.createForm.fill(data);

    const saved = this.supabase.waitForCall(GOALS);
    await this.createForm.submitButton.click();
    await saved;
    await expect(this.createForm.root).toBeHidden();

    return this.card(data.name);
  }

  /** Submits the edit form and waits for the save. */
  async saveEdit() {
    const saved = this.supabase.waitForCall(GOALS, ["PATCH"]);
    await this.editForm.submitButton.click();
    await saved;
    await expect(this.editForm.root).toBeHidden();
  }

  /** Adds a contribution to a goal and waits for the save. Without a day it is today's. */
  async contribute(card: GoalCard, amount: number, day?: string) {
    await card.contributionInput.fill(String(amount));
    if (day !== undefined) await card.contributionDateInput.fill(day);

    const saved = this.supabase.waitForCall(CONTRIBUTIONS);
    await card.contributeButton.click();
    await saved;
    // The amount is cleared once the contribution counts
    await expect(card.contributionInput).toHaveValue("");
  }

  /** Makes the user look like one without goals. Call it before `goto`. */
  async mockNoGoals() {
    await mockSupabaseTable(this.page, GOALS, { method: "GET", status: 200, body: [] });
  }

  /** Makes Supabase reject every new goal. */
  async mockSaveError() {
    await mockSupabaseTable(this.page, GOALS, { method: "POST", status: 500, body: {} });
  }

  /** Makes Supabase reject every new contribution. */
  async mockContributionError() {
    await mockSupabaseTable(this.page, CONTRIBUTIONS, { method: "POST", status: 500, body: {} });
  }

  /** Makes the goals fail to load. Call it before `open`. */
  async mockLoadError() {
    await mockSupabaseTable(this.page, GOALS, { method: "GET", status: 500, body: {} });
  }

  /**
   * Deletes the goals the test created straight through the Supabase API.
   * Their contributions go with them.
   */
  async deleteCreatedData() {
    await this.supabase.deleteCreated();
  }
}
