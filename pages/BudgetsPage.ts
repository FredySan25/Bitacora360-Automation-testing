import { expect, type Locator, type Page } from "@playwright/test";
import { mockSupabaseTable, SupabaseRows } from "../support/supabase-rows";
import { ui } from "../support/ui";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { MonthNav } from "./components/MonthNav";

const finance = ui.modules.finance;
const text = finance.budgets;

const TABLE = "budgets";

export type BudgetState = keyof typeof text.states;

/** Key the app saves a category under ("food"), from the label it shows ("Comida"). */
function categoryKey(label: string): string {
  const entry = Object.entries(finance.expenseCategories).find(([, name]) => name === label);
  if (!entry) throw new Error(`"${label}" is not an expense category.`);
  return entry[0];
}

/** The form that creates a budget and the one that changes its limit: same fields, another button. */
export class BudgetForm {
  /** Disabled while editing: a budget keeps its category. */
  readonly categorySelect: Locator;
  readonly selectedCategory: Locator;
  readonly limitInput: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;

  constructor(readonly root: Locator) {
    this.categorySelect = root.getByLabel(text.categoryLabel, { exact: true });
    this.selectedCategory = this.categorySelect.locator("option:checked");
    this.limitInput = root.getByLabel(text.limitLabel, { exact: true });
    this.submitButton = root.locator('button[type="submit"]');
    this.cancelButton = root.getByRole("button", { name: finance.cancel, exact: true });
  }

  /** A category among the ones the form offers. */
  categoryOption(category: string): Locator {
    return this.categorySelect.getByRole("option", { name: category, exact: true });
  }

  /** The line under the limit that says from which month it applies, from its key ("1950-03"). */
  appliesFrom(month: string): Locator {
    return this.root.getByText(text.appliesFrom(ui.dates.monthYear(month)), { exact: true });
  }
}

/** One budget in the list: what was spent against its limit, the bar and its state. */
export class BudgetRow {
  readonly root: Locator;
  readonly progressBar: Locator;
  readonly editButton: Locator;
  readonly deleteButton: Locator;

  constructor(list: Locator, page: Page, category: string) {
    this.progressBar = page.getByRole("progressbar", {
      name: text.progressBar(category),
      exact: true,
    });
    this.root = list.filter({ has: this.progressBar });
    this.editButton = this.root.getByRole("button", { name: text.edit(category), exact: true });
    this.deleteButton = this.root.getByRole("button", {
      name: text.delete(category),
      exact: true,
    });
  }

  /** "$79.99 de $100.00" */
  spentOf(spent: number, limit: number): Locator {
    return this.root.getByText(text.spentOf(finance.money(spent), finance.money(limit)), {
      exact: true,
    });
  }

  /** The state in words, next to its icon. */
  state(state: BudgetState): Locator {
    return this.root.getByText(text.states[state], { exact: true });
  }

  /** The line under the bar: the share used and what is left, or by how much it went over. */
  usage(percent: number, state: BudgetState, difference: number): Locator {
    const line = state === "over" ? text.exceeded : text.remaining;
    return this.root.getByText(line(finance.percent(percent), finance.money(difference)), {
      exact: true,
    });
  }
}

/** Budgets in force during a month at /finance/budgets, each against what was spent. */
export class BudgetsPage {
  readonly monthNav: MonthNav;
  readonly deleteDialog: ConfirmDialog;
  readonly newBudgetButton: Locator;
  readonly createForm: BudgetForm;
  readonly editForm: BudgetForm;
  /** Load and save errors. Scoped to the content: Next.js has a `role="alert"` of its own. */
  readonly alert: Locator;

  private readonly main: Locator;
  private readonly supabase: SupabaseRows;

  constructor(readonly page: Page) {
    this.main = page.getByRole("main");
    this.supabase = SupabaseRows.of(page);
    this.monthNav = new MonthNav(page);
    this.deleteDialog = new ConfirmDialog(page, finance.confirmDelete);

    this.newBudgetButton = page.getByRole("button", { name: text.newBudget, exact: true });
    this.createForm = new BudgetForm(
      page
        .locator("section")
        .filter({ has: page.getByRole("heading", { name: text.newBudget, exact: true }) })
        .locator("form"),
    );
    this.editForm = new BudgetForm(this.main.getByRole("listitem").locator("form"));
    this.alert = this.main.getByRole("alert");
  }

  /** Opens the budgets of a month ("1950-03"), or of the current one. */
  async goto(month?: string) {
    // The request that lists the budgets carries the credentials `deleteBudgets` needs
    const listed = this.supabase.waitForCall(TABLE, ["GET"]);
    await this.open(month);
    await listed;
    // The month selector replaces the loading message once budgets and spending arrive
    await expect(this.monthNav.previousButton).toBeVisible();
  }

  /** Navigates without waiting for the budgets, for the tests where they never arrive. */
  async open(month?: string) {
    await this.page.goto(month ? `/finance/budgets?month=${month}` : "/finance/budgets");
  }

  /** Row of the budget of a category, by its label ("Comida"). While it is being edited it shows the form instead. */
  row(category: string): BudgetRow {
    return new BudgetRow(this.main.getByRole("listitem"), this.page, category);
  }

  /** Message of a month without budgets, from its key ("1950-03"). */
  emptyMessage(month: string): Locator {
    return this.main.getByText(text.empty(ui.dates.monthYear(month)), { exact: true });
  }

  /** Creates a budget through the form. It applies from the month on screen onwards. */
  async createBudget(category: string, limit: number) {
    await this.newBudgetButton.click();
    await this.createForm.categorySelect.selectOption({ label: category });
    await this.createForm.limitInput.fill(String(limit));

    const saved = this.supabase.waitForCall(TABLE);
    await this.createForm.submitButton.click();
    await saved;
    await expect(this.createForm.root).toBeHidden();
  }

  /**
   * Changes the limit of a budget from the month on screen onwards. In the
   * month the budget started the app updates that version; in a later month it
   * adds a new one, so the wait takes either request.
   */
  async editLimit(category: string, limit: number) {
    await this.row(category).editButton.click();
    await this.editForm.limitInput.fill(String(limit));

    const saved = this.supabase.waitForCall(TABLE, ["POST", "PATCH"]);
    await this.editForm.submitButton.click();
    await saved;
    await expect(this.editForm.root).toBeHidden();
  }

  /**
   * Deletes every version of the budget of a category straight through the
   * Supabase API, as the app does, and tells whether there was any. A budget
   * reaches every later month, so no test may leave one behind.
   */
  async deleteBudgets(category: string): Promise<boolean> {
    const deleted = await this.supabase.delete(TABLE, { category: `eq.${categoryKey(category)}` });
    return deleted > 0;
  }

  /** Makes the user look like one without budgets. Call it before `goto`. */
  async mockNoBudgets() {
    await mockSupabaseTable(this.page, TABLE, { method: "GET", status: 200, body: [] });
  }

  /** Makes Supabase reject every new budget. */
  async mockSaveError() {
    await mockSupabaseTable(this.page, TABLE, { method: "POST", status: 500, body: {} });
  }

  /** Makes the budgets fail to load. Call it before `open`. */
  async mockLoadError() {
    await mockSupabaseTable(this.page, TABLE, { method: "GET", status: 500, body: {} });
  }
}
