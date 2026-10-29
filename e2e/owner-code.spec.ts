import { expect, test } from "@playwright/test";
import { E2E_OWNER_CODE } from "../playwright.config";

test("the owner access code signs in as the HR admin", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Owner access code").fill("not-the-code-at-all-xyz");
  await page.getByRole("button", { name: "Sign in as HR admin" }).click();
  await expect(page.getByText("That access code isn’t right.")).toBeVisible();

  await page.getByLabel("Owner access code").fill(E2E_OWNER_CODE);
  await page.getByRole("button", { name: "Sign in as HR admin" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText("HR admin", { exact: true })).toBeVisible();
});
