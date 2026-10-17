import { expect, test } from "@playwright/test";
import { AboutPage, CREDIT_URLS } from "../../pages/AboutPage";
import { ui } from "../../support/ui";

// /about is public and outside the route groups. It runs here, with the specs
// without a session; the dashboard specs open it from the sidebar and the
// watchlist, with one
test.describe("About page without a session", () => {
  let about: AboutPage;

  test.beforeEach(async ({ page }) => {
    about = new AboutPage(page);
    await about.goto();
  });

  test("opens without redirecting to /login", async ({ page }) => {
    await expect(page).toHaveURL(/\/about$/);
    await expect(page).toHaveTitle(ui.about.documentTitle);
    await expect(about.heading).toBeVisible();
    for (const section of ["what", "moviesAndSeries", "books"] as const) {
      await expect(about.sectionHeading(section)).toBeVisible();
    }
  });

  test("credits TMDB with its logo, its link and its notice in both languages", async () => {
    await expect(about.tmdbLogo).toBeVisible();
    await expect.poll(() => about.logoLoaded()).toBe(true);
    await expect(about.tmdbNotice).toBeVisible();
    await expect(about.tmdbNoticeInEnglish).toBeVisible();
    await expect(about.tmdbNoticeInEnglish).toHaveAttribute("lang", "en");

    for (const link of [about.tmdbLogoLink, about.tmdbLink]) {
      await expect(link).toHaveAttribute("href", CREDIT_URLS.tmdb);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /noopener/);
    }
  });

  test("credits Google Books and Open Library with their links", async () => {
    for (const [link, url] of [
      [about.googleBooksLink, CREDIT_URLS.googleBooks],
      [about.openLibraryLink, CREDIT_URLS.openLibrary],
    ] as const) {
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", url);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /noopener/);
    }
  });

  test("the back link goes to the root, which sends a visitor to /login", async ({ page }) => {
    await expect(about.backLink).toHaveAttribute("href", "/");

    await about.backLink.click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: ui.login.heading })).toBeVisible();
  });
});
