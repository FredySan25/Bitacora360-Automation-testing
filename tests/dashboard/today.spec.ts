import { expect, test } from "@playwright/test";
import { DashboardShell } from "../../pages/DashboardShell";

const CARDS = [
  { title: "Hábitos", path: "/habits" },
  { title: "Finanzas", path: "/finance" },
  { title: "Watchlist", path: "/watchlist" },
];

test.describe("Hoy", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/today");
  });

  test("muestra el resumen de los tres módulos", async ({ page }) => {
    const shell = new DashboardShell(page);

    await expect(shell.pageTitle("Entrada del día")).toBeVisible();
    for (const card of CARDS) {
      await expect(page.getByRole("heading", { level: 2, name: card.title })).toBeVisible();
    }
  });

  for (const card of CARDS) {
    test(`la tarjeta de ${card.title} enlaza a ${card.path}`, async ({ page }) => {
      await page.getByRole("link", { name: `Ir a ${card.title}` }).click();

      await expect(page).toHaveURL(new RegExp(`${card.path}$`));
      await expect(new DashboardShell(page).pageTitle(card.title)).toBeVisible();
    });
  }
});
