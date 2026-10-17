import type { Locator, Page } from "@playwright/test";
import { ui } from "../support/ui";

/** Layout shared by every page under /(dashboard): sidebar, user info and logout. */
export class DashboardShell {
  readonly sidebar: Locator;
  readonly logoutButton: Locator;
  /** The link to /about on a desktop: in the sidebar, over the email. */
  readonly sidebarAboutLink: Locator;
  /** The link to /about on a phone, which has no sidebar: at the end of the page. */
  readonly footerAboutLink: Locator;

  constructor(readonly page: Page) {
    this.sidebar = page.getByRole("complementary");
    this.logoutButton = page.getByRole("button", { name: ui.shell.logout });
    this.sidebarAboutLink = this.sidebar.getByRole("link", {
      name: ui.shell.aboutLink,
      exact: true,
    });
    this.footerAboutLink = page
      .getByRole("main")
      .getByRole("link", { name: ui.shell.aboutLink, exact: true });
  }

  navLink(name: string): Locator {
    return this.sidebar.getByRole("link", { name, exact: true });
  }

  pageTitle(name: string): Locator {
    return this.page.getByRole("heading", { level: 1, name });
  }
}
