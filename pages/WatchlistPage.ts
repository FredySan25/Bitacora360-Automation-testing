import { randomUUID } from "node:crypto";
import { expect, type Locator, type Page } from "@playwright/test";
import { holdSupabaseTable, mockSupabaseTable, SupabaseRows } from "../support/supabase-rows";
import { ui } from "../support/ui";
import { ConfirmDialog } from "./components/ConfirmDialog";

const text = ui.modules.watchlist;

const TABLE = "watchlist_items";

/**
 * The star a user clicks in a rating. Its radio is visually hidden and the
 * star icon takes the click, so the click goes to the label that holds both.
 */
function starLabel(group: Locator, count: number): Locator {
  return group.locator("label").filter({
    has: group.page().getByRole("radio", { name: text.stars(count), exact: true }),
  });
}

export type MediaType = keyof typeof text.types;
export type WatchStatus = keyof typeof text.sections;

/** What a test fills in. Anything left out keeps the value the form starts with. */
export type WatchlistItemData = {
  type?: MediaType;
  title?: string;
  status?: WatchStatus;
  /** Finish day as a date input takes it ("2026-10-14"). Only a finished item asks for it. */
  finishedOn?: string;
  /** Whole stars from 1 to 5. Only a finished item can have them. */
  rating?: number;
  review?: string;
};

/** An item as Supabase lists it, for the tests that answer the list with a mock. */
export type MockItem = {
  title: string;
  type: MediaType;
  status: WatchStatus;
  rating?: number;
  /** "2026-10-14"; a finished item needs one. */
  finishedOn?: string;
  review?: string;
};

/** The form that adds an item and the one that edits it: same fields, another button. */
export class WatchlistForm {
  readonly typeGroup: Locator;
  readonly titleInput: Locator;
  readonly statusSelect: Locator;
  readonly statusOptions: Locator;
  /** Only there while the status is the finished one. */
  readonly finishedOnInput: Locator;
  /** Only there while the status is the finished one. */
  readonly ratingGroup: Locator;
  readonly clearRatingButton: Locator;
  readonly reviewInput: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;

  constructor(readonly root: Locator) {
    this.typeGroup = root.getByRole("group", { name: text.typeLegend, exact: true });
    this.titleInput = root.getByLabel(text.titleLabel, { exact: true });
    this.statusSelect = root.getByLabel(text.statusLabel, { exact: true });
    this.statusOptions = this.statusSelect.getByRole("option");
    this.finishedOnInput = root.getByLabel(text.finishedOnLabel, { exact: true });
    this.ratingGroup = root.getByRole("group", { name: text.ratingLegend, exact: true });
    this.clearRatingButton = this.ratingGroup.getByRole("button", {
      name: text.clearRating,
      exact: true,
    });
    this.reviewInput = root.getByLabel(text.reviewLabel, { exact: true });
    this.submitButton = root.locator('button[type="submit"]');
    this.cancelButton = root.getByRole("button", { name: text.cancel, exact: true });
  }

  typeOption(type: MediaType): Locator {
    return this.typeGroup.getByRole("radio", { name: text.types[type].label, exact: true });
  }

  /** The radio of a star: it tells whether the star is picked. */
  star(count: number): Locator {
    return this.ratingGroup.getByRole("radio", { name: text.stars(count), exact: true });
  }

  /** The star to click. */
  starLabel(count: number): Locator {
    return starLabel(this.ratingGroup, count);
  }

  /**
   * The type goes first: it words the statuses. The status goes before the
   * finish day and the rating, which only a finished item has.
   */
  async fill(data: WatchlistItemData) {
    if (data.type) await this.typeOption(data.type).check();
    if (data.title !== undefined) await this.titleInput.fill(data.title);
    if (data.status) {
      const type = data.type ?? (await this.checkedType());
      await this.statusSelect.selectOption({ label: text.statuses[type][data.status] });
    }
    if (data.finishedOn !== undefined) await this.finishedOnInput.fill(data.finishedOn);
    if (data.rating !== undefined) await this.starLabel(data.rating).click();
    if (data.review !== undefined) await this.reviewInput.fill(data.review);
  }

  /** The type the form has picked. */
  async checkedType(): Promise<MediaType> {
    for (const type of Object.keys(text.types) as MediaType[]) {
      if (await this.typeOption(type).isChecked()) return type;
    }
    throw new Error("The watchlist form has no type picked.");
  }
}

/** One item of the board. */
export class WatchlistRow {
  readonly editButton: Locator;
  readonly deleteButton: Locator;
  /** "Empezar a ver" or "Empezar a leer": only a pending item has it. */
  readonly startButton: Locator;
  /** "Marcar como vista" or "Marcar como leído": only an item not yet finished has it. */
  readonly finishButton: Locator;
  /** The stars of a finished item, which save on click. */
  readonly ratingGroup: Locator;
  readonly clearRatingButton: Locator;
  /** Every review on the row, whatever it says. */
  readonly reviews: Locator;

  constructor(
    readonly root: Locator,
    title: string,
  ) {
    this.editButton = root.getByRole("button", { name: text.edit(title), exact: true });
    this.deleteButton = root.getByRole("button", { name: text.delete(title), exact: true });
    this.startButton = root
      .getByRole("button", { name: text.start.watch, exact: true })
      .or(root.getByRole("button", { name: text.start.read, exact: true }));
    this.finishButton = root
      .getByRole("button", { name: text.finish.watch, exact: true })
      .or(root.getByRole("button", { name: text.finish.read, exact: true }));
    this.ratingGroup = root.getByRole("group", { name: text.ratingOf(title), exact: true });
    this.clearRatingButton = this.ratingGroup.getByRole("button", {
      name: text.clearRating,
      exact: true,
    });
    this.reviews = root.getByText(/^“.*”$/);
  }

  /** The line under the title. `finishedOn` is a "2026-10-14" key, for a finished item. */
  detail(type: MediaType, status: WatchStatus, finishedOn?: string): Locator {
    const line = text.detail(
      text.types[type].label,
      text.statuses[type][status],
      // As the app shows it: "14 oct 2026"
      finishedOn && ui.dates.mediumDay(finishedOn),
    );
    return this.root.getByText(line, { exact: true });
  }

  review(note: string): Locator {
    return this.root.getByText(text.review(note), { exact: true });
  }

  /** The radio of a star: it tells whether the star is picked. */
  star(count: number): Locator {
    return this.ratingGroup.getByRole("radio", { name: text.stars(count), exact: true });
  }

  /** The star to click. */
  starLabel(count: number): Locator {
    return starLabel(this.ratingGroup, count);
  }
}

/**
 * The watchlist at /watchlist: the type filter, the form that adds an item
 * and the sections of items in progress, pending and finished.
 */
export class WatchlistPage {
  readonly deleteDialog: ConfirmDialog;
  readonly filterGroup: Locator;
  readonly addButton: Locator;
  readonly createForm: WatchlistForm;
  readonly editForm: WatchlistForm;
  /** The message of a user without items. */
  readonly emptyMessage: Locator;
  readonly loadingMessage: Locator;
  /** Load and save errors. Scoped to the content: Next.js has a `role="alert"` of its own. */
  readonly alert: Locator;
  /** Every item on screen, in any section. An item being edited shows its form instead. */
  readonly rows: Locator;

  private readonly main: Locator;
  private readonly supabase: SupabaseRows;

  constructor(readonly page: Page) {
    this.main = page.getByRole("main");
    this.supabase = SupabaseRows.of(page);
    this.deleteDialog = new ConfirmDialog(page, text.confirmDelete);

    this.filterGroup = this.main.getByRole("group", { name: text.filterLegend, exact: true });
    this.addButton = this.main.getByRole("button", { name: text.addTitle, exact: true });
    this.createForm = new WatchlistForm(
      this.main
        .locator("section")
        .filter({ has: page.getByRole("heading", { name: text.newTitle, exact: true }) })
        .locator("form"),
    );
    this.rows = this.main.getByRole("listitem");
    this.editForm = new WatchlistForm(this.rows.locator("form"));
    this.emptyMessage = this.main.getByText(text.empty, { exact: true });
    this.loadingMessage = this.main.getByText(text.loading, { exact: true });
    this.alert = this.main.getByRole("alert");
  }

  async goto() {
    // The request that lists the items carries the credentials the cleanup needs
    const listed = this.supabase.waitForCall(TABLE, ["GET"]);
    await this.open();
    await listed;
    await this.waitUntilLoaded();
  }

  /** Navigates without waiting for the items, for the tests where they never arrive. */
  async open() {
    await this.page.goto("/watchlist");
  }

  /** The button replaces the loading message once the items arrive, so by then React has hydrated. */
  async waitUntilLoaded() {
    await expect(this.addButton).toBeVisible();
  }

  /** Radio of the type filter: one type, or every type. */
  filterOption(type: MediaType | "all"): Locator {
    const label = type === "all" ? text.allTypes : text.types[type].plural;
    return this.filterGroup.getByRole("radio", { name: label, exact: true });
  }

  /** The lines of every row on screen of that type, found by how they start: "Película · ". */
  rowsOfType(type: MediaType): Locator {
    return this.rows.getByText(new RegExp(`^${text.detail(text.types[type].label, "")}`));
  }

  /** Message of a filter that leaves nothing to show. */
  noneOfTypeMessage(type: MediaType): Locator {
    return this.main.getByText(text.noneOfType(text.types[type].plural), { exact: true });
  }

  /** A section of the board, whatever its count. It is only there while it has items. */
  section(status: WatchStatus): Locator {
    return this.main.locator("section").filter({
      has: this.page.getByRole("heading", {
        level: 2,
        name: text.sectionHeadingPattern(text.sections[status]),
      }),
    });
  }

  /** Heading of a section, whatever its count. */
  sectionHeading(status: WatchStatus): Locator {
    return this.section(status).getByRole("heading", { level: 2 });
  }

  /**
   * Row of the item with that title, in a section or anywhere on the board.
   * The tests give every item a title of its own.
   */
  item(title: string, status?: WatchStatus): WatchlistRow {
    const rows = status ? this.section(status).getByRole("listitem") : this.rows;
    return new WatchlistRow(
      rows.filter({ has: this.page.getByText(title, { exact: true }) }),
      title,
    );
  }

  /** Adds an item through the form and remembers it so `deleteCreatedData` can remove it afterwards. */
  async addItem(data: WatchlistItemData & { title: string }): Promise<WatchlistRow> {
    await this.addButton.click();
    await this.createForm.fill(data);
    await this.submitNewItem();
    return this.item(data.title);
  }

  /** Submits the form of a new item, already filled in, and waits for the save. */
  async submitNewItem() {
    const saved = this.supabase.waitForCall(TABLE);
    await this.createForm.submitButton.click();
    await saved;
    // The form closes once the item is on the board
    await expect(this.createForm.root).toBeHidden();
  }

  /** Submits the edit form and waits for the save. */
  async saveEdit() {
    const saved = this.supabase.waitForCall(TABLE, ["PATCH"]);
    await this.editForm.submitButton.click();
    await saved;
    await expect(this.editForm.root).toBeHidden();
  }

  /** Clicks a button of a row that saves on its own (a next step, a star) and waits for the save. */
  async saveFromRow(button: Locator) {
    const saved = this.supabase.waitForCall(TABLE, ["PATCH"]);
    await button.click();
    await saved;
  }

  /** Makes the user look like one with only these items. Call it before `open`. */
  async mockItems(items: MockItem[]) {
    const rows = items.map((item, index) => ({
      id: randomUUID(),
      title: item.title,
      media_type: item.type,
      status: item.status,
      rating: item.rating ?? null,
      finished_on: item.finishedOn ?? null,
      note: item.review ?? null,
      // Newest first, as Supabase sorts them
      created_at: new Date(Date.now() - index * 60_000).toISOString(),
    }));
    await mockSupabaseTable(this.page, TABLE, { method: "GET", status: 200, body: rows });
  }

  /** Makes the user look like one without items. Call it before `open`. */
  async mockNoItems() {
    await this.mockItems([]);
  }

  /** Makes the items fail to load. Call it before `open`. */
  async mockLoadError() {
    await mockSupabaseTable(this.page, TABLE, { method: "GET", status: 500, body: {} });
  }

  /** Makes Supabase reject every write with that method: POST, PATCH or DELETE. */
  async mockSaveError(method: "POST" | "PATCH" | "DELETE") {
    await mockSupabaseTable(this.page, TABLE, { method, status: 500, body: {} });
  }

  /** Holds the list until the returned function is called. Call it before `open`. */
  async holdLoad(): Promise<() => void> {
    return holdSupabaseTable(this.page, TABLE, "GET");
  }

  /** Holds every new item until the returned function is called. */
  async holdSave(): Promise<() => void> {
    return holdSupabaseTable(this.page, TABLE, "POST");
  }

  /** Deletes the items the test added straight through the Supabase API. */
  async deleteCreatedData() {
    await this.supabase.deleteCreated();
  }
}
