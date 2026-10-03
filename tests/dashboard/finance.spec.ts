import { expect, test } from "@playwright/test";
import { DashboardShell } from "../../pages/DashboardShell";

test.describe("Finanzas", () => {
  test("carga la página del módulo", async ({ page }) => {
    await page.goto("/finance");

    await expect(new DashboardShell(page).pageTitle("Finanzas")).toBeVisible();
    await expect(page.getByText("Tus ingresos y gastos del mes.")).toBeVisible();
  });
});
