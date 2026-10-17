import { randomUUID } from "node:crypto";
import {
  expect,
  type APIRequestContext,
  type APIResponse,
  type Locator,
  type Page,
  type Response,
} from "@playwright/test";
import { holdSupabaseTable, mockSupabaseTable, SupabaseRows } from "../support/supabase-rows";
import { ui } from "../support/ui";
import { ConfirmDialog } from "./components/ConfirmDialog";

const text = ui.modules.watchlist;

const TABLE = "watchlist_items";

/** The route handler that searches the catalogs for the title field. */
export const CATALOG_SEARCH_PATH = "/api/watchlist/search";

/** Hosts of the posters and covers, the only ones `poster_url` accepts. */
const POSTER_HOSTS = /^https:\/\/(image\.tmdb\.org|books\.google\.com|covers\.openlibrary\.org)\//;

/** A 1×1 PNG, enough for an `<img>` to load. */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/**
 * Calls the catalog search as the form does, with the session of the request
 * context if it has one. Only for the answers that never reach a catalog: a
 * missing session or a wrong query.
 */
export function searchCatalog(
  request: APIRequestContext,
  params: Record<string, string>,
): Promise<APIResponse> {
  return request.get(CATALOG_SEARCH_PATH, { params });
}

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
export type CatalogSource = keyof typeof text.catalog.sources;

/** One suggestion, as the catalog search answers it. */
export type CatalogResult = {
  source: CatalogSource;
  catalogId: string;
  title: string;
  year: number | null;
  /** On one of the catalog hosts: `poster_url` takes no other. */
  posterUrl: string | null;
  /** The authors of a book. */
  byline: string | null;
};

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
  /** On one of the catalog hosts, as Supabase would have it. */
  posterUrl?: string;
  year?: number;
  /** The catalog it was picked from. */
  catalog?: { source: CatalogSource; id: string };
};

/** The form that adds an item and the one that edits it: same fields, another button. */
export class WatchlistForm {
  readonly typeGroup: Locator;
  /** A combobox: typing suggests titles from the catalog. */
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
  /** The catalog suggestions under the title. Only on screen while there are some. */
  readonly suggestions: Locator;
  readonly suggestionOptions: Locator;
  /** The suggestion the arrows are on, which Enter picks. */
  readonly highlightedSuggestion: Locator;
  /** What the title field says about the search: searching, no results or an error. */
  readonly catalogMessage: Locator;
  /** "Quitar del catálogo": only there while a catalog result is picked. */
  readonly removeLinkButton: Locator;

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
    this.suggestions = root.getByRole("listbox", {
      name: text.catalog.suggestionsLabel,
      exact: true,
    });
    this.suggestionOptions = this.suggestions.getByRole("option");
    this.highlightedSuggestion = this.suggestions.getByRole("option", { selected: true });
    this.catalogMessage = root.getByRole("status");
    this.removeLinkButton = root.getByRole("button", {
      name: text.catalog.removeLink,
      exact: true,
    });
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

  /** A suggestion, found by its title. */
  suggestion(title: string): Locator {
    return this.suggestionOptions.filter({
      has: this.root.page().getByText(title, { exact: true }),
    });
  }

  /** The suggestion with that title, only while the arrows are on it. */
  highlighted(title: string): Locator {
    return this.highlightedSuggestion.filter({
      has: this.root.page().getByText(title, { exact: true }),
    });
  }

  /** The line under a suggestion: its year and its authors. */
  suggestionDetail(title: string, year: number | null, byline: string | null): Locator {
    return this.suggestion(title).getByText(text.catalog.suggestionDetail(year, byline), {
      exact: true,
    });
  }

  /** The poster of the picked result, in the preview. */
  previewPoster(title: string, type: MediaType): Locator {
    return this.root.getByRole("img", { name: text.poster(title, type), exact: true });
  }

  /** "Del catálogo de TMDB": the preview of a picked result names its catalog. */
  previewSource(source: CatalogSource): Locator {
    return this.root.getByText(text.catalog.fromCatalog(text.catalog.sources[source]), {
      exact: true,
    });
  }

  /** The year of the picked result, in the preview. */
  previewYear(year: number): Locator {
    return this.root.getByText(String(year), { exact: true });
  }

  /** Types into the title and leaves the suggestions open, as a user about to pick one. */
  async typeTitle(title: string) {
    await this.titleInput.fill(title);
  }

  /**
   * The type goes first: it words the statuses. The status goes before the
   * finish day and the rating, which only a finished item has.
   */
  async fill(data: WatchlistItemData) {
    if (data.type) await this.typeOption(data.type).check();
    if (data.title !== undefined) {
      await this.titleInput.fill(data.title);
      // Typing opens the catalog suggestions, which cover the fields below
      // them: a user who types the title by hand dismisses them
      await this.titleInput.press("Escape");
    }
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

/** One card of the board. */
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
  /** The line with the year, whatever it is. Only an item with a year has it. */
  readonly yearLine: Locator;

  constructor(
    readonly root: Locator,
    private readonly title: string,
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
    this.yearLine = root.getByText(/^\d{1,4}$/);
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

  /** The poster, or the cover of a book. */
  poster(type: MediaType): Locator {
    return this.root.getByRole("img", { name: text.poster(this.title, type), exact: true });
  }

  /** What takes the place of the poster when there is none, or it fails to load. */
  noPoster(type: MediaType): Locator {
    return this.root.getByRole("img", { name: text.noPoster(this.title, type), exact: true });
  }

  year(year: number): Locator {
    return this.root.getByText(String(year), { exact: true });
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
  /** The line under the board that credits the catalogs, with its link. */
  readonly attribution: Locator;
  readonly creditsLink: Locator;
  /** The query of every catalog search the page made, in order. */
  readonly catalogSearches: URLSearchParams[] = [];

  private readonly main: Locator;
  private readonly supabase: SupabaseRows;
  // Read on every request, so a mock set after the page opened applies as well
  private catalogAnswer: CatalogResult[] | "error" = [];
  private catalogHeld?: Promise<void>;
  private catalogRouted = false;
  private postersBroken = false;
  private postersRouted = false;

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
    this.attribution = this.main.getByText(text.attribution);
    this.creditsLink = this.main.getByRole("link", { name: text.creditsLink, exact: true });
  }

  async goto() {
    // The request that lists the items carries the credentials the cleanup needs
    const listed = this.supabase.waitForCall(TABLE, ["GET"]);
    await this.open();
    await listed;
    await this.waitUntilLoaded();
  }

  /**
   * Navigates without waiting for the items, for the tests where they never
   * arrive. No test reaches the real catalogs: unless it asks otherwise, the
   * search finds nothing and every poster loads.
   */
  async open() {
    await this.routeCatalog();
    await this.routePosters();
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

  /**
   * Submits the form of a new item, already filled in, and waits for the
   * save. Resolves to the answer of Supabase, which carries the row it stored.
   */
  async submitNewItem(): Promise<Response> {
    const saved = this.supabase.waitForCall(TABLE);
    await this.createForm.submitButton.click();
    const response = await saved;
    // The form closes once the item is on the board
    await expect(this.createForm.root).toBeHidden();
    return response;
  }

  /** Submits the edit form and waits for the save. Resolves to the answer of Supabase. */
  async saveEdit(): Promise<Response> {
    const saved = this.supabase.waitForCall(TABLE, ["PATCH"]);
    await this.editForm.submitButton.click();
    const response = await saved;
    await expect(this.editForm.root).toBeHidden();
    return response;
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
      poster_url: item.posterUrl ?? null,
      release_year: item.year ?? null,
      catalog_source: item.catalog?.source ?? null,
      catalog_id: item.catalog?.id ?? null,
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

  /** Makes the catalog search answer these results, or fail as it does when a catalog is down. */
  async mockCatalog(answer: CatalogResult[] | "error") {
    this.catalogAnswer = answer;
    await this.routeCatalog();
  }

  /** Holds every catalog search until the returned function is called. */
  async holdCatalog(): Promise<() => void> {
    let release = () => {};
    this.catalogHeld = new Promise<void>((resolve) => {
      release = resolve;
    });
    await this.routeCatalog();
    return release;
  }

  /**
   * Waits for the answer to a catalog search of the form and resolves to its
   * query (`type` and `q`). Start it before typing and await it afterwards; by
   * then `catalogSearches` has it too.
   */
  async waitForCatalogSearch(): Promise<URLSearchParams> {
    const response = await this.page.waitForResponse(
      (candidate) => new URL(candidate.url()).pathname === CATALOG_SEARCH_PATH,
    );
    return new URL(response.url()).searchParams;
  }

  /** Makes every poster and cover fail to load. */
  async mockBrokenPosters() {
    this.postersBroken = true;
    await this.routePosters();
  }

  /** Deletes the items the test added straight through the Supabase API. */
  async deleteCreatedData() {
    await this.supabase.deleteCreated();
  }

  private async routeCatalog() {
    if (this.catalogRouted) return;
    this.catalogRouted = true;
    await this.page.route(
      (url) => url.pathname === CATALOG_SEARCH_PATH,
      async (route) => {
        this.catalogSearches.push(new URL(route.request().url()).searchParams);
        await this.catalogHeld;
        const answer = this.catalogAnswer;
        await route.fulfill(
          answer === "error"
            ? { status: 502, json: { error: "catalog_unavailable" } }
            : { status: 200, json: { results: answer } },
        );
      },
    );
  }

  /** The app loads the images straight from the catalog hosts, skipping the Next.js optimizer. */
  private async routePosters() {
    if (this.postersRouted) return;
    this.postersRouted = true;
    await this.page.route(POSTER_HOSTS, async (route) => {
      await route.fulfill(
        this.postersBroken
          ? { status: 404, body: "" }
          : { status: 200, contentType: "image/png", body: PIXEL },
      );
    });
  }
}
