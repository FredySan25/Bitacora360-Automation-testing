import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { DashboardShell } from "../../pages/DashboardShell";
import { type MediaType, WatchlistPage } from "../../pages/WatchlistPage";
import { todayKey } from "../../support/dates";
import { ui } from "../../support/ui";

const text = ui.modules.watchlist;

const TYPES: MediaType[] = ["movie", "series", "book"];

/** The wording of the next steps: books are read, movies and series are watched. */
function verb(type: MediaType): "read" | "watch" {
  return type === "book" ? "read" : "watch";
}

function newTitle(): string {
  return `E2E watch ${randomBytes(4).toString("hex")}`;
}

// The dashboard specs run in parallel against the same test user, and this
// screen lists every item of the user: each test works on items with titles of
// its own and only looks at those rows, never at the counts of the sections.
// The states the shared user cannot guarantee come from a mock
test.describe("Watchlist", () => {
  let watchlist: WatchlistPage;
  let title: string;

  test.beforeEach(async ({ page }) => {
    watchlist = new WatchlistPage(page);
    title = newTitle();
  });

  test.afterEach(async () => {
    await watchlist.deleteCreatedData();
  });

  test("shows the title and the description of the module", async ({ page }) => {
    await watchlist.goto();

    await expect(new DashboardShell(page).pageTitle(text.title)).toBeVisible();
    await expect(page.getByText(text.description, { exact: true })).toBeVisible();
    await expect(watchlist.filterOption("all")).toBeChecked();
  });

  test.describe("adding", () => {
    test.beforeEach(async () => {
      await watchlist.goto();
    });

    for (const type of TYPES) {
      test(`adds a ${type} as pending`, async () => {
        const row = await watchlist.addItem({ type, title });

        const pending = watchlist.item(title, "pending");
        await expect(pending.root).toBeVisible();
        await expect(pending.detail(type, "pending")).toBeVisible();
        await expect(watchlist.sectionHeading("pending")).toBeVisible();
        await expect(row.startButton).toHaveText(text.start[verb(type)]);
        await expect(row.finishButton).toHaveText(text.finish[verb(type)]);
        await expect(row.ratingGroup).toBeHidden();
        await expect(row.reviews).toHaveCount(0);

        // It was saved, not just shown
        await watchlist.goto();
        await expect(pending.detail(type, "pending")).toBeVisible();
      });
    }

    test("the form starts as a pending movie and words the statuses by type", async () => {
      await watchlist.addButton.click();

      const form = watchlist.createForm;
      await expect(form.submitButton).toHaveText(text.createSubmit);
      await expect(form.typeOption("movie")).toBeChecked();
      await expect(form.titleInput).toHaveValue("");
      await expect(form.statusSelect).toHaveValue("pending");
      await expect(form.statusOptions).toHaveText(Object.values(text.statuses.movie));
      // Only a finished item asks for its day and its rating
      await expect(form.finishedOnInput).toBeHidden();
      await expect(form.ratingGroup).toBeHidden();
      await expect(form.reviewInput).toHaveValue("");

      await form.typeOption("book").check();
      await expect(form.statusOptions).toHaveText(Object.values(text.statuses.book));

      await form.typeOption("series").check();
      await expect(form.statusOptions).toHaveText(Object.values(text.statuses.series));
    });

    test("a new item starts with the type of the filter", async () => {
      for (const type of TYPES) {
        await watchlist.filterOption(type).check();
        await watchlist.addButton.click();

        await expect(watchlist.createForm.typeOption(type)).toBeChecked();

        await watchlist.createForm.cancelButton.click();
      }

      // Every type together starts with a movie
      await watchlist.filterOption("all").check();
      await watchlist.addButton.click();
      await expect(watchlist.createForm.typeOption("movie")).toBeChecked();
    });

    test("adds a finished book with its day, rating and review", async () => {
      const finishedOn = todayKey(-3);
      const review = `Review ${randomBytes(4).toString("hex")}`;
      const form = watchlist.createForm;
      await watchlist.addButton.click();
      await form.fill({ type: "book", title, status: "done" });

      // A finished item is due today unless told otherwise, and never later
      await expect(form.finishedOnInput).toHaveValue(todayKey());
      await expect(form.finishedOnInput).toHaveAttribute("max", todayKey());
      // The rating is optional, and can be taken back before saving
      await expect(form.clearRatingButton).toBeHidden();
      await form.starLabel(3).click();
      await expect(form.clearRatingButton).toBeVisible();
      await form.clearRatingButton.click();
      await expect(form.star(3)).not.toBeChecked();
      await expect(form.clearRatingButton).toBeHidden();

      await form.fill({ finishedOn, rating: 5, review });
      await watchlist.submitNewItem();

      const row = watchlist.item(title, "done");
      await expect(row.detail("book", "done", finishedOn)).toBeVisible();
      await expect(row.review(review)).toBeVisible();
      await expect(row.reviews).toHaveCount(1);
      await expect(row.star(5)).toBeChecked();
      await expect(row.startButton).toBeHidden();
      await expect(row.finishButton).toBeHidden();

      await watchlist.goto();
      await expect(row.detail("book", "done", finishedOn)).toBeVisible();
      await expect(row.review(review)).toBeVisible();
      await expect(row.star(5)).toBeChecked();
    });

    test("trims the title and drops a review of only spaces", async () => {
      await watchlist.addItem({ title: `  ${title}  `, review: "   " });

      const row = watchlist.item(title, "pending");
      await expect(row.root).toBeVisible();
      await expect(row.reviews).toHaveCount(0);

      await watchlist.goto();
      await expect(row.detail("movie", "pending")).toBeVisible();
      await expect(row.reviews).toHaveCount(0);
    });

    test("says that it is saving while Supabase answers", async () => {
      const form = watchlist.createForm;
      await watchlist.addButton.click();
      await form.fill({ title });
      const release = await watchlist.holdSave();

      const submitted = watchlist.submitNewItem();

      await expect(form.submitButton).toHaveText(text.saving);
      await expect(form.submitButton).toBeDisabled();
      await expect(form.titleInput).toBeDisabled();
      await expect(form.cancelButton).toBeDisabled();

      release();
      await submitted;
      await expect(watchlist.item(title, "pending").root).toBeVisible();
    });

    test("cancelling the form adds nothing", async () => {
      await watchlist.addButton.click();
      await watchlist.createForm.fill({ title });

      await watchlist.createForm.cancelButton.click();

      await expect(watchlist.createForm.root).toBeHidden();
      await expect(watchlist.addButton).toBeVisible();
      await expect(watchlist.item(title).root).toBeHidden();

      await watchlist.goto();
      await expect(watchlist.item(title).root).toBeHidden();
    });
  });

  test.describe("validation", () => {
    test.beforeEach(async () => {
      await watchlist.goto();
      await watchlist.addButton.click();
    });

    test("does not add an item without a title", async () => {
      const form = watchlist.createForm;

      await form.submitButton.click();

      const missing = await form.titleInput.evaluate(
        (el: HTMLInputElement) => el.validity.valueMissing,
      );
      expect(missing).toBe(true);
      await expect(form.root).toBeVisible();
    });

    test("does not add an item with a title of only spaces", async () => {
      const form = watchlist.createForm;
      await form.fill({ title: "   " });

      await form.submitButton.click();

      const onlySpaces = await form.titleInput.evaluate(
        (el: HTMLInputElement) => el.validity.patternMismatch,
      );
      expect(onlySpaces).toBe(true);
      await expect(form.root).toBeVisible();
    });

    test("the title stops at 120 characters, and all of them are saved", async () => {
      const longest = title.padEnd(120, "x");
      const form = watchlist.createForm;

      await form.fill({ title: `${longest}overflow` });

      await expect(form.titleInput).toHaveAttribute("maxlength", "120");
      await expect(form.titleInput).toHaveValue(longest);

      await watchlist.submitNewItem();
      await watchlist.goto();
      await expect(watchlist.item(longest, "pending").root).toBeVisible();
    });

    test("the review stops at 280 characters, and all of them are saved", async () => {
      const longest = `Review ${randomBytes(4).toString("hex")}`.padEnd(280, "x");
      const form = watchlist.createForm;

      await form.fill({ title, review: `${longest}overflow` });

      await expect(form.reviewInput).toHaveAttribute("maxlength", "280");
      await expect(form.reviewInput).toHaveValue(longest);

      await watchlist.submitNewItem();
      await watchlist.goto();
      await expect(watchlist.item(title).review(longest)).toBeVisible();
    });

    for (const [label, day, problem] of [
      ["without its day", "", "valueMissing"],
      ["on a future day", todayKey(1), "rangeOverflow"],
    ] as const) {
      test(`does not add a finished item ${label}`, async () => {
        const form = watchlist.createForm;
        await form.fill({ title, status: "done", finishedOn: day });

        await form.submitButton.click();

        const invalid = await form.finishedOnInput.evaluate(
          (el: HTMLInputElement, flag) => el.validity[flag],
          problem,
        );
        expect(invalid).toBe(true);
        await expect(form.root).toBeVisible();
        await expect(watchlist.item(title).root).toBeHidden();
      });
    }
  });

  test.describe("filter", () => {
    test("each filter shows only its type", async () => {
      await watchlist.goto();
      const titles = { movie: `${title} movie`, series: `${title} series`, book: `${title} book` };
      for (const type of TYPES) await watchlist.addItem({ type, title: titles[type] });

      for (const type of TYPES) {
        await watchlist.filterOption(type).check();

        await expect(watchlist.item(titles[type], "pending").root).toBeVisible();
        await expect(watchlist.rowsOfType(type).first()).toBeVisible();
        for (const other of TYPES.filter((candidate) => candidate !== type)) {
          await expect(watchlist.item(titles[other]).root).toBeHidden();
          // Nor any other item of the user of another type
          await expect(watchlist.rowsOfType(other)).toHaveCount(0);
        }
      }

      await watchlist.filterOption("all").check();
      for (const type of TYPES) {
        await expect(watchlist.item(titles[type], "pending").root).toBeVisible();
      }
    });

    test("a filter without items of its type says so", async () => {
      // The other tests keep items of every type, so the list comes from a mock
      await watchlist.mockItems([{ title, type: "series", status: "pending" }]);
      await watchlist.open();
      await watchlist.waitUntilLoaded();

      for (const type of ["movie", "book"] as const) {
        await watchlist.filterOption(type).check();

        await expect(watchlist.noneOfTypeMessage(type)).toBeVisible();
        await expect(watchlist.item(title).root).toBeHidden();
        await expect(watchlist.emptyMessage).toBeHidden();
      }

      await watchlist.filterOption("series").check();
      await expect(watchlist.item(title, "pending").root).toBeVisible();
      await expect(watchlist.noneOfTypeMessage("series")).toBeHidden();
    });

    test("adding an item the filter would hide switches the filter to its type", async () => {
      await watchlist.goto();
      await watchlist.filterOption("movie").check();

      await watchlist.addItem({ type: "book", title });

      await expect(watchlist.filterOption("book")).toBeChecked();
      await expect(watchlist.filterOption("movie")).not.toBeChecked();
      await expect(watchlist.item(title, "pending").detail("book", "pending")).toBeVisible();
      await expect(watchlist.rowsOfType("movie")).toHaveCount(0);
    });

    test("editing an item into a type the filter would hide switches the filter to it", async () => {
      await watchlist.goto();
      await watchlist.filterOption("movie").check();
      const row = await watchlist.addItem({ type: "movie", title });
      // A movie fits the filter, so the filter stays
      await expect(watchlist.filterOption("movie")).toBeChecked();

      await row.editButton.click();
      await watchlist.editForm.fill({ type: "series" });
      await watchlist.saveEdit();

      await expect(watchlist.filterOption("series")).toBeChecked();
      await expect(watchlist.item(title, "pending").detail("series", "pending")).toBeVisible();
      await expect(watchlist.rowsOfType("movie")).toHaveCount(0);

      await watchlist.goto();
      await expect(watchlist.item(title, "pending").detail("series", "pending")).toBeVisible();
    });

    test("with every type shown, adding an item keeps the filter", async () => {
      await watchlist.goto();
      await expect(watchlist.filterOption("all")).toBeChecked();

      await watchlist.addItem({ type: "book", title });

      await expect(watchlist.filterOption("all")).toBeChecked();
      await expect(watchlist.item(title, "pending").detail("book", "pending")).toBeVisible();
    });
  });

  test.describe("moving along", () => {
    test.beforeEach(async () => {
      await watchlist.goto();
    });

    for (const type of ["movie", "book"] as const) {
      test(`a ${type} goes from pending to in progress to finished today`, async () => {
        const row = await watchlist.addItem({ type, title });

        await watchlist.saveFromRow(row.startButton);

        const inProgress = watchlist.item(title, "in_progress");
        await expect(inProgress.detail(type, "in_progress")).toBeVisible();
        await expect(watchlist.sectionHeading("in_progress")).toBeVisible();
        await expect(row.startButton).toBeHidden();
        await expect(row.finishButton).toHaveText(text.finish[verb(type)]);

        await watchlist.goto();
        await expect(inProgress.detail(type, "in_progress")).toBeVisible();

        await watchlist.saveFromRow(row.finishButton);

        const done = watchlist.item(title, "done");
        await expect(done.detail(type, "done", todayKey())).toBeVisible();
        await expect(watchlist.sectionHeading("done")).toBeVisible();
        await expect(row.finishButton).toBeHidden();
        // A finished item can be rated, but starts without stars
        await expect(row.ratingGroup).toBeVisible();
        await expect(row.ratingGroup.getByRole("radio", { checked: true })).toHaveCount(0);

        await watchlist.goto();
        await expect(done.detail(type, "done", todayKey())).toBeVisible();
      });
    }

    test("a pending series can be finished without starting it", async () => {
      const row = await watchlist.addItem({ type: "series", title });

      await watchlist.saveFromRow(row.finishButton);

      const done = watchlist.item(title, "done");
      await expect(done.detail("series", "done", todayKey())).toBeVisible();

      await watchlist.goto();
      await expect(done.detail("series", "done", todayKey())).toBeVisible();
    });
  });

  test.describe("rating", () => {
    test("rates a finished item from the list, changes and clears the rating", async () => {
      await watchlist.goto();
      const row = await watchlist.addItem({ title, status: "done" });
      await expect(row.clearRatingButton).toBeHidden();

      await watchlist.saveFromRow(row.starLabel(4));

      await expect(row.star(4)).toBeChecked();
      await expect(row.ratingGroup.getByRole("radio", { checked: true })).toHaveCount(1);
      await expect(row.clearRatingButton).toBeVisible();
      await watchlist.goto();
      await expect(row.star(4)).toBeChecked();

      await watchlist.saveFromRow(row.starLabel(2));

      await expect(row.star(2)).toBeChecked();
      await expect(row.star(4)).not.toBeChecked();
      await watchlist.goto();
      await expect(row.star(2)).toBeChecked();
      await expect(row.star(4)).not.toBeChecked();

      await watchlist.saveFromRow(row.clearRatingButton);

      await expect(row.ratingGroup.getByRole("radio", { checked: true })).toHaveCount(0);
      await expect(row.clearRatingButton).toBeHidden();
      await watchlist.goto();
      await expect(row.ratingGroup).toBeVisible();
      await expect(row.ratingGroup.getByRole("radio", { checked: true })).toHaveCount(0);
      await expect(row.clearRatingButton).toBeHidden();
    });
  });

  test.describe("editing", () => {
    test.beforeEach(async () => {
      await watchlist.goto();
    });

    test("edits the title, the type, the status and the review", async () => {
      const renamed = newTitle();
      const [review, newReview] = ["First review", "Second review"];
      const row = await watchlist.addItem({ title, review });

      await row.editButton.click();

      // The form starts with what was saved
      const form = watchlist.editForm;
      await expect(form.submitButton).toHaveText(text.saveSubmit);
      await expect(form.titleInput).toHaveValue(title);
      await expect(form.typeOption("movie")).toBeChecked();
      await expect(form.statusSelect).toHaveValue("pending");
      await expect(form.reviewInput).toHaveValue(review);

      await form.fill({ title: renamed, type: "series", status: "in_progress", review: newReview });
      await watchlist.saveEdit();

      const edited = watchlist.item(renamed, "in_progress");
      await expect(row.root).toBeHidden();
      await expect(edited.detail("series", "in_progress")).toBeVisible();
      await expect(edited.review(newReview)).toBeVisible();

      // The change was saved, not just shown
      await watchlist.goto();
      await expect(edited.detail("series", "in_progress")).toBeVisible();
      await expect(edited.review(newReview)).toBeVisible();
      await expect(row.root).toBeHidden();
    });

    test("taking a finished item back to pending drops its day and rating", async () => {
      const row = await watchlist.addItem({
        type: "book",
        title,
        status: "done",
        rating: 4,
        review: "A review",
      });

      await row.editButton.click();
      const form = watchlist.editForm;
      await expect(form.statusSelect).toHaveValue("done");
      await expect(form.finishedOnInput).toHaveValue(todayKey());
      await expect(form.star(4)).toBeChecked();

      // An empty review takes it away too
      await form.fill({ status: "pending", review: "" });
      await watchlist.saveEdit();

      const pending = watchlist.item(title, "pending");
      await expect(pending.detail("book", "pending")).toBeVisible();
      await expect(pending.ratingGroup).toBeHidden();
      await expect(pending.reviews).toHaveCount(0);

      await watchlist.goto();
      await expect(pending.detail("book", "pending")).toBeVisible();
      await expect(pending.reviews).toHaveCount(0);

      // Finished again, it starts over: today and without stars
      await pending.editButton.click();
      await expect(form.star(4)).toBeHidden();
      await form.fill({ status: "done" });
      await expect(form.finishedOnInput).toHaveValue(todayKey());
      await expect(form.ratingGroup.getByRole("radio", { checked: true })).toHaveCount(0);
    });

    test("cancelling the edit keeps the item as it was", async () => {
      const review = "A review";
      const row = await watchlist.addItem({ title, review });

      await row.editButton.click();
      await watchlist.editForm.fill({
        title: newTitle(),
        type: "book",
        status: "in_progress",
        review: "Another review",
      });
      await watchlist.editForm.cancelButton.click();

      await expect(watchlist.editForm.root).toBeHidden();
      const pending = watchlist.item(title, "pending");
      await expect(pending.detail("movie", "pending")).toBeVisible();
      await expect(pending.review(review)).toBeVisible();

      await watchlist.goto();
      await expect(pending.detail("movie", "pending")).toBeVisible();
      await expect(pending.review(review)).toBeVisible();
    });
  });

  test.describe("deleting", () => {
    test.beforeEach(async () => {
      await watchlist.goto();
    });

    test("deletes an item after confirming in the dialog", async () => {
      const row = await watchlist.addItem({ title });

      await row.deleteButton.click();

      const dialog = watchlist.deleteDialog;
      await expect(dialog.title).toHaveText(text.deleteTitle(title));
      await expect(dialog.message).toHaveText(text.deleteMessage);

      await dialog.confirm();

      await expect(row.root).toBeHidden();

      // It was deleted, not just hidden
      await watchlist.goto();
      await expect(row.root).toBeHidden();
    });

    for (const [label, dismiss] of [
      ["the cancel button", "cancel"],
      ["Escape", "pressEscape"],
    ] as const) {
      test(`keeps the item when the dialog is closed with ${label}`, async () => {
        const row = await watchlist.addItem({ title });

        await row.deleteButton.click();
        await watchlist.deleteDialog[dismiss]();

        await expect(row.root).toBeVisible();

        await watchlist.goto();
        await expect(row.root).toBeVisible();
      });
    }
  });

  test.describe("without items, or without Supabase", () => {
    test("invites to add the first title", async () => {
      // The other tests keep items of the same user, so the list comes empty from a mock
      await watchlist.mockNoItems();

      await watchlist.open();
      await watchlist.waitUntilLoaded();

      await expect(watchlist.emptyMessage).toBeVisible();
      await expect(watchlist.rows).toHaveCount(0);

      // A filter says the same: there is nothing at all yet
      await watchlist.filterOption("book").check();
      await expect(watchlist.emptyMessage).toBeVisible();
      await expect(watchlist.noneOfTypeMessage("book")).toBeHidden();
    });

    test("says that the list is loading", async () => {
      const release = await watchlist.holdLoad();

      await watchlist.open();

      await expect(watchlist.loadingMessage).toBeVisible();
      await expect(watchlist.addButton).toBeHidden();

      release();
      await watchlist.waitUntilLoaded();
      await expect(watchlist.loadingMessage).toBeHidden();
    });

    test("says that the list could not be loaded", async () => {
      await watchlist.mockLoadError();

      await watchlist.open();

      await expect(watchlist.alert).toHaveText(text.loadError);
      await expect(watchlist.addButton).toBeHidden();
      await expect(watchlist.filterGroup).toBeHidden();
    });

    test("keeps the form open when the item cannot be saved", async () => {
      await watchlist.goto();
      await watchlist.mockSaveError("POST");
      const review = "A review";
      await watchlist.addButton.click();
      await watchlist.createForm.fill({ type: "book", title, review });

      await watchlist.createForm.submitButton.click();

      await expect(watchlist.alert).toHaveText(text.saveError);
      // Nothing typed is lost
      await expect(watchlist.createForm.typeOption("book")).toBeChecked();
      await expect(watchlist.createForm.titleInput).toHaveValue(title);
      await expect(watchlist.createForm.reviewInput).toHaveValue(review);
      await expect(watchlist.item(title).root).toBeHidden();

      // Closing the form dismisses the error
      await watchlist.createForm.cancelButton.click();
      await expect(watchlist.alert).toBeHidden();
    });

    test("keeps the item where it was when a change cannot be saved", async () => {
      await watchlist.goto();
      const row = await watchlist.addItem({ title });
      await watchlist.mockSaveError("PATCH");

      await row.startButton.click();

      await expect(watchlist.alert).toHaveText(text.saveError);
      await expect(watchlist.item(title, "pending").root).toBeVisible();
      await expect(row.startButton).toBeEnabled();

      await watchlist.goto();
      await expect(watchlist.item(title, "pending").detail("movie", "pending")).toBeVisible();
    });

    test("keeps the item when it cannot be deleted", async () => {
      await watchlist.goto();
      const row = await watchlist.addItem({ title });
      await watchlist.mockSaveError("DELETE");

      await row.deleteButton.click();
      await watchlist.deleteDialog.confirm();

      await expect(watchlist.alert).toHaveText(text.saveError);
      await expect(row.root).toBeVisible();

      await watchlist.goto();
      await expect(row.root).toBeVisible();
    });
  });
});
