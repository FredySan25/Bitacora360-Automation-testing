import { expect, test } from "@playwright/test";
import { DashboardShell } from "../../pages/DashboardShell";
import { getTestUser } from "../../support/env";

const MODULES = [
  { link: "Hábitos", path: "/habits", title: "Hábitos" },
  { link: "Finanzas", path: "/finance", title: "Finanzas" },
  { link: "Watchlist", path: "/watchlist", title: "Watchlist" },
  { link: "Hoy", path: "/today", title: "Entrada del día" },
];

test.describe("Navegación del dashboard", () => {
  test("el menú lateral lleva a cada módulo y marca el activo", async ({ page }) => {
    const shell = new DashboardShell(page);
    await page.goto("/today");

    for (const module of MODULES) {
      await shell.navLink(module.link).click();

      await expect(page).toHaveURL(new RegExp(`${module.path}$`));
      await expect(shell.pageTitle(module.title)).toBeVisible();
      await expect(shell.navLink(module.link)).toHaveAttribute("aria-current", "page");
    }
  });

  test("muestra el email del usuario en el menú lateral", async ({ page }) => {
    const shell = new DashboardShell(page);
    await page.goto("/today");

    await expect(shell.sidebar.getByText(getTestUser().email)).toBeVisible();
    await expect(shell.logoutButton).toBeVisible();
  });

  test("con sesión activa, /login y /register redirigen a /today", async ({ page }) => {
    for (const authPath of ["/login", "/register"]) {
      await page.goto(authPath);

      await expect(page).toHaveURL(/\/today$/);
    }
  });

  test("con sesión activa, la raíz redirige a /today", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/today$/);
  });
});
