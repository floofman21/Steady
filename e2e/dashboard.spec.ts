import { expect, test } from "@playwright/test";
import { personByRole, signInAs } from "./helpers";

test.beforeEach(async ({ context }) => {
  const hr = await personByRole("hr_admin");
  await signInAs(context, hr.email);
});

test("KPIs for the seed data match the prototype", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByText(/38\s+of\s+42\s+employees checked in this week \(90%/)).toBeVisible();
  const expected: [string, string, string][] = [
    ["Burnout Index", "50.0%", "-0.9 pts"],
    ["Happiness Index", "68.0%", "-0.6 pts"],
    ["Stress Level", "57.2%", "+0.6 pts"],
    ["Engagement Level", "66.5%", "-0.1 pts"],
  ];
  for (const [label, value, delta] of expected) {
    const card = page.locator("div", { hasText: label }).filter({ hasText: "vs last week" }).last();
    await expect(card).toContainText(value);
    await expect(card).toContainText(delta);
  }
  await expect(page.getByRole("link", { name: /Check-in Feed/ })).toContainText("5");
});

test("filter, sort and page state survive a reload", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("combobox", { name: "Department" }).selectOption("Sales");
  await expect(page).toHaveURL(/dept=Sales/);
  await page.getByRole("button", { name: "Happiness" }).click();
  await expect(page).toHaveURL(/sort=happiness/);
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Department" })).toHaveValue("Sales");
  await expect(page.locator("th[aria-sort='descending']")).toContainText("Happiness");
  const depts = await page.locator("#people tbody tr td:nth-child(4)").allInnerTexts();
  expect(depts.length).toBeGreaterThan(0);
  expect(new Set(depts)).toEqual(new Set(["Sales"]));

  await page.goto("/dashboard?page=2");
  await expect(page.getByText("Page 2 of 5")).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page).toHaveURL(/page=3/);
  await page.reload();
  await expect(page.getByText("Page 3 of 5")).toBeVisible();
});

test("search, at-risk filter, drawer and selection", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByLabel("Search employees").fill("EMP-1160");
  await expect(page).toHaveURL(/q=EMP-1160/);
  await expect(page.locator("#people tbody tr")).toHaveCount(1);
  await page.getByLabel("Search employees").fill("");
  await page.getByRole("button", { name: "At risk only" }).click();
  await expect(page).toHaveURL(/risk=1/);
  await expect(page.locator("#people tbody tr")).toHaveCount(5);

  await page.locator("#people tbody tr").first().click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText("Last 8 weeks");
  await expect(page).toHaveURL(/person=/);
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(page).not.toHaveURL(/person=/);

  await page.getByLabel("Select all on this page").check();
  await expect(page.getByText("5 of 5 row(s) selected")).toBeVisible();
});

test("breakdown hides small groups and filters the table", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("tab", { name: "Team" }).click();
  await expect(page.getByText("Not enough responses to display").first()).toBeVisible();
  await page.getByRole("tab", { name: "Department" }).click();
  await page.getByRole("button", { name: "Show Engineering in the table" }).click();
  await expect(page).toHaveURL(/dept=Engineering/);
});
