import { expect, test } from "@playwright/test";
import { DashboardShell } from "../../pages/DashboardShell";

const TABS = [
  { label: "Progreso", path: "/habits/progress" },
  { label: "Gym", path: "/habits/gym" },
  { label: "Diario", path: "/habits" },
];

test.describe("Hábitos", () => {
  test("las pestañas cambian de sección y marcan la activa", async ({ page }) => {
    const shell = new DashboardShell(page);
    const tabs = page.getByRole("navigation", { name: "Secciones de hábitos" });
    await page.goto("/habits");

    await expect(shell.pageTitle("Hábitos")).toBeVisible();
    await expect(tabs.getByRole("link", { name: "Diario" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    for (const tab of TABS) {
      await tabs.getByRole("link", { name: tab.label }).click();

      await expect(page).toHaveURL(new RegExp(`${tab.path}$`));
      await expect(tabs.getByRole("link", { name: tab.label })).toHaveAttribute(
        "aria-current",
        "page",
      );
      // The sidebar keeps "Hábitos" active across the three sections
      await expect(shell.navLink("Hábitos")).toHaveAttribute("aria-current", "page");
    }
  });
});
