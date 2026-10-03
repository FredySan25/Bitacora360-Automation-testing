import { expect, test } from "@playwright/test";

const PROTECTED_ROUTES = [
  "/today",
  "/habits",
  "/habits/progress",
  "/habits/gym",
  "/finance",
  "/watchlist",
];

test.describe("Protección de rutas sin sesión", () => {
  for (const route of PROTECTED_ROUTES) {
    test(`${route} redirige a /login`, async ({ page }) => {
      await page.goto(route);

      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
    });
  }

  test("la raíz redirige a /login", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/login$/);
  });
});
