import type { Locator, Page } from "@playwright/test";
import { ui } from "../support/ui";

/** Layout shared by every page under /(dashboard): sidebar, user info and logout. */
export class DashboardShell {
  readonly sidebar: Locator;
  readonly logoutButton: Locator;

  constructor(readonly page: Page) {
    this.sidebar = page.getByRole("complementary");
    this.logoutButton = page.getByRole("button", { name: ui.shell.logout });
  }

  navLink(name: string): Locator {
    return this.sidebar.getByRole("link", { name, exact: true });
  }

  pageTitle(name: string): Locator {
    return this.page.getByRole("heading", { level: 1, name });
  }
}
