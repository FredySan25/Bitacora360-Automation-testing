import { expect, type Locator, type Page } from "@playwright/test";
import { isOwnYear } from "../support/own-year";
import { mockSupabaseTable, SupabaseRows } from "../support/supabase-rows";
import { ui } from "../support/ui";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { MonthNav } from "./components/MonthNav";
import { SummaryCards } from "./components/SummaryCards";

const finance = ui.modules.finance;
const text = finance.transactions;

const TABLE = "transactions";

export type TransactionType = keyof typeof finance.types;

/** What a test fills in. Anything left out keeps the value the form starts with. */
export type TransactionData = {
  type?: TransactionType;
  amount: number | string;
  /** Label of a category of that type, e.g. "Comida". */
  category?: string;
  /** Day as a date input takes it: "1950-03-31". */
  date?: string;
  note?: string;
};

/** The form that registers a transaction and the one that edits it: same fields, another button. */
export class TransactionForm {
  readonly typeGroup: Locator;
  readonly amountInput: Locator;
  readonly categorySelect: Locator;
  readonly categoryOptions: Locator;
  readonly selectedCategory: Locator;
  readonly dateInput: Locator;
  readonly noteInput: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;

  constructor(readonly root: Locator) {
    this.typeGroup = root.getByRole("group", { name: text.typeLegend, exact: true });
    this.amountInput = root.getByLabel(text.amountLabel, { exact: true });
    this.categorySelect = root.getByLabel(text.categoryLabel, { exact: true });
    this.categoryOptions = this.categorySelect.getByRole("option");
    this.selectedCategory = this.categorySelect.locator("option:checked");
    this.dateInput = root.getByLabel(text.dateLabel, { exact: true });
    this.noteInput = root.getByLabel(text.noteLabel, { exact: true });
    this.submitButton = root.locator('button[type="submit"]');
    this.cancelButton = root.getByRole("button", { name: finance.cancel, exact: true });
  }

  typeOption(type: TransactionType): Locator {
    return this.typeGroup.getByRole("radio", { name: finance.types[type].label, exact: true });
  }

  /** The type goes first: it decides which categories there are to choose from. */
  async fill(data: TransactionData) {
    if (data.type) await this.typeOption(data.type).check();
    await this.amountInput.fill(String(data.amount));
    if (data.category) await this.categorySelect.selectOption({ label: data.category });
    if (data.date !== undefined) await this.dateInput.fill(data.date);
    if (data.note !== undefined) await this.noteInput.fill(data.note);
  }
}

/** One transaction in the list. */
export class TransactionRow {
  readonly editButton: Locator;
  readonly deleteButton: Locator;

  constructor(readonly root: Locator) {
    this.editButton = root.getByRole("button", { name: text.edit, exact: true });
    this.deleteButton = root.getByRole("button", { name: text.delete, exact: true });
  }

  category(label: string): Locator {
    return this.root.getByText(label, { exact: true });
  }

  /** The line under the category: the day and the note, or the day alone. `day` is a "1950-03-31" key. */
  detail(day: string, note?: string): Locator {
    return this.root.getByText(text.detail(ui.dates.shortDay(day), note), { exact: true });
  }

  /** The amount with its type and sign, as the row words it. */
  amount(type: TransactionType, value: number): Locator {
    const label = type === "income" ? text.incomeAmount(value) : text.expenseAmount(value);
    return this.root.getByText(label, { exact: true });
  }
}

/** Transactions of a month at /finance: the totals, the list with its filters and the forms. */
export class FinancePage {
  readonly monthNav: MonthNav;
  readonly cards: SummaryCards;
  readonly deleteDialog: ConfirmDialog;
  readonly newTransactionButton: Locator;
  readonly createForm: TransactionForm;
  readonly editForm: TransactionForm;
  /** Every transaction on screen, newest first. A row being edited shows its form instead. */
  readonly rows: Locator;
  readonly typeFilter: Locator;
  readonly categoryFilter: Locator;
  readonly noMatchesMessage: Locator;
  readonly clearFiltersButton: Locator;
  readonly savedElsewhereNotice: Locator;
  /** Load and save errors. Scoped to the content: Next.js has a `role="alert"` of its own. */
  readonly alert: Locator;

  private readonly main: Locator;
  private readonly list: Locator;
  private readonly supabase: SupabaseRows;

  constructor(readonly page: Page) {
    this.main = page.getByRole("main");
    this.supabase = SupabaseRows.of(page);
    this.monthNav = new MonthNav(page);
    this.cards = new SummaryCards(page);
    this.deleteDialog = new ConfirmDialog(page, finance.confirmDelete);

    this.newTransactionButton = page.getByRole("button", {
      name: text.newTransaction,
      exact: true,
    });
    this.createForm = new TransactionForm(
      page
        .locator("section")
        .filter({ has: page.getByRole("heading", { name: text.newTransaction, exact: true }) })
        .locator("form"),
    );

    this.list = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: text.listHeading, exact: true }) });
    this.rows = this.list.getByRole("listitem");
    this.editForm = new TransactionForm(this.rows.locator("form"));

    const filters = text.filters;
    this.typeFilter = this.list.getByLabel(filters.typeLabel, { exact: true });
    // The edit form has a category of its own; only the filter offers every category
    this.categoryFilter = this.list
      .getByRole("combobox", { name: filters.categoryLabel, exact: true })
      .filter({ has: page.getByRole("option", { name: filters.allCategories, exact: true }) });
    this.noMatchesMessage = this.list.getByText(text.noMatches, { exact: true });
    this.clearFiltersButton = this.list.getByRole("button", {
      name: text.clearFilters,
      exact: true,
    });
    this.savedElsewhereNotice = this.main.getByRole("status");
    this.alert = this.main.getByRole("alert");
  }

  /** Opens the transactions of a month ("1950-03"), or of the current one. */
  async goto(month?: string) {
    // The request that lists the transactions carries the credentials the cleanup needs
    const listed = this.supabase.waitForCall(TABLE, ["GET"]);
    await this.open(month);
    await listed;
    await this.waitUntilLoaded();
  }

  /**
   * Opens a month of the year `ownYear` gave the test, with that year empty.
   * A run that was killed, or a save that answered after its test had timed
   * out, leaves transactions nobody remembers; here they would change the
   * totals of the test.
   */
  async gotoOwnMonth(month: string) {
    await this.goto(month);
    if (await this.deleteTransactionsOf(Number(month.slice(0, 4)))) await this.goto(month);
  }

  /** Navigates without waiting for the transactions, for the tests where they never arrive. */
  async open(month?: string) {
    await this.page.goto(month ? `/finance?month=${month}` : "/finance");
  }

  /** The button replaces the loading message once the transactions arrive, so by then React has hydrated. */
  async waitUntilLoaded() {
    await expect(this.newTransactionButton).toBeVisible();
  }

  /** Row of the transaction with that note. The tests give every transaction they look for a note of its own. */
  row(note: string): TransactionRow {
    return new TransactionRow(this.rows.filter({ hasText: note }));
  }

  /** Row by its place in the list, counted from 0. */
  rowAt(index: number): TransactionRow {
    return new TransactionRow(this.rows.nth(index));
  }

  /** Message of a month without transactions, from its key ("1950-03"). */
  emptyMessage(month: string): Locator {
    return this.list.getByText(text.empty(ui.dates.monthYear(month)), { exact: true });
  }

  /**
   * Registers a transaction through the form and remembers it so
   * `deleteCreatedData` can remove it afterwards. Without a date it lands in
   * the month on screen.
   */
  async createTransaction(data: TransactionData) {
    await this.newTransactionButton.click();
    await this.createForm.fill(data);
    await this.submitNewTransaction();
  }

  /** Submits the form of a new transaction, already filled in, and waits for the save. */
  async submitNewTransaction() {
    const saved = this.supabase.waitForCall(TABLE);
    await this.createForm.submitButton.click();
    await saved;
    // The form closes once the transaction is in the list
    await expect(this.createForm.root).toBeHidden();
  }

  /** Submits the edit form and waits for the save. */
  async saveEdit() {
    const saved = this.supabase.waitForCall(TABLE, ["PATCH"]);
    await this.editForm.submitButton.click();
    await saved;
    await expect(this.editForm.root).toBeHidden();
  }

  /** Narrows the list to one type by its plural ("Gastos"), or shows every type again. */
  async filterByType(type: TransactionType | "all") {
    const label = type === "all" ? text.filters.allTypes : finance.types[type].plural;
    await this.typeFilter.selectOption({ label });
  }

  /** Narrows the list to one category. Both types have "Otros", so the category goes with its type. */
  async filterByCategory(type: TransactionType, category: string) {
    const option = this.categoryFilterGroup(type).getByRole("option", {
      name: category,
      exact: true,
    });
    const value = await option.getAttribute("value");
    if (value === null) throw new Error(`The category filter has no option "${category}".`);
    await this.categoryFilter.selectOption(value);
  }

  /**
   * The categories of one type in the category filter, under the plural of the
   * type. Playwright gives an `<optgroup>` no role, so it is found by its label.
   */
  categoryFilterGroup(type: TransactionType): Locator {
    return this.categoryFilter.locator(`optgroup[label="${finance.types[type].plural}"]`);
  }

  /** Makes the list of transactions fail to load. Call it before `page.goto`. */
  async mockLoadError() {
    await mockSupabaseTable(this.page, TABLE, { method: "GET", status: 500, body: {} });
  }

  /** Makes Supabase reject every new transaction. */
  async mockSaveError() {
    await mockSupabaseTable(this.page, TABLE, { method: "POST", status: 500, body: {} });
  }

  /** Makes Supabase refuse to delete any transaction. */
  async mockDeleteError() {
    await mockSupabaseTable(this.page, TABLE, { method: "DELETE", status: 500, body: {} });
  }

  /** Makes the user look like one without transactions. Call it before `page.goto`. */
  async mockNoTransactions() {
    await mockSupabaseTable(this.page, TABLE, { method: "GET", status: 200, body: [] });
  }

  /** Deletes the transactions the test registered straight through the Supabase API. */
  async deleteCreatedData() {
    await this.supabase.deleteCreated();
  }

  /**
   * Deletes every transaction dated in a year straight through the Supabase
   * API, and tells whether there was any. It only takes a year of the range
   * `ownYear` hands out: no test may empty a month the user really has.
   */
  async deleteTransactionsOf(year: number): Promise<boolean> {
    if (!isOwnYear(year)) {
      throw new Error(`${year} is not a year of the tests: refusing to delete its transactions.`);
    }
    const deleted = await this.supabase.delete(TABLE, {
      and: `(occurred_on.gte.${year}-01-01,occurred_on.lte.${year}-12-31)`,
    });
    return deleted > 0;
  }
}
