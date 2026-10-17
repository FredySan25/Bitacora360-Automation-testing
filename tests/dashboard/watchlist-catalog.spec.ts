import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { AboutPage } from "../../pages/AboutPage";
import {
  type CatalogResult,
  type CatalogSource,
  searchCatalog,
  type WatchlistForm,
  WatchlistPage,
} from "../../pages/WatchlistPage";
import { ui } from "../../support/ui";

const text = ui.modules.watchlist;

/** Images on the hosts `poster_url` accepts. The page object answers them, so none is fetched. */
const POSTERS: Record<CatalogSource, string> = {
  tmdb: "https://image.tmdb.org/t/p/w342/e2e.jpg",
  google_books: "https://books.google.com/books/content?id=e2e&printsec=frontcover&img=1",
  open_library: "https://covers.openlibrary.org/b/id/0-M.jpg",
};

/** Well past the 300 ms the form waits for the user to stop typing. */
const PAST_THE_DEBOUNCE = 1_000;

function unique(): string {
  return randomBytes(4).toString("hex");
}

/** A suggestion of the catalog, with an id of its own. */
function result(
  source: CatalogSource,
  title: string,
  { year = null, byline = null }: { year?: number | null; byline?: string | null } = {},
): CatalogResult {
  return { source, catalogId: `e2e-${unique()}`, title, year, posterUrl: POSTERS[source], byline };
}

/** Types, waits for the search and clicks the suggestion with that title. */
async function pickFromCatalog(
  watchlist: WatchlistPage,
  form: WatchlistForm,
  typed: string,
  title: string,
) {
  const searched = watchlist.waitForCatalogSearch();
  await form.typeTitle(typed);
  await searched;
  await form.suggestion(title).click();
}

// No test reaches the real catalogs: WatchlistPage answers the search (no
// results unless the test sets them) and the posters (an image, or a 404).
// The items are saved for real, with titles of their own, and deleted after
// each test
test.describe("Watchlist catalog", () => {
  let watchlist: WatchlistPage;
  let title: string;

  test.beforeEach(async ({ page }) => {
    watchlist = new WatchlistPage(page);
    title = `E2E catalog ${unique()}`;
  });

  test.afterEach(async () => {
    await watchlist.deleteCreatedData();
  });

  test.describe("suggestions", () => {
    test("suggests movies with their year and saves the picked one with its poster", async () => {
      const picked = result("tmdb", title, { year: 2001 });
      const other = result("tmdb", `${title} other`, { year: 2002 });
      await watchlist.mockCatalog([picked, other]);
      await watchlist.goto();
      await watchlist.addButton.click();
      const form = watchlist.createForm;

      const searched = watchlist.waitForCatalogSearch();
      await form.typeTitle("chihiro");

      const query = await searched;
      expect(query.get("type")).toBe("movie");
      expect(query.get("q")).toBe("chihiro");
      await expect(form.titleInput).toHaveAttribute("aria-expanded", "true");
      await expect(form.suggestionOptions).toHaveCount(2);
      await expect(form.suggestionDetail(picked.title, 2001, null)).toBeVisible();
      await expect(form.suggestionDetail(other.title, 2002, null)).toBeVisible();

      await form.suggestion(picked.title).click();

      // The title is the one of the catalog, and the preview shows what comes with it
      await expect(form.titleInput).toHaveValue(title);
      await expect(form.titleInput).toHaveAttribute("aria-expanded", "false");
      await expect(form.suggestions).toBeHidden();
      await expect(form.previewPoster(title, "movie")).toBeVisible();
      await expect(form.previewSource("tmdb")).toBeVisible();
      await expect(form.previewYear(2001)).toBeVisible();
      await expect(form.removeLinkButton).toBeVisible();

      const saved = await watchlist.submitNewItem();

      // The row Supabase stored, not just the one the form sent
      expect(await saved.json()).toMatchObject({
        title,
        media_type: "movie",
        catalog_source: "tmdb",
        catalog_id: picked.catalogId,
        poster_url: picked.posterUrl,
        release_year: 2001,
      });
      const row = watchlist.item(title, "pending");
      await expect(row.poster("movie")).toBeVisible();
      await expect(row.noPoster("movie")).toBeHidden();
      await expect(row.year(2001)).toBeVisible();
      await expect(row.detail("movie", "pending")).toBeVisible();

      await watchlist.goto();
      await expect(row.poster("movie")).toBeVisible();
      await expect(row.year(2001)).toBeVisible();

      // Editing a linked item starts with its preview
      await row.editButton.click();
      await expect(watchlist.editForm.previewPoster(title, "movie")).toBeVisible();
      await expect(watchlist.editForm.previewSource("tmdb")).toBeVisible();
      await expect(watchlist.editForm.previewYear(2001)).toBeVisible();
    });

    test("a series searches the series of TMDB and keeps its poster", async () => {
      const picked = result("tmdb", title, { year: 2008 });
      await watchlist.mockCatalog([picked]);
      await watchlist.goto();
      await watchlist.addButton.click();
      const form = watchlist.createForm;
      await form.typeOption("series").check();

      const searched = watchlist.waitForCatalogSearch();
      await form.typeTitle("breaking");

      expect((await searched).get("type")).toBe("series");
      await form.suggestion(title).click();
      await expect(form.previewPoster(title, "series")).toBeVisible();
      await expect(form.previewSource("tmdb")).toBeVisible();

      const saved = await watchlist.submitNewItem();

      expect(await saved.json()).toMatchObject({
        title,
        media_type: "series",
        catalog_source: "tmdb",
        catalog_id: picked.catalogId,
        poster_url: picked.posterUrl,
        release_year: 2008,
      });
      const row = watchlist.item(title, "pending");
      await expect(row.poster("series")).toBeVisible();
      await expect(row.detail("series", "pending")).toBeVisible();

      await watchlist.goto();
      await expect(row.poster("series")).toBeVisible();
      await expect(row.year(2008)).toBeVisible();
    });

    for (const source of ["google_books", "open_library"] as const) {
      test(`a book suggests ${source} results with their authors and keeps the cover`, async () => {
        const byline = "Gabriel García Márquez";
        const picked = result(source, title, { year: 1967, byline });
        const undated = result(source, `${title} undated`, { byline: "Anonymous" });
        await watchlist.mockCatalog([picked, undated]);
        await watchlist.goto();
        await watchlist.addButton.click();
        const form = watchlist.createForm;
        await form.typeOption("book").check();

        const searched = watchlist.waitForCatalogSearch();
        await form.typeTitle("solitude");

        expect((await searched).get("type")).toBe("book");
        await expect(form.suggestionDetail(picked.title, 1967, byline)).toBeVisible();
        // Without a year, the line has only the authors
        await expect(form.suggestionDetail(undated.title, null, "Anonymous")).toBeVisible();

        await form.suggestion(picked.title).click();

        await expect(form.previewPoster(title, "book")).toBeVisible();
        await expect(form.previewSource(source)).toBeVisible();
        await expect(form.previewYear(1967)).toBeVisible();
        await expect(form.removeLinkButton).toBeVisible();

        const saved = await watchlist.submitNewItem();

        expect(await saved.json()).toMatchObject({
          title,
          media_type: "book",
          catalog_source: source,
          catalog_id: picked.catalogId,
          poster_url: picked.posterUrl,
          release_year: 1967,
        });
        const row = watchlist.item(title, "pending");
        await expect(row.poster("book")).toBeVisible();
        await expect(row.year(1967)).toBeVisible();
        await expect(row.detail("book", "pending")).toBeVisible();

        await watchlist.goto();
        await expect(row.poster("book")).toBeVisible();
        await expect(row.year(1967)).toBeVisible();
      });
    }

    test("says that it is searching while the catalog answers", async () => {
      await watchlist.mockCatalog([result("tmdb", title)]);
      const release = await watchlist.holdCatalog();
      await watchlist.goto();
      await watchlist.addButton.click();
      const form = watchlist.createForm;

      const searched = watchlist.waitForCatalogSearch();
      await form.typeTitle("chihiro");

      await expect(form.catalogMessage).toHaveText(text.catalog.searching);
      await expect(form.titleInput).toHaveAttribute("aria-expanded", "false");
      // Still searching once the request is out
      await expect.poll(() => watchlist.catalogSearches.length).toBe(1);
      await expect(form.catalogMessage).toHaveText(text.catalog.searching);

      release();

      await searched;
      await expect(form.suggestion(title)).toBeVisible();
      await expect(form.catalogMessage).toBeHidden();
    });

    test("does not search with fewer than two characters", async ({ page }) => {
      // A fake clock lets the test run past the wait for the user to stop typing
      await page.clock.install();
      await watchlist.goto();
      await watchlist.addButton.click();
      const form = watchlist.createForm;

      for (const typed of ["a", "   ", " b "]) {
        await form.typeTitle(typed);
        await page.clock.runFor(PAST_THE_DEBOUNCE);

        await expect(form.catalogMessage).toBeHidden();
        await expect(form.titleInput).toHaveAttribute("aria-expanded", "false");
      }
      expect(watchlist.catalogSearches).toHaveLength(0);

      // Two characters are enough
      const searched = watchlist.waitForCatalogSearch();
      await form.typeTitle("ab");
      await page.clock.runFor(PAST_THE_DEBOUNCE);

      expect((await searched).get("q")).toBe("ab");
      expect(watchlist.catalogSearches.map((query) => query.get("q"))).toEqual(["ab"]);
    });

    test("once a result is picked, editing the title searches no more", async ({ page }) => {
      await page.clock.install();
      const picked = result("tmdb", `${title} catalog`, { year: 1988 });
      await watchlist.mockCatalog([picked]);
      await watchlist.goto();
      await watchlist.addButton.click();
      const form = watchlist.createForm;
      await pickFromCatalog(watchlist, form, "totoro", picked.title);

      await form.typeTitle(title);
      await page.clock.runFor(PAST_THE_DEBOUNCE);

      await expect(form.catalogMessage).toBeHidden();
      await expect(form.titleInput).toHaveAttribute("aria-expanded", "false");
      expect(watchlist.catalogSearches).toHaveLength(1);
      // The link stays, under the new title
      await expect(form.previewPoster(title, "movie")).toBeVisible();

      const saved = await watchlist.submitNewItem();

      expect(await saved.json()).toMatchObject({ title, catalog_id: picked.catalogId });
      await expect(watchlist.item(title, "pending").poster("movie")).toBeVisible();
    });
  });

  test.describe("keyboard", () => {
    test.beforeEach(async () => {
      await watchlist.goto();
    });

    test("the arrows and Enter pick a suggestion without submitting the form", async () => {
      const first = result("tmdb", title, { year: 1999 });
      const second = result("tmdb", `${title} second`, { year: 2003 });
      await watchlist.mockCatalog([first, second]);
      await watchlist.addButton.click();
      const form = watchlist.createForm;
      await form.typeTitle("matrix");
      await expect(form.suggestionOptions).toHaveCount(2);
      await expect(form.highlightedSuggestion).toHaveCount(0);

      await form.titleInput.press("ArrowDown");
      await expect(form.highlighted(first.title)).toBeVisible();
      // The field tells screen readers which one is highlighted
      const firstId = await form.highlighted(first.title).getAttribute("id");
      await expect(form.titleInput).toHaveAttribute("aria-activedescendant", firstId ?? "");

      await form.titleInput.press("ArrowDown");
      await expect(form.highlighted(second.title)).toBeVisible();
      await expect(form.highlighted(first.title)).toBeHidden();

      // Past the last one it goes back to the first, and the other way round
      await form.titleInput.press("ArrowDown");
      await expect(form.highlighted(first.title)).toBeVisible();
      await form.titleInput.press("ArrowUp");
      await expect(form.highlighted(second.title)).toBeVisible();
      await form.titleInput.press("ArrowUp");
      await expect(form.highlighted(first.title)).toBeVisible();
      await expect(form.highlightedSuggestion).toHaveCount(1);

      await form.titleInput.press("Enter");

      await expect(form.titleInput).toHaveValue(title);
      await expect(form.suggestions).toBeHidden();
      await expect(form.previewYear(1999)).toBeVisible();
      // The Enter picked; it did not add the item
      await expect(form.root).toBeVisible();
      await expect(form.submitButton).toHaveText(text.createSubmit);
      await expect(watchlist.item(title).root).toBeHidden();
    });

    test("a long list scrolls and keeps the highlighted suggestion in sight", async () => {
      const results = Array.from({ length: 8 }, (_, index) =>
        result("tmdb", `${title} ${index + 1}`, { year: 2000 + index }),
      );
      await watchlist.mockCatalog(results);
      await watchlist.addButton.click();
      const form = watchlist.createForm;
      await form.typeTitle("matrix");
      await expect(form.suggestionOptions).toHaveCount(8);

      // The list is shorter than its eight results, so it scrolls instead of covering the form
      const scrolls = await form.suggestions.evaluate(
        (list) => list.scrollHeight > list.clientHeight,
      );
      expect(scrolls).toBe(true);
      await expect(form.suggestionOptions.first()).toBeInViewport();
      await expect(form.suggestionOptions.last()).not.toBeInViewport();

      // Up from none goes to the last one, and the list scrolls to it
      await form.titleInput.press("ArrowUp");
      await expect(form.highlighted(results[7].title)).toBeInViewport();
      await expect(form.suggestionOptions.first()).not.toBeInViewport();

      // Down past the last one goes back to the first, and the list scrolls back up
      await form.titleInput.press("ArrowDown");
      await expect(form.highlighted(results[0].title)).toBeInViewport();

      await form.titleInput.press("Enter");
      await expect(form.titleInput).toHaveValue(results[0].title);
    });

    test("Escape and leaving the field close the suggestions and keep the typed title", async () => {
      await watchlist.mockCatalog([result("tmdb", title)]);
      await watchlist.addButton.click();
      const form = watchlist.createForm;
      await form.typeTitle("typed by hand");
      await expect(form.suggestion(title)).toBeVisible();

      await form.titleInput.press("Escape");

      await expect(form.suggestions).toBeHidden();
      await expect(form.titleInput).toHaveAttribute("aria-expanded", "false");
      await expect(form.titleInput).toHaveValue("typed by hand");
      await expect(form.removeLinkButton).toBeHidden();
      // Escape only closed the list, not the form
      await expect(form.root).toBeVisible();

      // Typing opens it again, and leaving the field closes it
      await form.typeTitle("typed by hand again");
      await expect(form.suggestion(title)).toBeVisible();

      await form.titleInput.press("Tab");

      await expect(form.suggestions).toBeHidden();
      await expect(form.titleInput).toHaveValue("typed by hand again");
      await expect(form.removeLinkButton).toBeHidden();
    });
  });

  test.describe("typed by hand", () => {
    test.beforeEach(async () => {
      await watchlist.goto();
    });

    test("without results it says so, and the item saves without a poster", async () => {
      // The catalog answers no results unless the test says otherwise
      await watchlist.addButton.click();
      const form = watchlist.createForm;
      const searched = watchlist.waitForCatalogSearch();
      await form.typeTitle(title);
      await searched;

      await expect(form.catalogMessage).toHaveText(text.catalog.noResults);
      await expect(form.titleInput).toHaveAttribute("aria-expanded", "false");
      await expect(form.suggestionOptions).toHaveCount(0);

      const saved = await watchlist.submitNewItem();

      expect(await saved.json()).toMatchObject({
        title,
        poster_url: null,
        release_year: null,
        catalog_source: null,
        catalog_id: null,
      });
      const row = watchlist.item(title, "pending");
      await expect(row.noPoster("movie")).toBeVisible();
      await expect(row.poster("movie")).toBeHidden();
      await expect(row.yearLine).toHaveCount(0);

      await watchlist.goto();
      await expect(row.noPoster("movie")).toBeVisible();
      await expect(row.yearLine).toHaveCount(0);
    });

    test("when the catalog fails it says so, and the item still saves", async () => {
      await watchlist.mockCatalog("error");
      await watchlist.addButton.click();
      const form = watchlist.createForm;
      await form.typeOption("book").check();
      const searched = watchlist.waitForCatalogSearch();
      await form.typeTitle(title);
      expect((await searched).get("type")).toBe("book");

      await expect(form.catalogMessage).toHaveText(text.catalog.searchError);
      await expect(form.titleInput).toHaveAttribute("aria-expanded", "false");

      const saved = await watchlist.submitNewItem();

      expect(await saved.json()).toMatchObject({ title, catalog_source: null, poster_url: null });
      const row = watchlist.item(title, "pending");
      await expect(row.noPoster("book")).toBeVisible();
      await expect(row.detail("book", "pending")).toBeVisible();

      await watchlist.goto();
      await expect(row.noPoster("book")).toBeVisible();
    });

    test("changing the type after picking a result drops the poster before saving", async () => {
      await watchlist.mockCatalog([result("tmdb", title, { year: 2010 })]);
      await watchlist.addButton.click();
      const form = watchlist.createForm;
      await pickFromCatalog(watchlist, form, "inception", title);
      await expect(form.previewSource("tmdb")).toBeVisible();

      // A movie of TMDB means nothing for a series
      await form.typeOption("series").check();

      await expect(form.previewSource("tmdb")).toBeHidden();
      await expect(form.previewPoster(title, "series")).toBeHidden();
      await expect(form.previewYear(2010)).toBeHidden();
      await expect(form.removeLinkButton).toBeHidden();
      await expect(form.titleInput).toHaveValue(title);

      const saved = await watchlist.submitNewItem();

      expect(await saved.json()).toMatchObject({
        title,
        media_type: "series",
        poster_url: null,
        release_year: null,
        catalog_source: null,
        catalog_id: null,
      });
      const row = watchlist.item(title, "pending");
      await expect(row.noPoster("series")).toBeVisible();
      await expect(row.yearLine).toHaveCount(0);

      await watchlist.goto();
      await expect(row.noPoster("series")).toBeVisible();
      await expect(row.detail("series", "pending")).toBeVisible();
    });
  });

  test.describe("editing", () => {
    test("removing the poster of a saved item leaves the stand-in", async () => {
      await watchlist.mockCatalog([result("tmdb", title, { year: 1997 })]);
      await watchlist.goto();
      await watchlist.addButton.click();
      await pickFromCatalog(watchlist, watchlist.createForm, "titanic", title);
      await watchlist.submitNewItem();
      const row = watchlist.item(title, "pending");
      await expect(row.poster("movie")).toBeVisible();

      await row.editButton.click();
      const form = watchlist.editForm;
      await expect(form.previewPoster(title, "movie")).toBeVisible();
      await expect(form.previewSource("tmdb")).toBeVisible();
      await expect(form.previewYear(1997)).toBeVisible();

      await form.removeLinkButton.click();

      await expect(form.previewSource("tmdb")).toBeHidden();
      await expect(form.removeLinkButton).toBeHidden();
      await expect(form.titleInput).toHaveValue(title);

      const saved = await watchlist.saveEdit();

      expect(await saved.json()).toMatchObject({
        title,
        poster_url: null,
        release_year: null,
        catalog_source: null,
        catalog_id: null,
      });
      await expect(row.noPoster("movie")).toBeVisible();
      await expect(row.poster("movie")).toBeHidden();
      await expect(row.yearLine).toHaveCount(0);

      await watchlist.goto();
      await expect(row.noPoster("movie")).toBeVisible();
      await expect(row.yearLine).toHaveCount(0);
    });
  });

  test.describe("cards", () => {
    test("shows the poster and the year of each item, and a stand-in without a poster", async () => {
      const [linked, typed] = [`${title} linked`, `${title} typed`];
      await watchlist.mockItems([
        {
          title: linked,
          type: "book",
          status: "pending",
          posterUrl: POSTERS.open_library,
          year: 1967,
          catalog: { source: "open_library", id: "e2e-linked" },
        },
        { title: typed, type: "movie", status: "pending" },
      ]);

      await watchlist.open();
      await watchlist.waitUntilLoaded();

      const linkedRow = watchlist.item(linked, "pending");
      await expect(linkedRow.poster("book")).toBeVisible();
      await expect(linkedRow.year(1967)).toBeVisible();
      await expect(linkedRow.detail("book", "pending")).toBeVisible();
      // The edit and delete buttons are still there, over the poster
      await expect(linkedRow.editButton).toBeVisible();
      await expect(linkedRow.deleteButton).toBeVisible();

      const typedRow = watchlist.item(typed, "pending");
      await expect(typedRow.noPoster("movie")).toBeVisible();
      await expect(typedRow.yearLine).toHaveCount(0);
      await expect(typedRow.detail("movie", "pending")).toBeVisible();
    });

    test("a poster that fails to load leaves the stand-in", async () => {
      const [movie, book] = [`${title} movie`, `${title} book`];
      await watchlist.mockItems([
        {
          title: movie,
          type: "movie",
          status: "pending",
          posterUrl: POSTERS.tmdb,
          year: 2001,
          catalog: { source: "tmdb", id: "e2e-movie" },
        },
        {
          title: book,
          type: "book",
          status: "pending",
          posterUrl: POSTERS.google_books,
          catalog: { source: "google_books", id: "e2e-book" },
        },
      ]);
      await watchlist.mockBrokenPosters();

      await watchlist.open();
      await watchlist.waitUntilLoaded();

      const movieRow = watchlist.item(movie, "pending");
      await expect(movieRow.noPoster("movie")).toBeVisible();
      await expect(movieRow.poster("movie")).toBeHidden();
      // The rest of the card is the same
      await expect(movieRow.year(2001)).toBeVisible();
      const bookRow = watchlist.item(book, "pending");
      await expect(bookRow.noPoster("book")).toBeVisible();
      await expect(bookRow.poster("book")).toBeHidden();
    });

    test("the line under the board credits the catalogs and leads to /about", async ({ page }) => {
      await watchlist.goto();

      await expect(watchlist.attribution).toHaveText(`${text.attribution} · ${text.creditsLink}`);

      await watchlist.creditsLink.click();

      await expect(page).toHaveURL(/\/about$/);
      await expect(new AboutPage(page).heading).toBeVisible();
    });
  });
});

// The route handler checks the session and the query before it reaches a
// catalog, so these answers are safe to ask for. Without a session it answers
// 401, which tests/auth/route-protection.spec.ts covers
test.describe("Watchlist catalog search route", () => {
  for (const [label, params] of [
    ["a type it does not know", { type: "podcast", q: "Spirited Away" }],
    ["no type", { q: "Spirited Away" }],
    ["a query of one character", { type: "movie", q: "a" }],
    ["a query of one character between spaces", { type: "book", q: "  a  " }],
    ["a query longer than 120 characters", { type: "series", q: "x".repeat(121) }],
  ] as const) {
    test(`answers 400 to ${label}`, async ({ request }) => {
      const response = await searchCatalog(request, params);

      expect(response.status()).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid_query" });
    });
  }
});
