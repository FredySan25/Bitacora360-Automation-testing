import type { Locator, Page } from "@playwright/test";
import { ui } from "../support/ui";

const text = ui.about;

/** Where each credit of /about leads. */
export const CREDIT_URLS = {
  tmdb: "https://www.themoviedb.org/",
  googleBooks: "https://books.google.com/",
  openLibrary: "https://openlibrary.org/",
};

/**
 * The public page at /about: what Bitácora360 is and the credits of the
 * catalogs the watchlist uses. It reads the same with or without a session.
 */
export class AboutPage {
  readonly main: Locator;
  readonly heading: Locator;
  readonly tmdbLogo: Locator;
  /** The logo is a link to TMDB too. */
  readonly tmdbLogoLink: Locator;
  readonly tmdbLink: Locator;
  readonly tmdbNotice: Locator;
  readonly tmdbNoticeInEnglish: Locator;
  readonly googleBooksLink: Locator;
  readonly openLibraryLink: Locator;
  readonly backLink: Locator;

  constructor(readonly page: Page) {
    this.main = page.getByRole("main");
    this.heading = this.main.getByRole("heading", { level: 1, name: text.heading, exact: true });
    this.tmdbLogo = this.main.getByRole("img", { name: text.tmdbLogo, exact: true });
    this.tmdbLogoLink = this.main.getByRole("link", { name: text.tmdbLogo, exact: true });
    this.tmdbLink = this.main.getByRole("link", { name: text.tmdbLink, exact: true });
    this.tmdbNotice = this.main.getByText(text.tmdbNotice, { exact: true });
    this.tmdbNoticeInEnglish = this.main.getByText(text.tmdbNoticeInEnglish, { exact: true });
    this.googleBooksLink = this.main.getByRole("link", { name: text.googleBooksLink, exact: true });
    this.openLibraryLink = this.main.getByRole("link", { name: text.openLibraryLink, exact: true });
    this.backLink = this.main.getByRole("link", { name: text.backLink, exact: true });
  }

  async goto() {
    await this.page.goto("/about");
  }

  /** A block of the page, by its heading. */
  sectionHeading(section: keyof typeof text.sections): Locator {
    return this.main.getByRole("heading", { level: 2, name: text.sections[section], exact: true });
  }

  /** Whether the logo really loaded, not just its `<img>`. */
  async logoLoaded(): Promise<boolean> {
    return this.tmdbLogo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
  }
}
